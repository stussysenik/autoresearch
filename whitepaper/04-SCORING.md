# Part IV: Scoring — The TRIVIUM Framework

> *"You can't judge soul with a ruler. But you can measure whether the body heard the music."*

---

## 4.0 Why Not a Single Score?

Breaking is not figure skating. A single composite number destroys the information that matters most. Two dancers can have the same "total score" with completely different profiles:

| Dancer | $\mu$ | Coverage | Energy | Flow |
|--------|-------|----------|--------|------|
| A (power specialist) | 0.22 | 0.8 m² | High | Low |
| B (musicality specialist) | 0.65 | 0.3 m² | Medium | High |

Collapsing these to one number loses the difference. Our scoring is **vector-valued**.

---

## 4.1 TRIVIUM: Body / Soul / Mind

The TRIVIUM framework maps quantitative metrics to the three dimensions that practitioners and judges already use:

### Body (40%) — Technical Execution

| Metric | Weight | What it measures |
|--------|--------|-----------------|
| Kinetic energy $E_k$ | 0.30 | How much physical work the dancer produces |
| Spatial coverage $A$ | 0.25 | Floor/circle usage |
| Derivative SNR | 0.20 | Movement cleanliness (smooth vs. noisy) |
| Segment-appropriate quality | 0.25 | Freeze stability, powermove consistency, footwork speed |

**Segment-specific Body metrics:**

| Segment | Primary Body metric |
|---------|-------------------|
| Toprock | Groove consistency, amplitude variation, weight transfer |
| Footwork | Speed, ground contact patterns, COM stability |
| Powermove | Cyclic consistency, spin count, $I(t)$ profile |
| Freeze | Hold duration, body line, balance stability |

### Soul (35%) — Musicality

| Metric | Weight | What it measures |
|--------|--------|-----------------|
| $\mu$ (musicality coefficient) | 0.40 | Movement-audio alignment |
| $S$ (stability) | 0.25 | Sustained musicality vs. bursts |
| $\tau^*$ (lag) | 0.20 | Anticipation vs. reaction |
| Beat utilization rate | 0.15 | Fraction of "hot" audio moments the dancer hits |

**The Soul score is the innovation.** Nobody else computes this. It formalizes what every practitioner evaluates intuitively: *did the dancer hear the music and respond?*

### Mind (25%) — Composition & Strategy

| Metric | Weight | What it measures |
|--------|--------|-----------------|
| Flow score $F$ | 0.30 | Transition smoothness between segments |
| Vocabulary diversity | 0.25 | Number of distinct move types used |
| Transition graph entropy | 0.25 | Unpredictability of move sequences |
| Energy arc shape | 0.20 | Build → peak → resolution (not flat) |

The transition graph is a directed graph $G = (V, E)$ where vertices are move types and edges are observed transitions. Entropy:

$$H(G) = -\sum_{v \in V} p(v) \sum_{w} p(w|v) \log_2 p(w|v)$$

High entropy = unpredictable = strategically interesting.

---

## 4.2 Segment-Aware Scoring

BRACE (ECCV 2022) provides ground-truth segment annotations for Red Bull BC One footage. Each frame is labeled:

| Segment | BRACE label | Scoring emphasis |
|---------|-------------|-----------------|
| Toprock | `toprock` | Soul (groove), Body (consistency) |
| Drop/entry | `transition` | Mind (surprise), Body (control) |
| Footwork | `footwork` | Body (speed), Soul (syncopation) |
| Power move | `powermove` | Body (rotation physics), Mind (difficulty choice) |
| Freeze | `freeze` | Body (stability), Soul (timing — freeze on the beat?) |
| Burn | various | Mind (strategic targeting) |

**Each segment is scored independently.** A round's TRIVIUM breakdown is:

$$\text{TRIVIUM} = \sum_{s \in \text{segments}} w_s \cdot \mathbf{R}_s$$

where $w_s$ is the segment duration weight and $\mathbf{R}_s$ is the score vector for segment $s$.

---

## 4.3 Alignment with WDSF Olympic Criteria

| WDSF Criterion | TRIVIUM Mapping | Quantified by |
|----------------|-----------------|--------------|
| Technique | Body | $E_k$, SNR, segment quality |
| Variety | Mind (vocabulary) | Move type count, graph entropy |
| Performance | Body + Soul | Energy, coverage, $\mu$ |
| **Musicality** | **Soul** | **$\mu$, $S$, $\tau^*$, beat utilization** |
| Creativity | Mind (strategy) | Transition entropy, energy arc |
| Performativity | Body + Soul | All metrics combined |

The key insight: **Musicality** maps directly to our Soul dimension with four quantitative metrics. This is the gap the MTS framework fills.

---

## 4.4 Per-Joint Musicality Decomposition

$\mu$ can be computed per-joint, revealing which body parts drive musicality:

$$\mu_k = \max_\tau \text{corr}(s_k(t),\ H(t-\tau))$$

Typical findings from BC One data:

| Joint | $\mu_k$ (toprock) | Role |
|-------|-------------------|------|
| Right wrist | 0.62 | Expressive, follows beat |
| Left wrist | 0.58 | Mirror (slightly less dominant) |
| Right ankle | 0.51 | Stepping rhythm |
| Left ankle | 0.48 | Mirror |
| Head | 0.44 | Nodding/groove |
| Torso (root) | 0.38 | Overall bounce |
| Right knee | 0.35 | Weight transfer |
| Left elbow | 0.31 | Arm pump |

Arms are more musical than legs. This matches practitioner intuition — arm movements carry more of the musical conversation.

---

## 4.5 The Round Canvas — Full Song Maximum

A round is bounded by the song. The maximum achievable score is the integral over the full song duration:

$$\text{RoundScore}_{\max} = \int_0^{T_{\text{song}}} \mathbf{R}_{\text{ideal}}(t)\, dt$$

where $\mathbf{R}_{\text{ideal}}(t)$ represents perfect performance at every time step.

The dancer's actual score is the fraction of this canvas they cover with quality movement:

$$\text{RoundScore} = \frac{\int_0^{T_{\text{song}}} \mathbf{R}(t) \cdot \mathbb{1}[\text{active}]\, dt}{\int_0^{T_{\text{song}}} \mathbf{R}_{\text{ideal}}(t)\, dt}$$

This naturally penalizes:
- **Dead time** (standing around, not dancing)
- **Off-beat sections** (moving but not with the music)
- **Repetitive vocabulary** (same moves, low entropy)
- **Poor coverage** (staying in one spot)

And naturally rewards:
- **Full-song engagement** (dancing the entire round)
- **Musicality** (hitting hot moments)
- **Vocabulary breadth** (diverse moves)
- **Spatial usage** (using the full circle)

---

## 4.6 Subjective Body Predispositions — The Fairness Layer

Different bodies generate different forces. A 60kg bboy and a 90kg bboy produce different kinetic energy for the same windmill. The framework normalizes for this:

$$\tilde{E}_k = \frac{E_k}{m_{\text{dancer}} \cdot g \cdot h_{\text{COM}}}$$

This normalizes kinetic energy by the dancer's potential energy, producing a dimensionless measure that compares **movement efficiency** rather than raw force. A lighter dancer doing a clean windmill scores similarly to a heavier dancer doing the same windmill.

Similarly, spatial coverage is normalized by the available space:

$$\tilde{A} = \frac{A_{\text{coverage}}}{A_{\text{cypher}}}$$

A dancer in a small cypher isn't penalized compared to one in a large venue.

---

## 4.7 Energy Arc and Flow Change Detection

### 4.7.1 The Energy Arc Shape

A championship round is not flat. It has shape — a narrative arc. The kinetic energy profile $E_k(t)$ should show:

$$\text{Arc}(t) = \frac{d E_k}{dt} \bigg/ E_k(t)$$

This dimensionless rate of change captures whether a round is:
- **Building**: $\text{Arc}(t) > 0$ — energy increasing, getting more intense
- **Sustained**: $\text{Arc}(t) \approx 0$ — holding a high plateau
- **Resolving**: $\text{Arc}(t) < 0$ — energy decreasing, coming down
- **Flat**: $\text{Arc}(t) \approx 0$ with low $E_k$ — dead time, not dancing

**Ideal arc shape**: Build → Peak → Resolution (like a song structure). Detected via:

$$\text{ArcScore} = \text{corr}\left(\text{Arc}(t),\ \text{Arc}_{\text{ideal}}(t)\right)$$

where $\text{Arc}_{\text{ideal}}$ is a canonical build-peak-resolve template parameterized by $T_{\text{song}}$.

### 4.7.2 Flow Change Points

Flow changes are moments where the dancer shifts between movement modes. We detect them via rate-of-change in the movement energy derivative:

$$\Delta(f) = \left\|\mathbf{V}(f+1) - \mathbf{V}(f)\right\|_F$$

A flow change is detected when $\Delta(f)$ exceeds $\bar{\Delta} + 2\sigma_\Delta$. These are the **structural moments** in the round — transitions from toprock to footwork, drops into power moves, holds into freezes.

### 4.7.3 Flow Change Alignment with Audio

The most skillful dancers align their flow changes with musically significant moments. We measure:

$$\text{FlowAlign} = \frac{1}{N_{\text{flow}}} \sum_{i=1}^{N_{\text{flow}}} \max_{b \in \text{beats}} \exp\left(-\frac{(t_{\text{flow}}(i) - t_{\text{beat}}(b))^2}{2\sigma_t^2}\right)$$

This is the fraction of flow changes that occur near beat positions. High FlowAlign = the dancer uses the music's structure to organize their round. Low FlowAlign = the round is musically disconnected from the track.

---

## 4.8 The Song-Matching Signature

The round is not judged by subjective difficulty. It is judged by how well the dancer's 3D point cloud trajectory matches the song's energy signature.

**Song signature**: From the 8D engine, we extract the song's energy landscape as a time series of 8-dimensional vectors $\mathbf{D}(t)$.

**Movement signature**: From the skeleton tensor, we extract a matching-dimensional representation — the movement energy profile, spatial coverage rate, and angular velocity envelope.

**The match** is computed as the integral of their similarity over the song duration:

$$\text{SongMatch} = \frac{1}{T_{\text{song}}} \int_0^{T_{\text{song}}} \text{sim}\left(\mathbf{S}_{\text{dance}}(t),\ \mathbf{S}_{\text{song}}(t)\right) dt$$

where $\mathbf{S}_{\text{dance}}$ and $\mathbf{S}_{\text{song}}$ are the dance and song representations projected into a shared latent space (via PCA on concatenated features).

This is the composite metric. It answers: *did the dancer become the physical embodiment of the music for the duration of the round?*

---

*Next: [Part V — Vector Knowledge Pool & BreakDex](05-KNOWLEDGE-POOL.md)*
