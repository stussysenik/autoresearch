"""
Strategy Graph — counter-play analysis for breaking battles.

In a breaking battle each dancer responds to their opponent's round.
The strategy graph captures *what works against what*: if dancer B's
footwork consistently beats dancer A's power moves, the graph records
that counter-play relationship with an effectiveness score.

Graph Theory Concepts
---------------------
- **Counter-play edge**: a directed edge from ``opponent_move`` to
  ``response_move`` whose weight is the empirical effectiveness (win rate
  when that response is used against the opponent move).
- **Risk level**: for each move, how many effective counters exist?
  Moves with many strong counters are risky; moves with few are safe.
  Formally: risk = mean effectiveness of all incoming counter-edges,
  weighted by count.

All functions are pure-CPU, using NetworkX for graph construction.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx
import numpy as np


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class CounterPlay:
    """A single counter-play relationship.

    Attributes
    ----------
    opponent_move : str
        The move performed by the opponent.
    response : str
        The response move used to counter it.
    effectiveness : float
        Win-rate when this response is used against the opponent move,
        normalised to [0, 1].  1.0 = always wins.
    rationale : str
        Human-readable explanation of *why* this counter works.
    """

    opponent_move: str
    response: str
    effectiveness: float
    rationale: str


@dataclass
class StrategyNode:
    """Metadata attached to each move in the strategy graph.

    Attributes
    ----------
    move : str
        The move type name.
    counters : list[CounterPlay]
        Effective responses *to* this move (incoming counter-edges).
    risk_level : float
        How risky this move is — derived from the number and strength
        of counters that exist against it.  Range [0, 1].
    """

    move: str
    counters: List[CounterPlay] = field(default_factory=list)
    risk_level: float = 0.5


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_strategy_graph(battle_data: List[Dict[str, Any]]) -> nx.DiGraph:
    """Build a counter-play graph from battle outcomes.

    Parameters
    ----------
    battle_data : list[dict]
        Each entry describes one battle round or set with the keys:

        - ``dancer_a_moves`` (list[str]): move types used by dancer A.
        - ``dancer_b_moves`` (list[str]): move types used by dancer B.
        - ``winner`` (str): ``"a"`` or ``"b"`` — who won this exchange.

    The winning dancer's moves are treated as effective counters to the
    losing dancer's moves.

    Returns
    -------
    nx.DiGraph
        Directed graph where an edge (opponent_move → response) exists
        if *response* was used as a winning counter against *opponent_move*.

        Edge attributes:
        - ``win_count`` (int): times this pair appeared in a win.
        - ``total_count`` (int): times this pair appeared at all.
        - ``effectiveness`` (float): ``win_count / total_count``.
        - ``rationale`` (str): auto-generated description.

        Node attributes:
        - ``total_appearances`` (int): total times this move was used.
        - ``win_appearances`` (int): times this move appeared on the winning side.
    """
    G = nx.DiGraph()

    # Accumulators: (opponent_move, response) → {wins, total}
    pair_wins: Dict[Tuple[str, str], int] = defaultdict(int)
    pair_total: Dict[Tuple[str, str], int] = defaultdict(int)

    # Node-level accumulators
    move_appearances: Dict[str, int] = defaultdict(int)
    move_win_appearances: Dict[str, int] = defaultdict(int)

    for entry in battle_data:
        a_moves: List[str] = entry.get("dancer_a_moves", [])
        b_moves: List[str] = entry.get("dancer_b_moves", [])
        winner: str = entry.get("winner", "").lower()

        if not a_moves or not b_moves:
            continue

        # Determine winner/loser move sets.
        if winner == "a":
            winner_moves, loser_moves = a_moves, b_moves
        elif winner == "b":
            winner_moves, loser_moves = b_moves, a_moves
        else:
            # No clear winner — still record total counts but no wins.
            for om in set(a_moves):
                for rm in set(b_moves):
                    pair_total[(om, rm)] += 1
                    pair_total[(rm, om)] += 1
            for m in set(a_moves) | set(b_moves):
                move_appearances[m] += 1
            continue

        # Record appearances.
        for m in set(winner_moves):
            move_appearances[m] += 1
            move_win_appearances[m] += 1
        for m in set(loser_moves):
            move_appearances[m] += 1

        # Every (loser_move, winner_move) pair is a counter-play observation.
        for om in set(loser_moves):
            for rm in set(winner_moves):
                pair_total[(om, rm)] += 1
                pair_wins[(om, rm)] += 1

        # Also record the reverse pairs as total (but not wins).
        for om in set(winner_moves):
            for rm in set(loser_moves):
                pair_total[(om, rm)] += 1

    # ---- build nodes ----
    all_moves = set(move_appearances.keys())
    for m in all_moves:
        G.add_node(
            m,
            total_appearances=move_appearances[m],
            win_appearances=move_win_appearances.get(m, 0),
        )

    # ---- build edges ----
    for (om, rm), total in pair_total.items():
        if total == 0:
            continue
        wins = pair_wins.get((om, rm), 0)
        eff = wins / total

        # Only create an edge if there is at least some effectiveness.
        if wins > 0:
            rationale = (
                f"{rm} countered {om} in {wins}/{total} encounters "
                f"({eff:.0%} effectiveness)"
            )
            G.add_edge(
                om,
                rm,
                win_count=wins,
                total_count=total,
                effectiveness=eff,
                rationale=rationale,
            )

    return G


# ---------------------------------------------------------------------------
# Querying
# ---------------------------------------------------------------------------

def get_counter_options(
    graph: nx.DiGraph,
    opponent_move: str,
    k: int = 3,
) -> List[CounterPlay]:
    """Return the top-*k* counter-play options against an opponent's move.

    Parameters
    ----------
    graph : nx.DiGraph
        Strategy graph built by :func:`build_strategy_graph`.
    opponent_move : str
        The opponent's move to counter.
    k : int, default 3
        Number of top counters to return.

    Returns
    -------
    list[CounterPlay]
        Counter-play options sorted by effectiveness (descending).
        Empty list if the opponent move is not in the graph.
    """
    if opponent_move not in graph:
        return []

    edges = [
        (dst, data)
        for _, dst, data in graph.out_edges(opponent_move, data=True)
    ]
    # Sort by effectiveness descending, then by win_count as tiebreaker.
    edges.sort(
        key=lambda x: (x[1].get("effectiveness", 0), x[1].get("win_count", 0)),
        reverse=True,
    )

    results: List[CounterPlay] = []
    for dst, data in edges[:k]:
        results.append(
            CounterPlay(
                opponent_move=opponent_move,
                response=dst,
                effectiveness=data.get("effectiveness", 0.0),
                rationale=data.get("rationale", ""),
            )
        )
    return results


# ---------------------------------------------------------------------------
# Risk analysis
# ---------------------------------------------------------------------------

def compute_move_risk(graph: nx.DiGraph) -> Dict[str, float]:
    """Compute a risk level for every move in the strategy graph.

    Risk is defined as the *weighted mean effectiveness of all incoming
    counter-edges*.  A move with many strong counters is risky; a move
    with no counters (or only weak ones) is safe.

    The raw risk is clipped to [0, 1].

    Parameters
    ----------
    graph : nx.DiGraph
        Strategy graph built by :func:`build_strategy_graph`.

    Returns
    -------
    dict[str, float]
        ``{move_type: risk_level}`` with values in [0, 1].
    """
    risk: Dict[str, float] = {}

    for node in graph.nodes():
        # Incoming edges represent counters *to* this node (i.e., the node
        # is the opponent_move and the counter is the predecessor).
        # Wait — in our graph, edges go FROM opponent_move TO response.
        # So incoming edges to a node mean "someone used THIS node as a
        # counter", which is the opposite of risk.
        #
        # Risk for node X = how effectively others counter X.
        # That corresponds to *outgoing* edges from X — each points to a
        # response that beats X.
        out_edges = list(graph.out_edges(node, data=True))

        if not out_edges:
            risk[node] = 0.0
            continue

        # Weighted mean: effectiveness * total_count / sum(total_count)
        total_weight = sum(d.get("total_count", 1) for _, _, d in out_edges)
        if total_weight == 0:
            risk[node] = 0.0
            continue

        weighted_eff = sum(
            d.get("effectiveness", 0.0) * d.get("total_count", 1)
            for _, _, d in out_edges
        )
        raw_risk = weighted_eff / total_weight
        risk[node] = float(np.clip(raw_risk, 0.0, 1.0))

    return risk
