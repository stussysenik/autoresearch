# Appendix A: Capture Setup Recipes

Quick-reference cards for each capture condition.

---

## Recipe 1: iPhone Solo (Practice / Self-Study)

```
WHAT YOU NEED:
  - iPhone 15/16 Pro
  - Tripod + phone mount ($20-80)
  - Internet access (for cloud GPU upload)

SETTINGS:
  - Video: 1080p @ 120fps
  - Exposure: Lock if possible (tap and hold)
  - Orientation: Horizontal (landscape)
  - Position: ~3m from dance area, waist height

WORKFLOW:
  1. Set up tripod, frame the full body
  2. Start recording, play music from a speaker
  3. Dance your round
  4. Stop recording
  5. Upload to cloud GPU (Lightning AI / RunPod)
  6. Wait ~5 minutes
  7. Download joints_3d.npy
  8. Run scoring locally (python scripts, < 60s)

COST: $0 hardware + ~$2-5/event cloud GPU
QUALITY: Good for toprock/footwork. Power moves degraded.
```

---

## Recipe 2: GoPro Floor Level (Outdoor Cypher)

```
WHAT YOU NEED:
  - GoPro Hero 12+ (or similar action cam)
  - Small tripod or mount
  - 1080p @ 120fps capability

SETTINGS:
  - Resolution: 1080p
  - Frame rate: 120fps
  - Mode: Linear (NOT Wide — disables fisheye distortion)
  - Position: Floor level, 2-3m from cypher center

WORKFLOW:
  1. Place GoPro at floor level, angled up ~15°
  2. Record the full session
  3. Extract rounds later in post
  4. Same cloud GPU pipeline as iPhone

COST: $300-400 hardware + ~$5-10/event cloud GPU
QUALITY: Good wide-angle coverage. Floor perspective can distort
         vertical measurements. Acceptable for most analysis.
LIMITATION: Audio quality may be poor (wind, crowd noise)
            → use separate audio recording if possible
```

---

## Recipe 3: GH5 Event Rig (Competition)

```
WHAT YOU NEED:
  - Panasonic GH5 (used, ~$800)
  - 12mm f/1.4 prime lens (~$300)
  - Sturdy tripod (~$150)
  - RTX 4090 laptop (ASUS ROG, ~$2500)
  - Portable monitor (~$200)
  - USB-C SSD (~$150)

CRITICAL SETTINGS:
  - Resolution: 1080p (NOT 4K — unnecessary, slows pipeline)
  - Frame rate: 120fps
  - Color profile: Rec.709 (NOT V-Log)
  - Lens: Fixed prime (zoom changes break SLAM)
  - Exposure: Manual if possible
  - Shutter: 1/250s (reduces motion blur at 120fps)
  - White balance: Locked
  - Focus: Manual, pre-focused on dance floor

WORKFLOW:
  1. Set up GH5 on tripod at ~4m from battle area
  2. Frame to include full circle with margin
  3. HDMI capture to laptop (live feed)
  4. Record to SSD simultaneously
  5. Real-time: RTMPose skeleton overlay on monitor
  6. Post-round: Full GVHMR pipeline (~2-3 min)
  7. Display TRIVIUM breakdown between rounds

COST: ~$4,300 total rig
QUALITY: Best single-camera quality. Camera shake eliminated.
         Suitable for broadcast replay analysis.
```

---

## Recipe 4: Multi-iPhone Array (Budget Multi-Cam)

```
WHAT YOU NEED:
  - 2-3× iPhone (any model with 1080p60+)
  - 2-3× phone mounts / tripods
  - Clapperboard or hand-clap for sync

POSITIONS:
  Camera 1: Front, ~3m, waist height (primary)
  Camera 2: Side, ~3m, waist height (occlusion recovery)
  Camera 3: Elevated, ~4m, 30° angle (spatial analysis)

SYNC:
  1. All cameras recording
  2. Clapperboard clap (or loud hand clap) in view of all cameras
  3. Dance
  4. Sync in post using audio waveform peak

WORKFLOW:
  1. Process each camera through pipeline independently
  2. Align using sync point
  3. Triangulate 3D positions from multiple 2D projections
  4. Better power move coverage through occlusion from different angles

COST: $0 if phones already owned + ~$10/event cloud GPU
QUALITY: Surprisingly good for triangulation.
         Best bang-for-buck multi-cam setup.
```

---

## Recipe 5: Drone Elevated (Outdoor Events)

```
WHAT YOU NEED:
  - DJI Mini 4 Pro or similar (sub-250g)
  - FAA/ASA registration (if required in your region)

SETTINGS:
  - Resolution: 1080p
  - Frame rate: 60fps (120fps crops on most drones)
  - Height: 3-5m
  - Angle: 30° down from horizontal
  - Mode: Hover (NOT tracking — we need static camera)

CRITICAL NOTES:
  - Audio from drone is USELESS (rotors) → separate audio recording
  - 60fps is below ideal (120fps) → footwork analysis limited
  - Wind causes subtle drift → accept slight camera motion
  - Check local regulations before flying indoors

WORKFLOW:
  1. Launch drone, position over cypher
  2. Switch to video, record session
  3. Separate audio: phone on ground near speaker
  4. Sync audio to video in post (waveform matching)
  5. Process through pipeline

COST: $500-800 hardware + cloud GPU
QUALITY: Excellent for spatial coverage analysis.
         Good for overall energy/musicality.
         Limited for fine-grained footwork analysis.
```

---

## Universal Post-Processing Pipeline

Regardless of capture source:

```
1. ffmpeg -i input.mp4 -vn -ar 44100 -ac 1 audio.wav
   → Extract audio

2. Upload video to cloud GPU (if not already there)
   → Run full pipeline: SAM3 → CoTracker3 → Sapiens → GVHMR/JOSH
   → Download joints_3d.npy (~5MB)

3. python score.py \
     --joints joints_3d.npy \
     --audio audio.wav \
     --fps 30 \
     --brace-labels segments.json \
     --output report.pdf
   → TRIVIUM breakdown, musicality timeline, move signatures

4. python knowledge_pool.py add \
     --joints joints_3d.npy \
     --dancer "anonymous" \
     --event "local cypher 2026-04-15"
   → Contribute to pool (opt-in)
```

---

## Sync Checklist (All Setups)

- [ ] Camera(s) rolling BEFORE music starts
- [ ] Clapperboard or hand-clap visible/audible to all cameras
- [ ] Music playing from a single source (not phone + laptop simultaneously)
- [ ] Frame rate locked (not "auto")
- [ ] Exposure locked if possible
- [ ] White balance locked
- [ ] Focus locked
- [ ] Storage has enough space (10 min @ 120fps ≈ 4GB)
- [ ] Battery charged (>30 min recording time)
