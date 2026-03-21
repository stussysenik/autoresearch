import React from "react";
import { TagChip } from "./TagChip";
import type { CategoryId } from "../data/taxonomy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagCloudItem {
  tag: string;
  count: number;
  category: CategoryId;
}

export interface TagCloudProps {
  /** Tags with frequency counts and category assignments */
  tags: TagCloudItem[];
  /** Callback fired when a tag is clicked */
  onTagClick?: (tag: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a count to a CSS font-size class.
 *
 * We bucket counts into 4 tiers so the cloud has clear visual weight without
 * needing continuous scaling (which Tailwind cannot do dynamically).
 */
function sizeForCount(
  count: number,
  maxCount: number
): { fontSize: string; size: "sm" | "md" } {
  const ratio = maxCount > 0 ? count / maxCount : 0;

  if (ratio >= 0.75) return { fontSize: "text-lg", size: "md" };
  if (ratio >= 0.5) return { fontSize: "text-base", size: "md" };
  if (ratio >= 0.25) return { fontSize: "text-sm", size: "md" };
  return { fontSize: "text-xs", size: "sm" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A weighted tag cloud that sizes tags proportionally to their frequency.
 *
 * Tags are rendered in a responsive flex-wrap layout, color-coded by taxonomy
 * category via `TagChip`. Clicking a tag fires `onTagClick` with the tag
 * string so the consumer can filter, navigate, etc.
 */
export function TagCloud({ tags, onTagClick }: TagCloudProps) {
  if (tags.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">No tags to display.</p>
    );
  }

  const maxCount = Math.max(...tags.map((t) => t.count));

  return (
    <div className="flex flex-wrap items-center gap-2" role="list">
      {tags.map(({ tag, count, category }) => {
        const { fontSize, size } = sizeForCount(count, maxCount);

        return (
          <div
            key={tag}
            className={`${fontSize} transition-transform hover:scale-105`}
            role="listitem"
          >
            <TagChip
              tag={`${tag} (${count})`}
              category={category}
              size={size}
              onClick={onTagClick ? () => onTagClick(tag) : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}
