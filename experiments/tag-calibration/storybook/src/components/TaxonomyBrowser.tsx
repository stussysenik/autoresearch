import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { TagChip } from "./TagChip";
import type { Taxonomy, Category, CategoryId } from "../data/taxonomy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaxonomyBrowserProps {
  /** The full taxonomy to render */
  taxonomy: Taxonomy;
  /** Categories that start expanded (all collapsed by default) */
  defaultExpanded?: CategoryId[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CategorySectionProps {
  category: Category;
  isExpanded: boolean;
  onToggle: () => void;
}

const categoryAccent: Record<CategoryId, string> = {
  primary: "border-green-300",
  contextual: "border-blue-300",
  style: "border-purple-300",
};

function CategorySection({
  category,
  isExpanded,
  onToggle,
}: CategorySectionProps) {
  const Icon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={`rounded-lg border-l-4 bg-white ${categoryAccent[category.id]} overflow-hidden`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <Icon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="font-semibold text-gray-900">{category.label}</span>
        <span className="ml-auto text-xs text-gray-400 font-mono">
          {category.vocabulary.length} terms | {category.min}-{category.max} per
          card
        </span>
      </button>

      {/* Body */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          <p className="text-sm text-gray-500">{category.description}</p>

          <div className="flex flex-wrap gap-1.5">
            {category.vocabulary.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                category={category.id}
                size="sm"
              />
            ))}
          </div>

          <div className="flex gap-4 text-xs text-gray-400">
            <span>
              Min per card: <strong className="text-gray-600">{category.min}</strong>
            </span>
            <span>
              Max per card: <strong className="text-gray-600">{category.max}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * A collapsible tree view that presents the full taxonomy structure.
 *
 * Each category renders as an expandable section showing its description,
 * vocabulary (as color-coded `TagChip`s), and min/max cardinality rules.
 * A separate section lists blocked tags.
 */
export function TaxonomyBrowser({
  taxonomy,
  defaultExpanded = [],
}: TaxonomyBrowserProps) {
  const [expanded, setExpanded] = useState<Set<CategoryId>>(
    new Set(defaultExpanded)
  );

  function toggle(id: CategoryId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900">Taxonomy</h2>

      {/* Category sections */}
      {taxonomy.categories.map((cat) => (
        <CategorySection
          key={cat.id}
          category={cat}
          isExpanded={expanded.has(cat.id)}
          onToggle={() => toggle(cat.id)}
        />
      ))}

      {/* Blocked tags */}
      {taxonomy.blocked.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-2">
          <h3 className="text-sm font-semibold text-red-700">
            Blocked Tags ({taxonomy.blocked.length})
          </h3>
          <p className="text-xs text-red-500">
            These tags are too vague or duplicative and should never be applied.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {taxonomy.blocked.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 font-mono text-xs text-red-600 line-through"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
