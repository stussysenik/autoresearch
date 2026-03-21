import type { Meta, StoryObj } from "@storybook/react";
import { TagChip } from "./TagChip";

const meta: Meta<typeof TagChip> = {
  title: "Components/TagChip",
  component: TagChip,
  argTypes: {
    category: {
      control: "select",
      options: ["primary", "contextual", "style", undefined],
    },
    size: {
      control: "radio",
      options: ["sm", "md"],
    },
    onClick: { action: "clicked" },
  },
};

export default meta;
type Story = StoryObj<typeof TagChip>;

// ---------------------------------------------------------------------------
// Individual category stories
// ---------------------------------------------------------------------------

export const Primary: Story = {
  args: {
    tag: "machine-learning",
    category: "primary",
  },
};

export const Contextual: Story = {
  args: {
    tag: "tutorial",
    category: "contextual",
  },
};

export const Style: Story = {
  args: {
    tag: "minimal",
    category: "style",
  },
};

export const Uncategorized: Story = {
  args: {
    tag: "unknown-tag",
  },
};

// ---------------------------------------------------------------------------
// Sizes
// ---------------------------------------------------------------------------

export const SmallSize: Story = {
  args: {
    tag: "react",
    category: "primary",
    size: "sm",
  },
};

export const MediumSize: Story = {
  args: {
    tag: "react",
    category: "primary",
    size: "md",
  },
};

// ---------------------------------------------------------------------------
// Interactive
// ---------------------------------------------------------------------------

export const Interactive: Story = {
  args: {
    tag: "accessibility",
    category: "primary",
    onClick: () => alert("Tag clicked!"),
  },
};

// ---------------------------------------------------------------------------
// Group of tags
// ---------------------------------------------------------------------------

export const TagGroup: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <TagChip tag="machine-learning" category="primary" />
      <TagChip tag="typography" category="primary" />
      <TagChip tag="color-theory" category="primary" />
      <TagChip tag="tutorial" category="contextual" />
      <TagChip tag="reference" category="contextual" />
      <TagChip tag="case-study" category="contextual" />
      <TagChip tag="minimal" category="style" />
      <TagChip tag="brutalist" category="style" />
      <TagChip tag="dark-mode" category="style" />
    </div>
  ),
};

export const MixedSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <TagChip tag="react" category="primary" size="sm" />
      <TagChip tag="react" category="primary" size="md" />
      <TagChip tag="tutorial" category="contextual" size="sm" />
      <TagChip tag="tutorial" category="contextual" size="md" />
      <TagChip tag="minimal" category="style" size="sm" />
      <TagChip tag="minimal" category="style" size="md" />
    </div>
  ),
};
