## 1. Objective And Contract Definition

- [x] 1.1 Add `research/mpc-live-ii/objective.json` with the canonical loss formula, binary metrics, ordered layer names, learning-rate policy, and calibration tolerances
- [x] 1.2 Update `research/mpc-live-ii/README.md` so the repo documents the new objective and ordered layer contract

## 2. Harness Integration

- [x] 2.1 Update `experiments/rhino-mechanical-demo/runner.py` to load the repo-local objective, compute and persist loss, and keep candidates by lower loss
- [x] 2.2 Add fresh-crash detection and stop recording to the runner, using the current latest Rhino crash report as the seeded baseline
- [x] 2.3 Update `experiments/rhino-mechanical-demo/run_overnight.sh` and `program.md` so the loop respects a stop time of `2026-04-02 11:00:00 CEST` and points the autoresearcher at the repo-local low-learning-rate objective

## 3. Launch And Verification

- [x] 3.1 Reinitialize the experiment baseline under the new objective and verify `runner.py status` shows the loss-aware fields
- [x] 3.2 Launch the bounded unattended experiment and record the active log path and process identifier
- [x] 3.3 Verify the experiment is still running after launch and that the stop conditions are armed
