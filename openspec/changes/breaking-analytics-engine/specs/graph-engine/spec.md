# Graph Engine

## ADDED Requirements

### Requirement: Move transition graph (Markov chain)

A weighted directed graph where nodes are move types (or specific moves) and edges represent observed transitions with probability weights. Built from sequential move data in the BRACE dataset.

#### Scenario: Build transition graph from BRACE segments
- **WHEN** `build_transition_graph(segments)` is called with labeled move sequences from 64 dancers
- **THEN** a NetworkX DiGraph is returned with move types as nodes and transition probabilities as edge weights, where outgoing edges from each node sum to 1.0

#### Scenario: Query most likely next move
- **WHEN** `graph.successors("toprock")` is queried with edge weights
- **THEN** the transitions are ranked by probability (e.g., toprock → footwork: 0.45, toprock → power: 0.30, toprock → freeze: 0.25)

### Requirement: Style signature graph

A per-dancer subgraph capturing their unique vocabulary and transition preferences. Graph-theoretic metrics (degree distribution, clustering coefficient, average path length, most central node) become the dancer's "style fingerprint."

#### Scenario: Compare two dancers' styles
- **WHEN** style signatures are computed for Dancer A (power-heavy) and Dancer B (footwork-heavy)
- **THEN** their graph similarity score is < 0.5, and the most-central-node differs (power vs footwork)

#### Scenario: Style fingerprint is stable
- **WHEN** a dancer's style signature is computed from two different battles
- **THEN** the graph similarity between the two signatures is > 0.7

### Requirement: Strategy graph (counter-play tree)

A tree structure mapping "if opponent does X" → "effective responses Y1, Y2, Y3" with effectiveness scores derived from battle outcome data.

#### Scenario: Query counter-play options
- **WHEN** `strategy_graph.counter("power_combo")` is called
- **THEN** returns ranked response options with effectiveness scores (e.g., "technical_footwork": 0.8, "creative_freeze": 0.7, "power_escalation": 0.5)

### Requirement: Battle flow DAG

A directed acyclic graph representing the temporal structure of a battle: rounds → sets → move sequences, with timing and momentum annotations.

#### Scenario: Build battle DAG from round data
- **WHEN** `build_battle_dag(battle_data)` is called with round/set/move annotations
- **THEN** a DAG is returned where nodes at each level (round, set, move) link to their children, with edge attributes for duration and energy metrics

#### Scenario: Compute momentum arc
- **WHEN** the battle DAG is queried for momentum across rounds
- **THEN** returns a time series showing energy/intensity trajectory through the battle (e.g., building, peaking, declining)

### Requirement: Graph metrics module

Computes standard graph-theoretic metrics for any move graph: betweenness centrality (most important transition node), clustering coefficient (how cliquey the vocabulary), PageRank (most influential move), and community detection (move families).

#### Scenario: Find most central move
- **WHEN** betweenness centrality is computed on the transition graph
- **THEN** returns the move type that acts as the key connector between different move families (likely "transition" or "footwork")

#### Scenario: Detect move communities
- **WHEN** community detection (Louvain) is run on the transition graph
- **THEN** returns 2-4 communities that align with breaking's natural move families (ground moves, air moves, standing moves)
