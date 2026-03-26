"""
Graph Engine — graph-theoretic analysis for breaking (bboy) movement data.

Turns move sequences, battle results, and dancer histories into directed
graphs that reveal transition patterns, personal style fingerprints,
strategic counter-play relationships, and battle flow structure.

Modules
-------
transition   - Markov chain model of move-to-move transitions
style        - Per-dancer style signature via graph metrics
strategy     - Counter-play graph for battle strategy analysis
battle_flow  - Hierarchical DAG of battle → rounds → moves
metrics      - General graph-theoretic metrics and comparison tools
"""

from graphs.transition import (
    MoveEvent,
    build_transition_graph,
    get_top_transitions,
    get_transition_matrix,
    steady_state_distribution,
)
from graphs.style import (
    StyleSignature,
    compute_style_signature,
    style_similarity,
    compare_styles,
)
from graphs.strategy import (
    CounterPlay,
    StrategyNode,
    build_strategy_graph,
    get_counter_options,
    compute_move_risk,
)
from graphs.battle_flow import (
    BattleRound,
    BattleDAG,
    build_battle_dag,
    compute_momentum_arc,
    compute_vocabulary_progression,
)
from graphs.metrics import (
    compute_centrality_metrics,
    detect_communities,
    graph_summary,
    compare_graphs,
)

__all__ = [
    # transition
    "MoveEvent",
    "build_transition_graph",
    "get_top_transitions",
    "get_transition_matrix",
    "steady_state_distribution",
    # style
    "StyleSignature",
    "compute_style_signature",
    "style_similarity",
    "compare_styles",
    # strategy
    "CounterPlay",
    "StrategyNode",
    "build_strategy_graph",
    "get_counter_options",
    "compute_move_risk",
    # battle_flow
    "BattleRound",
    "BattleDAG",
    "build_battle_dag",
    "compute_momentum_arc",
    "compute_vocabulary_progression",
    # metrics
    "compute_centrality_metrics",
    "detect_communities",
    "graph_summary",
    "compare_graphs",
]
