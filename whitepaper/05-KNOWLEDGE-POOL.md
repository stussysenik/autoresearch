# Part V: The Move Knowledge Pool, BreakDex, and Community Systems

> *"Every nasty moment deserves a name."*

---

## 5.0 The Vision: A Global Dictionary of Breaking Movement

Breaking has no dictionary. No authoritative catalog of moves, combinations, and moments. Every culture with a language develops reference works — dictionaries, grammars, thesauri. Breaking has existed for 50+ years without one.

**BreakDex** is that dictionary. The Move Knowledge Pool is its search engine.

Together, they solve three community problems:

1. **Naming**: Moves get invented in cyphers worldwide. The same move has different names in different scenes. BreakDex provides a shared reference anchored to movement signatures, not words.
2. **Discovery**: "Who does a nasty transition from windmill to chair freeze?" — a query against the vector pool, answered in milliseconds.
3. **Preservation**: An original practitioner's movement vocabulary, captured as 96-dimensional embeddings, persists beyond their performing career.

---

## 5.1 BreakDex — The Application Layer

BreakDex is an iOS application (SwiftUI + SwiftData) running on-device. It serves as the community-facing interface to the Knowledge Pool.

### 5.1.1 Core Data Model

```
Move ──< ComboMove >── Combo      (many-to-many)
Move ──< Review                    (one-to-many)
```

- **Move**: A single named technique (e.g., "Windmill", "Headspin")
- **Combo**: A sequence of moves (e.g., "Toprock → Swipe → Windmill → Freeze")
- **Review**: Spaced-repetition learning state (NEW → LEARNING → MASTERY)

### 5.1.2 On-Device Features

| Feature | Implementation |
|---------|---------------|
| Move recording | Video picker → trim → categorize |
| Combo building | Timeline view → drag moves into sequence |
| Spaced repetition | Review mode: AGAIN / HARD / GOOD ratings |
| AI move naming | Apple Foundation Models (iOS 26+, on-device) |
| Move analysis | PoseOverlayView (Vision framework keypoints) |
| Balance analysis | Accelerometer-based stability scoring |

### 5.1.3 The AI Move Suggester

When a dancer records a new move and needs a name, the on-device language model suggests:

```
System: "You are a breakdancing move naming assistant. 
         Suggest a single creative move name (1-3 words).
         Draw from b-boy culture."
Temperature: 1.2 (high creativity)
```

This runs **entirely on-device** via Apple Foundation Models — no network, no API key, no data leaves the phone.

---

## 5.2 The Move Knowledge Pool — Vector Similarity Architecture

### 5.2.1 The Move Embedding

Each move instance is encoded as a 96-dimensional vector:

$$\mathbf{z}_{\text{move}} = \begin{bmatrix} \mathbf{z}_{\text{pose}} \in \mathbb{R}^{64} \\ \mathbf{z}_{\text{spectral}} \in \mathbb{R}^{32} \end{bmatrix}$$

**Pose component** ($\mathbf{z}_{\text{pose}}$):
1. Extract joint trajectory tensor $\mathbf{J} \in \mathbb{R}^{T \times K \times 3}$ over the move's temporal window
2. Reshape to $\mathbf{J}_{\text{flat}} \in \mathbb{R}^{T \cdot 3K}$
3. Apply PCA, retain top 64 components

**Spectral component** ($\mathbf{z}_{\text{spectral}}$):
1. Compute $M(t)$ over the move's temporal window
2. Apply Hanning window, FFT
3. Retain top 32 frequency coefficients (power spectrum)

### 5.2.2 Indexing — O(1) Lookup

The pool uses a **quantized hash index** for sub-linear nearest-neighbor search:

1. Quantize each dimension into $B = 16$ bins
2. Build a compound hash key from the bin indices
3. Query: hash the query vector, retrieve candidates from matching buckets, rank by cosine similarity

$$\text{key}(\mathbf{z}) = \left\lfloor \frac{\mathbf{z} - \mathbf{z}_{\min}}{\mathbf{z}_{\max} - \mathbf{z}_{\min}} \cdot B \right\rfloor$$

For exact nearest-neighbor at scale, upgrade to FAISS IVF-PQ (inverted file with product quantization). The hash index is the zero-dependency starting point.

### 5.2.3 Query Types

| Query | Input | Output | Use case |
|-------|-------|--------|----------|
| `query(vec, K)` | 96-dim vector | Top-K similar moves | "Find moves like this one" |
| `queryHot(K)` | — | Top-K highest-energy moves | "Show me the nastiest moments" |
| `queryBPMRange(lo, hi, K)` | BPM bounds | Top-K within tempo | "What works at 125 BPM?" |
| `queryByDimension(dim, min, max, K)` | Feature bounds | Top-K matching | "High bass energy moves" |
| `querySimilarToSegment(song, seg, K)` | Audio reference | Top-K similar | "Find this transition elsewhere" |

### 5.2.4 Culture-First Design Constraints

The Knowledge Pool is not a surveillance system. It follows these rules:

1. **Opt-in contribution**: Dancers explicitly choose to add their moves to the pool
2. **Attribution**: Every move signature carries a creator field (if the contributor chooses)
3. **Embargo periods**: Contributors can set time delays before their signatures become searchable (e.g., "don't publish until after BC One finals")
4. **Cultural sensitivity**: Moves with specific cultural significance (e.g., totem-inspired freezes from Indigenous practitioners) carry metadata about origin and appropriate context
5. **Community governance**: The pool's taxonomy is maintained by a community advisory board, not by researchers

---

## 5.3 Cross-Song Audio Matching — The DJ Layer

From the MATLAB 8D engine, we also compute **cross-song similarity**:

$$\text{sim}(i, j) = \cos\left(\bar{\mathbf{D}}_i^{\text{hot}},\ \bar{\mathbf{D}}_j^{\text{hot}}\right)$$

where $\bar{\mathbf{D}}_i^{\text{hot}}$ is the mean feature vector of hot segments in song $i$.

This produces an $N \times N$ similarity matrix across all tracks, enabling:

- **DJ blend recommendations**: 
  $$\text{Score} = \alpha \cdot \text{BPM}_{\text{compat}} + \beta \cdot \text{Key}_{\text{compat}} + \gamma \cdot \text{Energy}_{\text{match}} + \delta \cdot \text{Spectral}_{\text{complement}}$$
- **DTW alignment**: Dynamic Time Warping aligns feature sequences between song pairs despite tempo variations
- **Battle track analysis**: Which sections of a track are "hottest" — where should a dancer plan their biggest moves?

---

## 5.4 Transition Graphs — Vocabulary and Strategy

### 5.4.1 Per-Dancer Transition Graph

From a dancer's round, build a directed graph:

$$G = (V, E, W)$$

- $V$ = set of observed move types (toprock variants, footwork patterns, power moves, freezes)
- $E$ = observed transitions between move types
- $W(e)$ = count of times transition $e$ was observed

### 5.4.2 Style Signature

From the graph, extract features:

| Feature | Formula | What it reveals |
|---------|---------|----------------|
| Degree centrality | $\sum_j A_{ij}$ | How connected is the vocabulary |
| Graph entropy | $H(G)$ | Predictability of transitions |
| Power ratio | $\frac{|V_{\text{power}}|}{|V|}$ | Power-heavy vs. footwork-heavy |
| Clustering coefficient | $\frac{2 \cdot \text{triangles}}{\text{triplets}}$ | Interconnected vocabulary |

### 5.4.3 Battle DAG — Counter-Play Analysis

In a battle, two dancers' graphs are overlaid chronologically:

$$G_{\text{battle}} = G_A \cup G_B \cup E_{\text{response}}$$

where $E_{\text{response}}$ captures which moves dancer B used in response to dancer A's moves. This enables:

- **Counter-play analysis**: "When A did footwork, B responded with power — did it work?"
- **Momentum arcs**: Energy trajectory $E_k(t)$ for both dancers on the same timeline
- **Strategic patterns**: Does a dancer always open with toprock? Always close with a freeze?

---

## 5.5 The Big Pool — Scale Considerations

### 5.5.1 Expected Data Volumes

| Source | Moves/clip | Clips/year | Annual vectors |
|--------|-----------|------------|----------------|
| BRACE dataset | ~8 | 1,352 segments | ~10,000 |
| Red Bull BC One (historic) | ~15 | ~50 battles | ~7,500 |
| Community contributions | ~5 | ~10,000 practitioners | ~50,000 |
| Practice recordings | ~3 | ~100,000 sessions | ~300,000 |

At scale: **~370,000 vectors/year**. Each is 96 dimensions × 8 bytes = 768 bytes. Total: ~280 MB/year. Fits in RAM on any modern laptop.

### 5.5.2 FAISS at Scale

For >100K vectors, upgrade from hash index to FAISS IVF-PQ:

```python
import faiss

d = 96
nlist = 100  # number of Voronoi cells
m = 8        # number of sub-quantizers
k_bits = 8   # bits per sub-quantizer

index = faiss.IndexIVFPQ(faiss.IndexFlatL2(d), d, nlist, m, k_bits)
index.train(move_vectors)
index.add(move_vectors)

# Query: top-10 nearest neighbors in <1ms
D, I = index.search(query_vector, 10)
```

### 5.5.3 Community Integration with BreakDex

```
BreakDex (iOS)
├── Record move → extract video
├── Auto-generate 96-dim signature (on-device Vision framework)
├── Optional: contribute to Knowledge Pool (opt-in)
├── Local vocabulary tracking (learning states)
└── Combo builder (timeline view)
     │
     ▼ (if opted in)
Knowledge Pool (server)
├── FAISS vector index
├── BreakDex taxonomy (community-governed)
├── Attribution + embargo metadata
└── Query API: "find similar", "find nasty", "find at BPM"
     │
     ▼
Community benefits
├── "Who moves like me in Seoul?"
├── "What's the nastiest windmill-to-freeze transition ever recorded?"
├── "I invented this — here's proof (timestamped signature)"
└── "My teacher's vocabulary, preserved"
```

---

## 5.6 What Community Gets Back

| Stakeholder | What they gain | Tool |
|-------------|---------------|------|
| **Dancer** | Self-study, vocabulary tracking, progression | BreakDex app + local analysis |
| **Crew** | Shared vocabulary library, combo sharing | BreakDex crew mode |
| **Judge** | Reproducible musicality baseline | TRIVIUM breakdown (Part IV) |
| **Coach** | Quantified practice sessions | Move drill mode |
| **Event** | Big-screen replay, commentary support | Post-round PDF |
| **Community** | Knowledge preservation, cross-scene connection | Knowledge Pool + BreakDex |
| **Researcher** | First quantitative breaking dataset | BRACE-aligned benchmarks |

---

*Next: [Part VI — Verification & Experimental Results](06-VERIFICATION.md)*
