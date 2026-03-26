"""
Pipeline orchestrator -- topological sort + execution.

Given an AnalysisContext, the pipeline:
1. Looks up the mode from the registry to get required analyzers
2. Instantiates each analyzer class
3. Resolves execution order via topological sort on depends_on
4. Runs analyzers in dependency order, storing results in context
5. Returns the context with all results populated

Raises MissingDependencyError if an analyzer depends on something
that is not provided by any analyzer in the pipeline.
"""
from __future__ import annotations

from collections import deque
from typing import Dict, List, Type

from engine.analyzers.base import Analyzer
from engine.context import AnalysisContext
from engine.registry import get_mode


class MissingDependencyError(Exception):
    """Raised when an analyzer's dependency cannot be satisfied."""

    def __init__(self, analyzer_name: str, missing: str):
        self.analyzer_name = analyzer_name
        self.missing = missing
        super().__init__(
            f"Analyzer '{analyzer_name}' depends on '{missing}', "
            f"but no analyzer in the pipeline provides it."
        )


class CircularDependencyError(Exception):
    """Raised when analyzers form a dependency cycle."""

    def __init__(self, cycle_members: set):
        self.cycle_members = cycle_members
        super().__init__(
            f"Circular dependency among analyzers: {', '.join(sorted(cycle_members))}"
        )


def _topological_sort(analyzers: List[Analyzer]) -> List[Analyzer]:
    """Kahn's algorithm -- sort analyzers by dependency order.

    Each analyzer's depends_on lists the names of analyzers that must
    run before it. Returns a list in valid execution order.
    Raises MissingDependencyError if a dependency is not satisfiable.
    """
    # Build name -> analyzer mapping
    by_name: Dict[str, Analyzer] = {a.name: a for a in analyzers}
    provided: set = set(by_name.keys())

    # Validate all dependencies are satisfiable
    for analyzer in analyzers:
        for dep in analyzer.depends_on:
            if dep not in provided:
                raise MissingDependencyError(analyzer.name, dep)

    # Build adjacency and in-degree
    in_degree: Dict[str, int] = {a.name: 0 for a in analyzers}
    dependents: Dict[str, List[str]] = {a.name: [] for a in analyzers}

    for analyzer in analyzers:
        for dep in analyzer.depends_on:
            dependents[dep].append(analyzer.name)
            in_degree[analyzer.name] += 1

    # BFS from nodes with zero in-degree
    queue: deque[str] = deque()
    for name, degree in in_degree.items():
        if degree == 0:
            queue.append(name)

    ordered: List[Analyzer] = []
    while queue:
        name = queue.popleft()
        ordered.append(by_name[name])
        for dependent in dependents[name]:
            in_degree[dependent] -= 1
            if in_degree[dependent] == 0:
                queue.append(dependent)

    if len(ordered) != len(analyzers):
        # Circular dependency -- find the cycle participants
        remaining = {a.name for a in analyzers} - {a.name for a in ordered}
        raise CircularDependencyError(remaining)

    return ordered


def run_pipeline(ctx: AnalysisContext) -> AnalysisContext:
    """Execute the full analysis pipeline for the given context.

    Steps:
    1. Resolve mode -> required + optional analyzers
    2. Instantiate analyzer classes
    3. Topological sort by depends_on
    4. Run each analyzer, store result in ctx.results
    5. Return the populated context
    """
    mode_config = get_mode(ctx.mode)

    # Collect all analyzer classes for this mode
    analyzer_classes: List[Type] = list(mode_config.required_analyzers)
    for cls in mode_config.optional_analyzers:
        if cls not in analyzer_classes:
            analyzer_classes.append(cls)

    # Deduplicate by name, with Protocol enforcement
    seen_names: set = set()
    analyzers: List[Analyzer] = []
    for cls in analyzer_classes:
        instance = cls()
        if not isinstance(instance, Analyzer):
            raise TypeError(
                f"{cls.__name__} does not conform to the Analyzer Protocol "
                f"(missing: name, depends_on, or analyze method)"
            )
        if instance.name not in seen_names:
            analyzers.append(instance)
            seen_names.add(instance.name)

    # Sort by dependency order
    sorted_analyzers = _topological_sort(analyzers)

    # Execute in order
    for analyzer in sorted_analyzers:
        result = analyzer.analyze(ctx)
        ctx.results[analyzer.name] = result

    return ctx
