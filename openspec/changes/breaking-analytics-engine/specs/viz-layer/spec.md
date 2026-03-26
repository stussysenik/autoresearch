# Viz Layer

## ADDED Requirements

### Requirement: CLI quick-look display

Terminal-based visualization using `rich` library: tables for scores, sparklines for time series, colored bars for feature distributions. Output fits in a standard terminal (80-120 columns).

#### Scenario: Display move drill results
- **WHEN** `cli_display(results, mode="move_drill")` is called after analysis
- **THEN** the terminal shows a formatted table with TRIVIUM sub-scores, a sparkline for energy over time, and a colored bar showing move type distribution

#### Scenario: Display battle comparison
- **WHEN** `cli_display(results, mode="battle_eval")` is called with two-dancer results
- **THEN** the terminal shows a side-by-side comparison table with per-dimension scores, winner indicators, and differential sparklines

### Requirement: Matrix heatmap visualization

Matplotlib heatmaps for comparing MoveSignatures: signature-vs-signature distance matrix, feature correlation matrix, transition probability matrix.

#### Scenario: Render signature distance matrix
- **WHEN** `plot_distance_matrix(signatures, output="distance.png")` is called with N signatures
- **THEN** an N×N heatmap PNG is saved with move labels on axes, color-coded by distance, with dendrogram clustering on margins

### Requirement: Graph visualization

NetworkX + matplotlib rendering of move graphs: transition networks (force-directed layout), style signatures (radial layout), battle flow DAGs (hierarchical layout).

#### Scenario: Render transition graph
- **WHEN** `plot_transition_graph(graph, output="transitions.png")` is called
- **THEN** a force-directed graph PNG is saved with node sizes proportional to frequency, edge widths proportional to transition probability, and nodes colored by move family

#### Scenario: Render style comparison
- **WHEN** `plot_style_comparison(style_a, style_b, output="styles.png")` is called
- **THEN** a side-by-side radial graph PNG is saved showing each dancer's vocabulary distribution and transition patterns

### Requirement: Energy and momentum time series

Matplotlib line plots for time-domain analysis: angular momentum L(t), kinetic energy E(t), moment of inertia I(t), angular velocity omega(t). Overlaid with beat markers and move phase boundaries.

#### Scenario: Plot 1990s rotation physics
- **WHEN** `plot_energy_series(rotation_result, output="1990s_physics.png")` is called
- **THEN** a multi-panel plot is saved showing L_z(t), I(t), omega(t), and CoM drift, with annotations for spin entry/exit and leg tuck/extend events

### Requirement: Pitch-ready PDF export

Multi-panel PDF combining all relevant visualizations for a single analysis into a presentation-ready document. Includes title, context, and insight annotations.

#### Scenario: Export battle analysis pitch
- **WHEN** `export_pitch_pdf(results, output="battle_pitch.pdf")` is called after a battle_eval analysis
- **THEN** a PDF is generated with: cover page (battle info), page 2 (TRIVIUM comparison), page 3 (signature distance matrix), page 4 (transition graphs per dancer), page 5 (musicality timeline)

#### Scenario: PDF generation speed
- **WHEN** a full battle analysis pitch PDF is generated
- **THEN** the PDF is created in < 30 seconds on CPU

### Requirement: Data export (JSON/CSV)

Raw results export for downstream tools: JSON for programmatic consumption, CSV for spreadsheet analysis.

#### Scenario: Export analysis as JSON
- **WHEN** `export_json(results, output="results.json")` is called
- **THEN** all numeric arrays are serialized as lists, all metadata is preserved, and the JSON is valid and parseable
