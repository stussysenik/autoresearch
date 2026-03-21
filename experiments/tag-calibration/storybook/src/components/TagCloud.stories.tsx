import React, { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { TagCloud, type TagCloudItem } from "./TagCloud";
import { computeTagCounts } from "../data/taxonomy";

const meta: Meta<typeof TagCloud> = {
  title: "Components/TagCloud",
  component: TagCloud,
};

export default meta;
type Story = StoryObj<typeof TagCloud>;

// ---------------------------------------------------------------------------
// Data sourced from the sample taxonomy
// ---------------------------------------------------------------------------

const allTags = computeTagCounts();

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

export const AllTags: Story = {
  args: {
    tags: allTags,
  },
};

export const PrimaryOnly: Story = {
  args: {
    tags: allTags.filter((t) => t.category === "primary"),
  },
};

export const ContextualOnly: Story = {
  args: {
    tags: allTags.filter((t) => t.category === "contextual"),
  },
};

export const StyleOnly: Story = {
  args: {
    tags: allTags.filter((t) => t.category === "style"),
  },
};

export const Empty: Story = {
  args: {
    tags: [],
  },
};

// ---------------------------------------------------------------------------
// Interactive: filter by category with buttons
// ---------------------------------------------------------------------------

function FilterableCloud() {
  const [filter, setFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const displayed = filter
    ? allTags.filter((t) => t.category === filter)
    : allTags;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {["all", "primary", "contextual", "style"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat === "all" ? null : cat)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              (cat === "all" && filter === null) || filter === cat
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <TagCloud tags={displayed} onTagClick={(tag) => setSelected(tag)} />

      {selected && (
        <p className="text-sm text-gray-500">
          Selected: <span className="font-mono font-semibold">{selected}</span>
        </p>
      )}
    </div>
  );
}

export const Filterable: Story = {
  render: () => <FilterableCloud />,
};
