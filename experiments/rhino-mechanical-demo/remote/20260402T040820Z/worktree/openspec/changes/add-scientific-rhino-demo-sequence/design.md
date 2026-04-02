## Overview

The scientific demo creates a deterministic shell-like specimen from a fresh Rhino session. The script makes the construction legible by drawing a 2D spiral guide first, pausing briefly, adding section curves, lifting those sections into 3D, lofting a closed shell form, generating a final mesh assembly, switching to a presentation-friendly view, and exporting an STL artifact.

## Shape Choice

The shape is a scientific shell built from a logarithmic spiral and lifted circular sections. This is intentionally more scientific than the organic blob while still using robust RhinoCommon operations:

- 2D axis and spiral guide curves
- deterministic section curves on the guide
- lifted 3D section curves
- lofted and capped shell form
- final render mesh assembly

This gives a clear narrative from 2D to 3D without relying on brittle freeform sculpting APIs.

## Live Demo Sequence

1. Start in a clean Rhino document for the session.
2. Draw an axis line and a deterministic parabolic profile curve in a planar construction view.
3. Pause and redraw so the profile is visibly established.
4. Lift section curves into 3D and rotate them in controlled increments.
5. Loft and cap the final shell form.
6. Create a smooth mesh from the final geometry.
7. Remove or hide construction geometry.
8. Switch to a presentation view, set rendered display mode, and frame the final mesh by bounds.
9. Save the Rhino document and export an STL artifact to a deterministic path.

## Determinism

The shell dimensions derive entirely from `size_mm`:

- spiral scale: fixed proportion of `size_mm`
- spiral turn count and sample count: fixed constants
- section radii: fixed progression based on section index
- lift offsets and per-section rotation: fixed proportions of `size_mm`

There is no randomization, no AI-side geometry generation, and no dependency on existing document contents.

## Export Strategy

The live script will generate a final mesh assembly and export an STL file under `var/real-rhino/exports/`. The exported artifact path will be returned in the script result so the CLI can surface it with the live response.

The export path should be unique per run and derived from the session plus request tag to avoid stale artifact reuse.

## Viewport Strategy

Use a best-effort visual sequence:

- start in a planar guide view when available
- switch to `Perspective` after the revolve
- use `Rendered` display mode when available
- frame by the final mesh bounding box through RhinoCommon

The viewport path should improve the live demo without becoming a hard dependency for successful geometry creation.
