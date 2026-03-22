# Testing Strategies — Web Research Summary (2026-03-22)

## The Testing Diamond (Not Pyramid)
- Old pyramid (lots of unit, few E2E) is dead
- Modern shape: diamond — fat middle with integration tests, thin top and bottom
- Kent C. Dodds: "The more your tests resemble the way your software is used, the more confidence they can give you"
- "Write tests. Not too many. Mostly integration."
- Stop at ~70% coverage. Integration tests give best confidence-to-effort ratio.

## Real-World Network Testing (Playwright)
- CDP-based `Network.emulateNetworkConditions`: 3G, offline, wifi presets (Chromium-only)
- Route-level delay injection works cross-browser: `page.route('**/api/*', async route => { await delay(3000); route.continue() })`
- Go offline mid-session: `cdp.send('Network.emulateNetworkConditions', { offline: true })`
- Mobile device profiles built-in: `devices['iPhone 14']` (viewport, touch, user agent, scale)

## Real APIs vs Mocks
- Industry converged on hybrid: real APIs for critical paths, mocks for edge cases/speed
- Cypress Real World App uses predominantly real backends
- $4.7M production failure from mock-only testing (real API had different pagination)
- Pipeline: mocked (every commit) → contract tests (every PR) → real API smoke (before merge) → full E2E staging (nightly)

## Real Database Testing
- Testcontainers: each test file gets own Docker Postgres with snapshot/restore
- Transaction-based: seed once, rollback per test (near-unit-test speed with real DB)
- Neon Testing: provisions Neon branches per test file (serverless)

## WebSocket / Real-Time Testing
- Test: connection lifecycle, message round-trip, error handling (invalid JSON → code 1008), reconnection, concurrent clients
- K6 for load testing WebSockets
- Playwright can intercept WebSocket frames and SSE
- Deterministic assertions: "round-trip < 100ms", "reconnect within 3 attempts"

## Contract Testing (Pact)
- Consumer defines expectations, provider verifies independently
- Fast, deterministic, high-signal
- Top tools 2026: Pact, Spring Cloud Contract, Specmatic
- Fills gap between "full integration test" and "mock everything"

## ML/CV/Audio Testing
- Golden datasets with tolerance thresholds (Jaccard similarity, Kendall Tau, cosine similarity, Levenshtein distance)
- Three behavioral test types:
  - **Invariance**: perturbations don't change output (flip image → same move detected)
  - **Directional**: known shifts predictably change output (add rotation → angle changes)
  - **Minimum functionality**: canonical inputs always work (clear headstand photo → always detected)
- Pin golden set version — changing it = changing the eval

## Chaos / Stress Testing
- gremlins.js: random monkey testing (click, type, scroll randomly for 30s)
- MSW: network failure injection
- chaos-fetch: fetch-level failures
- Gremlin: CDN blackholes, latency injection
- Fitness-compatible via threshold: "0 unhandled exceptions after 30s of gremlins"

## TDD for Autonomous Loops
- TDFlow research: 94.3% success rate when agents get human-written tests
- Three isolated subagents (test-writer, implementer, refactorer) with context isolation
- TDAD: auto-improvement loops going from 12% to 60% resolution
- Simon Willison: Red/Green TDD pattern for agentic coding

## Sources
- kentcdodds.com (Testing Trophy)
- playwright.dev (network conditions, device emulation)
- cypress.io (Real World App)
- testcontainers.com
- pact.io (Contract Testing)
- arxiv.org/html/2510.23761v1 (TDFlow)
- arxiv.org/html/2603.17973v1 (TDAD)
- arxiv.org/html/2411.13768v2 (EDD)
- simonwillison.net (Red/Green TDD)
- addyo.substack.com (The 80% Problem)
- latent.space (Anita TDD podcast)
