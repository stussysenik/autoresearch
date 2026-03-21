"""
Phase 3: DSPy Calibration — Optimize Gemma 3 tag classification with DSPy.

Uses BootstrapFewShot and MIPROv2 to find the best prompt + few-shot
configuration for the student model (Gemma 3 12B), guided by teacher
reasoning traces from GLM 4.7.
"""

from .metrics import (
    blocked_tag_check,
    format_check,
    make_composite_metric,
    tag_f1,
    taxonomy_adherence,
)
from .modules import TagClassifier
from .signatures import TagClassification, build_signature

__all__ = [
    "TagClassification",
    "TagClassifier",
    "blocked_tag_check",
    "build_signature",
    "format_check",
    "make_composite_metric",
    "tag_f1",
    "taxonomy_adherence",
]
