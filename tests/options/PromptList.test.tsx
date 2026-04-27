import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { PromptItem } from "@/utils/types";

vi.mock("@/utils/i18n", () => ({
  t: (key: string, substitutions?: string[]) => {
    if (key === "promptCharacterCountValue") {
      return `${substitutions?.[0]} chars`;
    }

    return key;
  },
}));

const { default: PromptList } = await import("@/entrypoints/options/components/PromptList");

const createPrompt = (overrides: Partial<PromptItem> = {}): PromptItem => ({
  id: "prompt-1",
  title: "Prompt",
  content: "Content",
  tags: [],
  enabled: true,
  categoryId: "default",
  createdAt: "2025-01-01T00:00:00.000Z",
  lastModified: "2025-01-02T00:00:00.000Z",
  attachments: [],
  ...overrides,
});

describe("PromptList", () => {
  it("uses a masonry-style column layout for variable-height prompt cards", () => {
    const { container } = render(
      <PromptList
        prompts={[
          createPrompt({ id: "prompt-1", content: "Short content" }),
          createPrompt({ id: "prompt-2", content: "Long content\n".repeat(20) }),
        ]}
        categories={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onReorder={vi.fn()}
        searchTerm=""
        allPromptsCount={2}
        sortType="created-newest"
      />
    );

    const list = container.firstElementChild;

    expect(list).toHaveClass("columns-1");
    expect(list).toHaveClass("xl:columns-2");
    expect(list).toHaveClass("gap-4");
    expect(list).not.toHaveClass("grid");
    expect(list).not.toHaveClass("xl:grid-cols-2");
  });
});
