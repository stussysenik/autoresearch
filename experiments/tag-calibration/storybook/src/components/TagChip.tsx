import React from "react";
import type { CategoryId } from "../data/taxonomy";

// ---------------------------------------------------------------------------
// Color mapping
// ---------------------------------------------------------------------------

const categoryColors: Record<
  CategoryId,
  { bg: string; text: string; border: string }
> = {
  primary: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  contextual: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  style: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
};

const defaultColors = {
  bg: "bg-gray-50",
  text: "text-gray-700",
  border: "border-gray-200",
};

// ---------------------------------------------------------------------------
// Size mapping
// ---------------------------------------------------------------------------

const sizeClasses: Record<string, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TagChipProps {
  /** The tag label to display */
  tag: string;
  /** Which taxonomy category this tag belongs to */
  category?: CategoryId;
  /** Visual size variant */
  size?: "sm" | "md";
  /** Optional click handler — makes the chip interactive */
  onClick?: () => void;
}

/**
 * A small pill that represents a single tag.
 *
 * Color-coded by taxonomy category:
 * - **primary** (green) -- core subject matter
 * - **contextual** (blue) -- situational relevance
 * - **style** (purple) -- aesthetic qualities
 *
 * Hovering shows the category name via the native `title` attribute.
 */
export function TagChip({
  tag,
  category,
  size = "md",
  onClick,
}: TagChipProps) {
  const colors = category ? categoryColors[category] : defaultColors;

  const baseClasses = [
    "inline-flex items-center rounded-full border font-mono leading-none select-none transition-colors",
    colors.bg,
    colors.text,
    colors.border,
    sizeClasses[size],
  ].join(" ");

  const interactiveClasses = onClick
    ? "cursor-pointer hover:brightness-95 active:scale-95"
    : "";

  return (
    <span
      className={`${baseClasses} ${interactiveClasses}`}
      title={category ?? "uncategorized"}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {tag}
    </span>
  );
}
