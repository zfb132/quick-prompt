import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { PromptItem } from "@/utils/types";

vi.mock("@/utils/i18n", () => ({
  t: (key: string) => key,
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

const renderCard = (onTagSelect = vi.fn()) => {
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

  it("selects a tag when clicking a prompt tag", () => {
    const onTagSelect = vi.fn();
    renderCard(onTagSelect);

    fireEvent.click(screen.getByRole("button", { name: "#work" }));

    expect(onTagSelect).toHaveBeenCalledWith("work");
  });
});
