"""
Battle Flow DAG — hierarchical temporal structure of a breaking battle.

A breaking battle has a natural tree-like structure:

    battle_root
    ├── round_1 (dancer A)
    │   ├── move_1 (toprock)
    │   ├── move_2 (footwork)
    │   └── move_3 (freeze)
    ├── round_2 (dancer B)
    │   ├── move_1 (toprock)
    │   └── move_2 (power)
    └── ...

This module represents that structure as a directed acyclic graph (DAG)
where edges point from parent to child: battle → rounds → moves.

Graph Theory Concepts
---------------------
- **DAG (Directed Acyclic Graph)**: a directed graph with no cycles.
  The battle hierarchy is naturally acyclic because time flows forward.
- **Topological ordering**: nodes can be processed in temporal order
  via topological sort, which is guaranteed to exist for DAGs.
- **Momentum arc**: a time series of aggregate scores across rounds,
  showing how a dancer's intensity rises or falls during the battle.
- **Vocabulary progression**: how the set of distinct moves evolves
  round-by-round, revealing strategy adaptation.

All functions are pure-CPU, using NetworkX for graph construction.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

import networkx as nx
import numpy as np

from graphs.transition import MoveEvent


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class BattleRound:
    """One round (set) within a battle.

    Attributes
    ----------
    round_num : int
        1-indexed round number within the battle.
    dancer_id : str
        Identifier of the dancer performing this round.
    moves : list[MoveEvent]
        Ordered sequence of moves in this round.
    total_frames : int
        Total frame count for this round.
    energy_score : float
        Aggregate energy / intensity metric for the round, in [0, 1].
    musicality_score : float
        Aggregate musicality metric for the round, in [0, 1].
    """

    round_num: int
    dancer_id: str
    moves: List[MoveEvent]
    total_frames: int
    energy_score: float
    musicality_score: float


@dataclass
class BattleDAG:
    """Hierarchical DAG representing a full battle.

    Attributes
    ----------
    graph : nx.DiGraph
        Three-level DAG:  ``battle_root`` → ``round_<N>_<dancer>`` → ``move_<...>``.
    rounds : list[BattleRound]
        The original round data.
    dancer_ids : list[str]
        Unique dancer identifiers participating in the battle.
    """

    graph: nx.DiGraph
    rounds: List[BattleRound]
    dancer_ids: List[str]


# ---------------------------------------------------------------------------
# DAG construction
# ---------------------------------------------------------------------------

def build_battle_dag(rounds: List[BattleRound]) -> BattleDAG:
    """Build a hierarchical DAG from battle rounds.

    The DAG has three levels:

    1. **Root node** (``"battle_root"``): single entry point.
    2. **Round nodes** (``"round_<N>_<dancer_id>"``): one per round,
       storing ``energy_score``, ``musicality_score``, ``total_frames``,
       ``dancer_id``, ``round_num``.
    3. **Move nodes** (``"round_<N>_move_<M>"``): one per move within
       each round, storing ``move_type``, ``difficulty``, ``quality``,
       ``start_frame``, ``end_frame``.

    Edges point downward (parent → child) and carry no special weight.

    Parameters
    ----------
    rounds : list[BattleRound]
        Rounds in temporal order.

    Returns
    -------
    BattleDAG
        Complete hierarchical DAG.
    """
    G = nx.DiGraph()

    # Root node.
    G.add_node(
        "battle_root",
        level="battle",
        num_rounds=len(rounds),
    )

    dancer_ids_set: Set[str] = set()

    for rnd in rounds:
        dancer_ids_set.add(rnd.dancer_id)
        round_id = f"round_{rnd.round_num}_{rnd.dancer_id}"

        # Round node.
        G.add_node(
            round_id,
            level="round",
            round_num=rnd.round_num,
            dancer_id=rnd.dancer_id,
            energy_score=rnd.energy_score,
            musicality_score=rnd.musicality_score,
            total_frames=rnd.total_frames,
            num_moves=len(rnd.moves),
        )
        G.add_edge("battle_root", round_id)

        # Move nodes.
        for i, move in enumerate(rnd.moves):
            move_id = f"round_{rnd.round_num}_move_{i}"
            G.add_node(
                move_id,
                level="move",
                move_type=move.move_type,
                difficulty=move.difficulty,
                quality=move.quality,
                start_frame=move.start_frame,
                end_frame=move.end_frame,
                duration_frames=move.duration_frames,
                dancer_id=rnd.dancer_id,
            )
            G.add_edge(round_id, move_id)

            # Sequential edge between consecutive moves within the round.
            if i > 0:
                prev_move_id = f"round_{rnd.round_num}_move_{i - 1}"
                G.add_edge(prev_move_id, move_id, relation="sequence")

    dancer_ids = sorted(dancer_ids_set)

    return BattleDAG(graph=G, rounds=rounds, dancer_ids=dancer_ids)


# ---------------------------------------------------------------------------
# Momentum analysis
# ---------------------------------------------------------------------------

def compute_momentum_arc(dag: BattleDAG, dancer_id: str) -> np.ndarray:
    """Compute the energy/intensity trajectory across rounds for a dancer.

    The momentum arc is a 1-D array where each entry is a composite
    score for one round, combining energy and musicality:

        momentum_i = 0.6 * energy_i + 0.4 * musicality_i

    This weighting reflects that in breaking judging, raw energy
    (dynamics, difficulty) is weighted slightly higher than musicality.

    Parameters
    ----------
    dag : BattleDAG
        Battle DAG built by :func:`build_battle_dag`.
    dancer_id : str
        The dancer whose arc to compute.

    Returns
    -------
    np.ndarray, shape (R,)
        One momentum value per round in temporal order.
        Returns an empty array if the dancer has no rounds.

    Notes
    -----
    The momentum arc reveals *pacing strategy*: does the dancer start
    strong and fade (front-loaded), build up (back-loaded), or maintain
    consistent intensity (flat)?  Elite dancers typically save their
    hardest material for later rounds.
    """
    # Collect this dancer's rounds in round_num order.
    dancer_rounds = sorted(
        [r for r in dag.rounds if r.dancer_id == dancer_id],
        key=lambda r: r.round_num,
    )

    if not dancer_rounds:
        return np.array([], dtype=np.float64)

    momentum = np.array(
        [0.6 * r.energy_score + 0.4 * r.musicality_score for r in dancer_rounds],
        dtype=np.float64,
    )
    return momentum


# ---------------------------------------------------------------------------
# Vocabulary progression
# ---------------------------------------------------------------------------

def compute_vocabulary_progression(
    dag: BattleDAG,
    dancer_id: str,
) -> List[Dict[str, Any]]:
    """Track how a dancer's vocabulary evolves across rounds.

    For each round the dancer performs, we record:
    - Which move types were used in that round.
    - How many are *new* (not seen in any prior round).
    - The cumulative vocabulary size up to and including that round.

    This reveals strategy adaptation: does the dancer repeat patterns
    or introduce fresh material as the battle progresses?

    Parameters
    ----------
    dag : BattleDAG
        Battle DAG built by :func:`build_battle_dag`.
    dancer_id : str
        The dancer to analyse.

    Returns
    -------
    list[dict]
        One entry per round (in order) with keys:

        - ``round_num`` (int)
        - ``move_types`` (list[str]): moves used this round.
        - ``new_moves`` (list[str]): moves appearing for the first time.
        - ``cumulative_vocab_size`` (int): total unique moves seen so far.
        - ``novelty_ratio`` (float): fraction of this round's moves that
          are new.  1.0 = all new, 0.0 = all repeats.
    """
    dancer_rounds = sorted(
        [r for r in dag.rounds if r.dancer_id == dancer_id],
        key=lambda r: r.round_num,
    )

    if not dancer_rounds:
        return []

    seen: Set[str] = set()
    progression: List[Dict[str, Any]] = []

    for rnd in dancer_rounds:
        round_types = [m.move_type for m in rnd.moves]
        unique_this_round = set(round_types)
        new_moves = unique_this_round - seen
        seen |= unique_this_round

        novelty_ratio = (
            len(new_moves) / len(unique_this_round)
            if unique_this_round
            else 0.0
        )

        progression.append({
            "round_num": rnd.round_num,
            "move_types": round_types,
            "new_moves": sorted(new_moves),
            "cumulative_vocab_size": len(seen),
            "novelty_ratio": novelty_ratio,
        })

    return progression
