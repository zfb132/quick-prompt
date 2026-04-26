import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { PromptItem } from "@/utils/types";

vi.mock("@/utils/i18n", () => ({
  t: (key: string, substitutions?: string[]) => {
    if (key === "promptCharacterCountValue") {
      return `${substitutions?.[0]} chars`;
    }

    return key;
  },
}));

const { default: SortablePromptCard } = await import("@/entrypoints/options/components/SortablePromptCard");

const prompt: PromptItem = {
  id: "prompt-1",
  title: "Prompt",
  content: "Content",
  tags: ["work", "email"],
  enabled: true,
  categoryId: "default",
  createdAt: "2025-01-01T00:00:00.000Z",
  lastModified: "2025-01-02T00:00:00.000Z",
  attachments: [],
};

const renderCard = (onTagSelect = vi.fn(), compact = false) => {
  render(
    <DndContext>
      <SortableContext items={[prompt.id]}>
        <SortablePromptCard
          prompt={prompt}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onDuplicate={vi.fn()}
          onCopy={vi.fn()}
          copiedId={null}
          onTagSelect={onTagSelect}
          compact={compact}
        />
      </SortableContext>
    </DndContext>
  );
};

describe("SortablePromptCard", () => {
  it("renders created and modified time metadata", () => {
    renderCard();

    expect(screen.getByText(/createdAt:/)).toBeInTheDocument();
    expect(screen.getByText(/lastModified:/)).toBeInTheDocument();
  });

  it("renders prompt metadata in one row ordered by created time, modified time, and character count", () => {
    renderCard();

    const createdAt = screen.getByText(/createdAt:/);
    const lastModified = screen.getByText(/lastModified:/);
    const characterCount = screen.getByText(/promptCharacterCount:/);
    const metadataRow = createdAt.closest("div")?.parentElement;

    expect(metadataRow).toHaveClass("flex");
    expect(metadataRow).toBe(lastModified.closest("div")?.parentElement);
    expect(metadataRow).toBe(characterCount.closest("div")?.parentElement);
    expect(
      Array.from(metadataRow?.children || []).map((item) => item.textContent)
    ).toEqual([
      expect.stringContaining("createdAt:"),
      expect.stringContaining("lastModified:"),
      expect.stringContaining("promptCharacterCount: 7 chars"),
    ]);
  });

  it("renders prompt character count in compact layout", () => {
    renderCard(vi.fn(), true);

    expect(screen.getByText("7 chars")).toBeInTheDocument();
  });

  it("selects a tag when clicking a prompt tag", () => {
    const onTagSelect = vi.fn();
    renderCard(onTagSelect);

    fireEvent.click(screen.getByRole("button", { name: "#work" }));

    expect(onTagSelect).toHaveBeenCalledWith("work");
  });
});
