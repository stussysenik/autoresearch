# OCW Video Scraper — Experiment Results

## Winner: `parallel-32`

680 videos discovered at **21.86 videos/sec** in 31.1s.

## Benchmark Comparison

| Variant | Wall Clock | Videos | Requests | Throughput | Errors | Data |
|---------|-----------|--------|----------|------------|--------|------|
| parallel-32 | 31.1s | 680 | 13410 | 21.86 v/s | 1 | 915351 KB |

## Key Findings

- **parallel-32**: 31.1s — (baseline)

## Total Unique Videos: 680

## Recommendation

The `parallel-32` strategy should be ported to Swift for the mit-ocw-reels app.
Use Swift `TaskGroup` with concurrency matching this variant's batch size for equivalent performance.

## Swift Integration Path

1. Copy `swift/OCWScraper.swift` into the mit-ocw-reels Xcode project
2. Call `OCWScraper.scrapeAll()` from a background task on first launch
3. Insert results into SwiftData — dedup against existing seed_data
4. Schedule periodic re-scrapes via BackgroundTasks framework

---
*Generated 2026-03-21T16:24:13.733Z*
