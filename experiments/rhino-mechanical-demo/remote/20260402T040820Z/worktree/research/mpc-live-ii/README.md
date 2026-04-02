# MPC Live II Loop Notes

This directory records the source anchors and canonical objective used by the unattended MPC Live II loops.

## Official Anchors

- Akai official product page: https://www.akaipro.com/mpc-live-2/
- Akai official user guide PDF: https://cdn.inmusicbrands.com/akai/M2P11C6VI/MPC%20X%2C%20MPC%20Live%2C%20MPC%20Live%20II%2C%20MPC%20One%2C%20MPC%20Key%2061%2C%20MPC%20Studio%20mk2%2C%20MPC%20Touch%20-%20User%20Guide%20-%20v2.11.6.pdf

## Objective

The canonical experiment objective lives in `objective.json`.

The current loop policy is:

- optimize by minimizing `loss = (1 - binary_pass_fraction) + 0.25 * (1 - secondary_score / 100)`
- keep binary product checks primary and use the secondary score only as a small shaping term
- run at a low learning rate: one coherent product change per evaluation round
- enforce the exact ordered Rhino layers `MPCLiveII::01_Sources` through `MPCLiveII::08_Export`

## Secondary Score

The secondary score remains an honest match score built from:

- source coverage from official product and manual data
- control-anchor coverage from the manual
- CLI execution readiness for the current MPC prompt
- live export detection when Rhino actually produces an artifact
- local calibration evidence when a measured cap reference exists

That means the score measures reference quality, not fake exactness. Without a measured cap reference, the system still cannot honestly claim factory-exact geometry.

## Working Directory

- generated source pack: `var/mpc-live-ii/source-pack/`
- iteration reports: `var/mpc-live-ii/iterations/`
- logs: `var/mpc-live-ii/logs/`
