# Part II: Mathematical Framework

> *"Mathematics is the language in which God has written the universe."*
> — Galileo. We apply it to the cypher.

---

## 2.0 Foundational Principle: Audio Timecode as Parent Coordinate

Every measurement in this framework is subordinate to one absolute reference: **the audio timecode of the song being danced to**.

Let $t_{\text{audio}}$ denote continuous time in seconds relative to the start of the musical track. All other coordinate systems — video frames, skeleton frames, beat positions, segment boundaries — are indexed by $t_{\text{audio}}$ via known mappings:

$$t_{\text{audio}} = \frac{f_{\text{video}}}{f_{\text{fps}}} + \Delta_{\text{sync}}$$

where $f_{\text{video}}$ is the video frame index, $f_{\text{fps}}$ is the video frame rate, and $\Delta_{\text{sync}}$ is an audio-video synchronization offset (typically $< 40\text{ms}$ for direct capture, up to $200\text{ms}$ for broadcast footage).

**Why audio is the parent, not video:**
- A dancer responds to *music*, not to frame boundaries
- Beats exist at fractional frame positions — they do not align to video temporal grid
- The song has a fixed duration $T_{\text{song}}$ — this is the absolute maximum points canvas
- All scoring is computed as integrals over $t_{\text{audio}} \in [0, T_{\text{song}}]$

A full song = the maximum achievable score. A round is a window into that canvas. The dancer's performance is a trajectory through 3D space indexed by audio time.

---

## 2.1 The Movement Representation: 3D Joint Trajectory Tensor

### 2.1.1 Raw Skeleton Tensor

From 3D reconstruction (GVHMR/JOSH), we obtain a joint position tensor:

$$\mathbf{J} \in \mathbb{R}^{F \times K \times 3}$$

where $F$ is the number of frames, $K$ is the number of joints ($K = 22$ for SMPL body, $K = 127$ for full SMPLX with hands), and $3$ is the spatial dimension $(x, y, z)$ in world-grounded meters.

### 2.1.2 Velocity Tensor — Central Differences

$$\mathbf{V}(f) = \frac{\mathbf{J}(f+1) - \mathbf{J}(f-1)}{2\Delta t} \in \mathbb{R}^{K \times 3}$$

where $\Delta t = 1 / f_{\text{fps}}$.

### 2.1.3 Acceleration Tensor

$$\mathbf{A}(f) = \frac{\mathbf{V}(f+1) - \mathbf{V}(f-1)}{2\Delta t} \in \mathbb{R}^{K \times 3}$$

### 2.1.4 Per-Joint Speed Signal

$$s_k(f) = \|\mathbf{V}(f, k, :)\|_2 \in \mathbb{R}_{\geq 0}$$

### 2.1.5 Total Movement Energy

$$M(f) = \sum_{k=1}^{K} s_k(f) = \sum_{k=1}^{K} \|\mathbf{V}(f, k, :)\|_2$$

This is the scalar time series that represents "how much the dancer is moving" at each frame.

### 2.1.6 Savitzky-Golay Denoising

3D reconstruction introduces noise ($\sim 57\text{mm}$ MPJPE for GVHMR, $\sim 175\text{mm}$ W-MPJPE for JOSH). Raw velocity signals have poor SNR. We apply Savitzky-Golay filtering per joint per axis:

$$\tilde{s}_k(f) = \text{SG}\left(s_k,\ w=31,\ p=3\right)$$

At 30fps with $w=31$: effective cutoff $\approx 2.9\text{Hz}$. This preserves move-level rhythm while suppressing reconstruction jitter.

**Parameter sensitivity** (validated in EXP-007):

| SG Window $w$ | $\mu$ (toprock) | Beat Align % | H1 Pass? |
|---------------|-----------------|-------------|----------|
| 11 | 0.649 | 91.3% | Yes |
| 15 | 0.644 | 100.0% | Yes |
| 21 | 0.440 | 91.3% | Yes |
| **31 (default)** | **0.380** | 23.2% | **Yes** |
| 41 | 0.123 | 53.6% | No |

---

## 2.2 The Audio Representation: 8-Dimensional Psychoacoustic Signature

From the MATLAB 8D engine (`dance-hit-audio-signature-matlab-playground`), we extract per-window feature vectors:

$$\mathbf{D}(t) = \begin{bmatrix} D_1(t) \\ D_2(t) \\ \vdots \\ D_8(t) \end{bmatrix} \in [0, 1]^8$$

| Index $i$ | Dimension $D_i$ | Extraction Method | What it captures |
|-----------|-----------------|-------------------|------------------|
| 1 | BPM stability | Autocorrelation tempo tracking | Is the tempo steady or fluctuating? |
| 2 | Bass energy | Bandpass 20–250 Hz, RMS | Low-frequency power — the "weight" of the track |
| 3 | Vocal presence | Spectral centroid + HNR in 300–3400 Hz | Is there a human voice layer? |
| 4 | Beat strength | Onset detection envelope peaks | How percussive/prominent are the beats? |
| 5 | Spectral flux | Euclidean distance between spectral frames | How much is the timbre changing? |
| 6 | Rhythm complexity | Onset density + inter-onset variance | Simple 4/4 vs polyrhythmic |
| 7 | Harmonic richness | Harmonic peak count + spectral flatness | Melodic/harmonic density |
| 8 | Dynamic range | Crest factor (peak/RMS) | Quiet-to-loud contrast |

### 2.2.1 Audio Hotness Signal

$$H(t) = \sum_{i=1}^{8} w_i \cdot D_i(t)$$

Default weights: $w_i = 1/8$ (uniform). Configurable for context:

| Context | $w_{\text{bass}}$ | $w_{\text{beats}}$ | $w_{\text{vocal}}$ | $w_{\text{rest}}$ |
|---------|--------|--------|--------|-------|
| Club/battle | 0.30 | 0.30 | 0.05 | 0.35/5 |
| Practice | 0.15 | 0.20 | 0.10 | 0.55/5 |
| Showcase | 0.20 | 0.15 | 0.15 | 0.50/5 |

### 2.2.2 Hot Threshold

Segments where $H(t) > \bar{H} + \sigma_H$ are classified as **hot** — approximately the top 16% of audio energy moments. These are the moments where a dancer *should* be doing something significant.

### 2.2.3 The Pipeline Inside the 8D Engine

The MATLAB engine processes audio through a deterministic pipeline:

$$\text{audioLoad} \to \text{windowSegment} \to \text{extractFeatures} \to \text{normalizeFeatures} \to \text{computeHotness}$$

**Segmentation**: 500ms windows with 50% overlap → ~39 segments per 10-second track.

**Normalization**: Per-track min-max scaling ensures each dimension is $[0,1]$, making cross-track comparison meaningful despite different mastering levels.

**Beat detection (independent path)**: BeatNet+ operates on the raw audio stream, producing beat timestamps $\{b_k\}$ with confidence scores. This is a separate signal from the 8D features — beats are *events*, while $D_i(t)$ are *continuous descriptors*.

**The relationship between beats and hotness**: A "hot" moment ($H > \bar{H} + \sigma_H$) is not necessarily a beat, and a beat is not necessarily hot. The 8D engine captures **overall energy density** — a sustained bass drop can be hot without distinct beats; a sparse percussion break has strong beats but low hotness. The musicality coefficient $\mu$ correlates movement with hotness $H(t)$, not with individual beats. Beat alignment is a separate analysis (beat utilization rate in Part IV).

### 2.2.4 The Musicology Behind the Dimensions

The 8 dimensions are not arbitrary signal processing features. Each maps to a musically meaningful property:

**Rhythm layer** ($D_1$, $D_4$, $D_6$):
- BPM stability: DJs select tracks with stable tempo for battles — fluctuations disrupt timing
- Beat strength: The "punch" of the percussion — funk breaks score high; ambient electronica scores low
- Rhythm complexity: Polyrhythmic tracks (afrobeat, Latin funk) demand more from the dancer

**Timbral layer** ($D_3$, $D_5$, $D_7$):
- Vocal presence: When an MC is on the track, dancers often respond to vocal cadence
- Spectral flux: Tracks that evolve (James Brown, BDP) create natural dynamic arcs for choreography
- Harmonic richness: Melodic content provides opportunities for expressive movement

**Physical layer** ($D_2$, $D_8$):
- Bass energy: The "weight" a dancer feels through the floor — directly influences power move timing
- Dynamic range: Quiet-loud contrasts create the space for dramatic transitions

This decomposition is the musicological foundation. The 8D engine is not a black box — every dimension has a musical justification that practitioners can understand and critique.

---

## 2.3 The Musicality Coefficient $\mu$

### 2.3.1 Cross-Correlation Definition

Given the movement energy signal $M(t)$ and audio hotness signal $H(t)$, both normalized to zero mean and unit variance:

$$C(\tau) = \frac{\sum_t \left(M(t) - \bar{M}\right)\left(H(t+\tau) - \bar{H}\right)}{\sqrt{\sum_t \left(M(t) - \bar{M}\right)^2 \cdot \sum_t \left(H(t+\tau) - \bar{H}\right)^2}}$$

### 2.3.2 Musicality Score

$$\boxed{\mu = \max_{\tau \in [-\tau_{\max},\, +\tau_{\max}]} C(\tau)}$$

where $\tau_{\max} = 200\text{ms}$, bounded by human reaction time to musical beats.

### 2.3.3 Optimal Lag

$$\tau^* = \arg\max_\tau C(\tau)$$

**Interpretation of $\tau^*$:**

| $\tau^*$ range | Meaning | Level |
|----------------|---------|-------|
| $\tau^* < -30\text{ms}$ | Dancer **anticipates** the beat — elite skill | World-class |
| $|\tau^*| \leq 30\text{ms}$ | Dancer is **on** the beat | Advanced |
| $\tau^* > 30\text{ms}$ | Dancer **reacts** to the beat | Developing |

### 2.3.4 What $\mu$ Measures (and What It Doesn't)

$\mu$ measures **frequency-domain alignment** between movement and audio. A dancer who consistently moves at the BPM will score high even if phase-shifted. This is **by design**:

- A dancer who is consistently early is still musical — $\tau^*$ captures the offset
- The discriminative comparison is **on-beat vs. random** (41× separation), not on-beat vs. off-beat
- Phase sensitivity would penalize stylistic choices (dancing between beats, syncopation)

### 2.3.5 Stability Score

$$S = \text{clip}\left(\bar{C}_{\text{local}} - \text{std}(C_{\text{local}}),\ 0,\ 1\right)$$

where $C_{\text{local}}$ are cross-correlation peaks computed over sliding windows of width $\lfloor T/4 \rfloor$. This measures whether musicality is sustained throughout the round or occurs only in bursts.

---

## 2.4 The Full Score: Energy, Coverage, and Composite Analysis

### 2.4.1 3D Spatial Coverage — The Heatmap

The dancer's trajectory through 3D space, projected onto the floor plane, generates a **spatial coverage heatmap**:

$$\mathcal{H}(x, z) = \sum_{f=1}^{F} \mathcal{N}\left(\mathbf{J}(f, \text{root}, :)\ \Big|\ \mu=(x, z),\ \sigma=0.1\text{m}\right)$$

This is a 2D Gaussian kernel density estimate of the dancer's root position over time. The **coverage area** is:

$$A_{\text{coverage}} = \iint \mathbb{1}\left[\mathcal{H}(x,z) > \theta\right]\, dx\, dz$$

where $\theta = 0.1 \cdot \max(\mathcal{H})$.

**What this captures**: A dancer who uses the full circle (cypher) scores higher than one who stays in a corner. Stage usage is a real criterion in battle judging.

### 2.4.2 Kinetic Energy Profile

$$E_k(f) = \frac{1}{2}\sum_{k=1}^{K} m_k \cdot s_k(f)^2$$

where $m_k$ is an approximate mass for body segment $k$ (from SMPL morphable model). This gives a **physical energy trajectory** — how much mechanical work the dancer is doing over time.

### 2.4.3 Flow Score — Transition Smoothness

$$F = \frac{1}{N_{\text{trans}}}\sum_{i=1}^{N_{\text{trans}}} \exp\left(-\frac{\|\mathbf{V}_{\text{post}}(i) - \mathbf{V}_{\text{pre}}(i)\|}{\bar{s}}\right)$$

where $N_{\text{trans}}$ is the number of detected segment transitions, and $\bar{s}$ is the mean speed. This measures how smoothly the dancer transitions between move types — high flow means no jarring stops or restarts.

### 2.4.4 The Composite Round Score

The round score is **not a single number**. It is a vector:

$$\mathbf{R} = \begin{bmatrix} \mu \\ S \\ A_{\text{coverage}} \\ E_k \\ F \\ \tau^* \end{bmatrix}$$

Each component is independently interpretable. The TRIVIUM framework (Part IV) maps these components to judging criteria. No component is collapsed into a "total score" — that would destroy information.

---

## 2.5 Move Signatures: Tensor-Based Fingerprinting

### 2.5.1 The 96-Dimensional Move Embedding

Each detected move instance is embedded into a 96-dimensional vector:

$$\mathbf{z}_{\text{move}} = \begin{bmatrix} \mathbf{z}_{\text{pose}} \\ \mathbf{z}_{\text{spectral}} \end{bmatrix} \in \mathbb{R}^{96}$$

where:
- $\mathbf{z}_{\text{pose}} \in \mathbb{R}^{64}$: PCA-reduced pose descriptor from the joint trajectory tensor over the move's temporal window
- $\mathbf{z}_{\text{spectral}} \in \mathbb{R}^{32}$: FFT coefficients of the movement energy signal over the same window

### 2.5.2 Rotation Physics for Power Moves

For moves involving axial rotation (headspins, 1990s, windmills), we compute:

**Angular momentum:**

$$\mathbf{L}(t) = \sum_{k} \mathbf{r}_k(t) \times m_k \mathbf{v}_k(t)$$

**Moment of inertia about the rotation axis:**

$$I(t) = \sum_{k} m_k \cdot d_k(t)^2$$

where $d_k(t)$ is the perpendicular distance from joint $k$ to the rotation axis.

**Angular velocity:**

$$\omega(t) = \frac{L(t)}{I(t)}$$

**Ice skater effect**: A well-executed 1990s shows $I(t)$ decreasing (legs tucking) with $\omega(t)$ increasing proportionally, conserving $L(t)$. This is measurable, biomechanically grounded, and discriminating of skill level.

### 2.5.3 Move Signature Distance

$$d(\mathbf{z}_1, \mathbf{z}_2) = \left\|\mathbf{z}_1 - \mathbf{z}_2\right\|_2$$

Euclidean distance in the 96-dimensional embedding space. Moves of the same type cluster tightly; moves of different types are well-separated.

### 2.5.4 Signature Similarity — Cosine

$$\text{sim}(\mathbf{z}_1, \mathbf{z}_2) = \frac{\mathbf{z}_1 \cdot \mathbf{z}_2}{\|\mathbf{z}_1\| \cdot \|\mathbf{z}_2\|}$$

Used for the knowledge pool nearest-neighbor queries.

---

## 2.6 Derivative Signal Quality — SNR

The **derivative signal-to-noise ratio** quantifies how much of the velocity signal is real motion vs. reconstruction noise:

$$\text{SNR}_{\text{deriv}} = 10 \log_{10}\left(\frac{\mathbb{E}[\mathbf{V}_{\text{clean}}^2]}{\mathbb{E}[(\mathbf{V}_{\text{raw}} - \mathbf{V}_{\text{clean}})^2]}\right) \text{dB}$$

**Requirements:**

| Movement type | Required SNR | Achievable (GVHMR) | Achievable (JOSH) |
|--------------|-------------|--------------------|--------------------|
| Toprock | $> 4.8$ dB | $\sim 7.2$ dB | $\sim 9.1$ dB |
| Footwork | $> 4.8$ dB | $\sim 5.8$ dB | $\sim 8.3$ dB |
| Power moves | $> 4.8$ dB | $\sim 2.1$ dB | $\sim 3.5$ dB |
| Freezes | $> 4.8$ dB | $\sim 12.0$ dB | $\sim 14.2$ dB |

Power moves remain below the SNR threshold with current reconstruction models. This is the honest limit.

---

## 2.7 Alignment Metrics Summary

$$\text{AudioMotionMetrics} = \begin{bmatrix} \mu & \text{alignment peak} \\ \tau^* & \text{optimal lag (ms)} \\ S & \text{alignment stability} \\ \text{SNR}_{\text{deriv}} & \text{derivative SNR (dB)} \\ E_v & \text{velocity energy} \\ E_a & \text{acceleration energy} \end{bmatrix}$$

All six metrics are computed per-segment, per-round, per-dancer. They form the mathematical basis for TRIVIUM scoring (Part IV) and the knowledge pool queries (Part V).

---

## 2.8 3D Point Cloud Tensor Analysis

### 2.8.1 Why Point Clouds, Not Keypoints

The joint trajectory tensor $\mathbf{J} \in \mathbb{R}^{F \times K \times 3}$ is a **time-indexed 3D point cloud**. Each frame is a configuration of $K$ points in $\mathbb{R}^3$. Rather than reducing to scalar descriptors early, we preserve the full tensor structure as long as possible.

This is critical because:
- **Scalar metrics destroy geometry**: Two dancers can have the same total movement energy $M(t)$ with completely different spatial patterns
- **Joint correlations matter**: The distance between left wrist and right ankle during a windmill encodes technique quality
- **Temporal coherence is structure**: The trajectory of the center of mass through 3D space is a curve, not a sequence of independent points

### 2.8.2 The Full Round as a 4D Tensor

A complete round is a 4D tensor:

$$\mathcal{T} \in \mathbb{R}^{F \times K \times 3 \times C}$$

where $F$ = frames, $K$ = joints, $3$ = spatial coordinates, and $C$ = channels (position, velocity, acceleration). This is the fundamental data structure — everything else is a projection or reduction of $\mathcal{T}$.

### 2.8.3 Tensor Decomposition for Round Comparison

Two rounds (dancer A vs. dancer B) can be compared via tensor decomposition:

$$\mathcal{T}_A \approx \sum_{r=1}^{R} \lambda_r \cdot \mathbf{a}_r \circ \mathbf{b}_r \circ \mathbf{c}_r \circ \mathbf{d}_r$$

where $\circ$ denotes outer product, $R$ is the rank, and $(\mathbf{a}, \mathbf{b}, \mathbf{c}, \mathbf{d})$ are factor vectors for temporal, joint, spatial, and channel modes respectively.

The dominant components $\lambda_1, \lambda_2, \ldots$ capture the primary modes of variation — typically corresponding to gross body movement, arm expressiveness, and leg rhythm.

**Round similarity** via tensor distance:

$$d_{\text{tensor}}(\mathcal{T}_A, \mathcal{T}_B) = \left\| \mathcal{T}_A - \mathcal{T}_B \right\|_F = \sqrt{\sum_{f,k,j,c} \left(\mathcal{T}_A(f,k,j,c) - \mathcal{T}_B(f,k,j,c)\right)^2}$$

This is the Frobenius norm of the difference tensor. It respects the full geometry — no information loss.

### 2.8.4 Invariant Descriptors

To compare rounds across different dancers, venues, and camera setups, we need invariants:

**Center-of-mass-relative coordinates:**

$$\tilde{\mathbf{J}}(f,k,:) = \mathbf{J}(f,k,:) - \frac{1}{K}\sum_{k'=1}^{K} \mathbf{J}(f,k',:)$$

**Scale normalization:**

$$\hat{\mathbf{J}}(f,k,:) = \frac{\tilde{\mathbf{J}}(f,k,:)}{\max_{k'} \|\tilde{\mathbf{J}}(f,k',:)\|_2}$$

These invariants remove dependence on absolute position, body size, and camera distance — enabling fair comparison across dancers.

### 2.8.5 The Song-Matching Composite

The round score is not difficulty-by-committee. It is the **matching signature between the dancer's 3D point cloud trajectory and the song's energy landscape**, both indexed by $t_{\text{audio}}$:

$$\text{Match}(t) = \text{sim}\left(\mathbf{R}_{\text{movement}}(t),\ \mathbf{R}_{\text{audio}}(t)\right)$$

where $\mathbf{R}_{\text{movement}}(t)$ and $\mathbf{R}_{\text{audio}}(t)$ are the movement and audio representations at time $t$, projected into a shared latent space. The integral over the song:

$$\text{RoundMatch} = \frac{1}{T_{\text{song}}}\int_0^{T_{\text{song}}} \text{Match}(t)\, dt$$

This is the composite: how well does the dancer's 3D trajectory through space match the song's energy signature, integrated over the full timecode canvas. No subjective difficulty ratings. Pure tensor geometry × audio energy.

---

*Next: [Part III — Technical Architecture](03-ARCHITECTURE.md)*
