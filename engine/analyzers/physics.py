"""
PhysicsAnalyzer -- biomechanical physics computations.

Depends on the motion analyzer for skeleton data in the context.
Computes angular momentum L(t), center of mass trajectory, angular
velocity per bone, and kinetic energy -- the physical quantities
that underpin power moves, freezes, and transitions in breaking.
"""
from __future__ import annotations

import sys
import os
from typing import Any, Dict, List

import numpy as np

from engine.analyzers.base import Analyzer, AnalysisResult
from engine.context import AnalysisContext

# Import physics functions from existing analyze_motion module
_EXPERIMENT_DIR = os.path.join(
    os.path.dirname(__file__), os.pardir, os.pardir,
    "experiments", "bboy-battle-analysis",
)
_EXPERIMENT_DIR = os.path.abspath(_EXPERIMENT_DIR)
if _EXPERIMENT_DIR not in sys.path:
    sys.path.insert(0, _EXPERIMENT_DIR)

import analyze_motion as _motion_mod  # noqa: E402


class PhysicsAnalyzer:
    """Compute biomechanical physics from skeleton joint data.

    Outputs:
    - angular_momentum: L(t) vector [T, 3] -- total angular momentum
    - angular_momentum_magnitude: |L(t)| scalar [T]
    - center_of_mass: weighted COM trajectory [T, 3]
    - bone_angular_velocity: per-bone angular velocity [T, n_bones]
    - kinetic_energy: 0.5 * sum(m_j * v_j^2) per frame [T]
    - com_velocity: center of mass velocity [T, 3]
    - com_speed: center of mass speed [T]

    Depends on "motion" so the motion analyzer runs first, but reads
    skeleton data directly from the context (not from motion results).
    """

    name: str = "physics"
    depends_on: List[str] = ["motion"]

    def analyze(self, ctx: AnalysisContext) -> AnalysisResult:
        joints = ctx.get_primary_skeleton()
        joints = np.asarray(joints, dtype=np.float64)
        fps = ctx.fps

        # Velocities via central difference
        velocities = np.gradient(joints, axis=0) * fps

        # Speed per joint: [T, 24]
        speed = np.linalg.norm(velocities, axis=-1)

        # Center of mass: weighted average of joint positions -> [T, 3]
        com = _motion_mod.compute_center_of_mass(joints)

        # COM velocity and speed
        com_velocity = np.gradient(com, axis=0) * fps
        com_speed = np.linalg.norm(com_velocity, axis=-1)

        # Angular momentum: L(t) = sum_j (r_j x (m_j * v_j)) -> [T, 3]
        angular_momentum = _motion_mod.compute_angular_momentum(joints, velocities, com)
        angular_momentum_mag = np.linalg.norm(angular_momentum, axis=-1)

        # Bone angular velocity: angular speed per bone pair -> [T, n_bones]
        bone_angular_velocity = _motion_mod.compute_bone_angular_velocity(joints, fps)

        # Kinetic energy: 0.5 * sum(m_j * |v_j|^2) -> [T]
        joint_weights = _motion_mod.JOINT_WEIGHTS
        kinetic_energy = 0.5 * ((speed ** 2) @ joint_weights)

        # Summary metrics
        mean_ke = float(np.mean(kinetic_energy))
        peak_ke = float(np.max(kinetic_energy))
        mean_angmom = float(np.mean(angular_momentum_mag))
        peak_angmom = float(np.max(angular_momentum_mag))
        mean_bone_angvel = float(np.mean(bone_angular_velocity))
        peak_bone_angvel = float(np.max(bone_angular_velocity))

        return AnalysisResult(
            analyzer_name=self.name,
            data={
                "n_bones": bone_angular_velocity.shape[1],
                "bone_pairs": [list(pair) for pair in _motion_mod.BONE_PAIRS],
            },
            metrics={
                "mean_kinetic_energy": mean_ke,
                "peak_kinetic_energy": peak_ke,
                "mean_angular_momentum": mean_angmom,
                "peak_angular_momentum": peak_angmom,
                "mean_bone_angular_velocity": mean_bone_angvel,
                "peak_bone_angular_velocity": peak_bone_angvel,
                "mean_com_speed": float(np.mean(com_speed)),
                "peak_com_speed": float(np.max(com_speed)),
            },
            arrays={
                "angular_momentum": angular_momentum,
                "angular_momentum_magnitude": angular_momentum_mag,
                "center_of_mass": com,
                "com_velocity": com_velocity,
                "com_speed": com_speed,
                "bone_angular_velocity": bone_angular_velocity,
                "kinetic_energy": kinetic_energy,
                "joint_speed": speed,
            },
            metadata={
                "fps": fps,
                "n_frames": int(joints.shape[0]),
            },
        )
