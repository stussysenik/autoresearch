"""
Mode registry -- maps mode names to their analyzer configurations.

Each mode declares which analyzers are required vs optional. The pipeline
uses this to know what to instantiate and run. Modes register themselves
via the ``register_mode`` call at import time.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Type

from engine.analyzers.base import Analyzer


@dataclass
class ModeConfig:
    """Configuration for an analysis mode.

    Attributes:
        name: mode identifier (must match AnalysisContext.mode)
        required_analyzers: analyzer classes that MUST run for this mode
        optional_analyzers: analyzer classes that run if available
        description: human-readable explanation of the mode's purpose
    """

    name: str
    required_analyzers: List[Type] = field(default_factory=list)
    optional_analyzers: List[Type] = field(default_factory=list)
    description: str = ""


# Internal registry: mode name -> ModeConfig
_MODES: Dict[str, ModeConfig] = {}


def register_mode(config: ModeConfig) -> ModeConfig:
    """Register a mode configuration in the global registry.

    Can be called directly at module scope. Raises ValueError on duplicate names.
    """
    if config.name in _MODES:
        raise ValueError(f"Mode '{config.name}' is already registered.")
    _MODES[config.name] = config
    return config


def get_mode(name: str) -> ModeConfig:
    """Look up a registered mode by name.

    Raises KeyError with a helpful message listing available modes.
    """
    if name not in _MODES:
        available = ", ".join(sorted(_MODES.keys())) or "(none)"
        raise KeyError(f"Unknown mode '{name}'. Available: {available}")
    return _MODES[name]


def list_modes() -> List[ModeConfig]:
    """Return all registered modes."""
    return list(_MODES.values())
