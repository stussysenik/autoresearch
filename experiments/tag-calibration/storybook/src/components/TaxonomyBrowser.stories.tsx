import type { Meta, StoryObj } from "@storybook/react";
import { TaxonomyBrowser } from "./TaxonomyBrowser";
import { taxonomy } from "../data/taxonomy";

const meta: Meta<typeof TaxonomyBrowser> = {
  title: "Components/TaxonomyBrowser",
  component: TaxonomyBrowser,
};

export default meta;
type Story = StoryObj<typeof TaxonomyBrowser>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** All categories collapsed (default state). */
export const AllCollapsed: Story = {
  args: {
    taxonomy,
  },
};

/** Primary category starts expanded. */
export const PrimaryExpanded: Story = {
  args: {
    taxonomy,
    defaultExpanded: ["primary"],
  },
};

/** All categories expanded so the full vocabulary is visible at a glance. */
export const AllExpanded: Story = {
  args: {
    taxonomy,
    defaultExpanded: ["primary", "contextual", "style"],
  },
};

/** A minimal taxonomy with a single category for focused testing. */
export const SingleCategory: Story = {
  args: {
    taxonomy: {
      categories: [taxonomy.categories[0]],
      blocked: [],
    },
  },
};

/** Taxonomy with no blocked tags. */
export const NoBlockedTags: Story = {
  args: {
    taxonomy: {
      categories: taxonomy.categories,
      blocked: [],
    },
  },
};
