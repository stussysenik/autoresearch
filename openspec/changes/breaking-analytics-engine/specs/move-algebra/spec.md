# Move Algebra

## ADDED Requirements

### Requirement: MoveSignature dataclass

Every analyzed move produces a `MoveSignature` — a structured mathematical fingerprint containing pose hash (PCA-reduced), spectral envelope (FFT of joint velocities), angular profile (angular momentum over time), energy curve (kinetic energy over time), and contact sequence.

#### Scenario: Extract signature from skeleton segment
- **WHEN** `extract_signature(joints_3d, fps=30, move_type="power")` is called with a `[T, 24, 3]` numpy array
- **THEN** a `MoveSignature` is returned with all fields populated, all arrays normalized to [0, 1] range

#### Scenario: Signature is compact
- **WHEN** a MoveSignature is created from a 300-frame skeleton segment
- **THEN** the total memory footprint is < 10KB (pose_hash is PCA-reduced to K=16 components, spectral_envelope to F=32 frequency bins)

### Requirement: Pose hash via PCA reduction

The pose sequence `[T, 24, 3]` is flattened to `[T, 72]`, PCA-reduced to `[T, K]` (K=16), then further compressed to a fixed-length descriptor via temporal statistics (mean, std, min, max per component → `[K*4]` = 64-dim vector).

#### Scenario: Two similar poses produce similar hashes
- **WHEN** two toprock sequences from the same dancer are hashed
- **THEN** their cosine similarity is > 0.8

#### Scenario: Different move types produce different hashes
- **WHEN** a toprock and a power move are hashed
- **THEN** their cosine similarity is < 0.5

### Requirement: Spectral envelope via FFT

Joint velocities are computed, FFT is applied per joint group (legs, torso, arms, head), and the magnitude spectrum is averaged across groups to produce a `[F]` frequency fingerprint capturing the movement's rhythm.

#### Scenario: Periodic moves have dominant frequency peaks
- **WHEN** a windmill (repetitive rotation) is spectrally analyzed
- **THEN** the spectral envelope shows a clear dominant peak at the rotation frequency

### Requirement: Similarity distance metrics

The algebra provides `move_distance(sig_a, sig_b) -> float` computing weighted distance across signature components. Configurable weights per component allow emphasizing technique vs. rhythm vs. energy.

#### Scenario: Distance is symmetric
- **WHEN** `move_distance(a, b)` and `move_distance(b, a)` are computed
- **THEN** the values are equal

#### Scenario: Same move type is closer than different
- **WHEN** distances are computed between two freezes and between a freeze and a toprock
- **THEN** the freeze-freeze distance is strictly less than the freeze-toprock distance

### Requirement: Move clustering

Given a collection of MoveSignatures, `cluster_moves(signatures, method="dbscan")` groups them into clusters. Supports DBSCAN (density-based, no preset K) and spectral clustering (graph-based, for finding structural communities).

#### Scenario: Known move types cluster together
- **WHEN** 50 labeled signatures (10 each of toprock, footwork, power, freeze, transition) are clustered
- **THEN** the clustering achieves adjusted Rand index > 0.7 against the ground truth labels

### Requirement: Taxonomy mapping

Clusters are mapped to the breaking taxonomy (toprock/footwork/power/freeze/transition) via nearest-centroid classification against labeled exemplars.

#### Scenario: Classify an unlabeled move
- **WHEN** an unlabeled MoveSignature is classified against the taxonomy
- **THEN** it returns the predicted move_type with a confidence score in [0, 1]
