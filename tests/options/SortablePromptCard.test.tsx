import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import type { Category, PromptAttachment, PromptItem } from "@/utils/types";

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

const createAttachment = (overrides: Partial<PromptAttachment> = {}): PromptAttachment => ({
  id: "attachment-1",
  name: "image-1.png",
  type: "image/png",
  size: 2048,
  relativePath: "attachments/prompt-1/attachment-1-image-1.png",
  createdAt: "2025-01-01T00:00:00.000Z",
  thumbnailDataUrl: "data:image/webp;base64,thumbnail-1",
  ...overrides,
});

const renderCard = (
  onTagSelect = vi.fn(),
  compact = false,
  promptOverrides: Partial<PromptItem> = {},
  category?: Category,
  onCopy = vi.fn(),
  isDragEnabled = true,
) => {
  const testPrompt = { ...prompt, ...promptOverrides };

  return render(
    <DndContext>
      <SortableContext items={[testPrompt.id]}>
        <SortablePromptCard
          prompt={testPrompt}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onDuplicate={vi.fn()}
          onTogglePinned={vi.fn()}
          onCopy={onCopy}
          copiedId={null}
          onTagSelect={onTagSelect}
          category={category}
          compact={compact}
          isDragEnabled={isDragEnabled}
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

  it("allows card layout title and content to wrap with independent card heights", () => {
    renderCard(vi.fn(), false, {
      title: "Long card title ".repeat(12),
      content: "Long card content\n".repeat(12),
    });

    const card = screen.getByText(/Long card title/).closest(".rounded-2xl.border");
    const title = screen.getByRole("heading", { name: /Long card title/ });
    const content = screen.getByText(/Long card content/);

    expect(card).toHaveClass("self-start");
    expect(title).toHaveClass("line-clamp-3");
    expect(title).not.toHaveClass("truncate");
    expect(content).toHaveClass("line-clamp-5");
    expect(content).not.toHaveClass("line-clamp-2");
  });

  it("normalizes card layout content display while preserving original text for hover and copy", () => {
    const onCopy = vi.fn();
    const originalContent = "first line\nsecond line\r\nthird line";
    renderCard(vi.fn(), false, { content: originalContent }, undefined, onCopy);

    const displayedContent = screen.getByText("first line second line third line");

    expect(displayedContent.textContent).toBe("first line second line third line");
    expect(displayedContent).toHaveAttribute("title", `${originalContent}\n\nclickToCopy`);

    fireEvent.click(displayedContent);

    expect(onCopy).toHaveBeenCalledWith(originalContent, "prompt-1");
  });

  it("keeps vertical spacing between card image attachments and metadata", () => {
    renderCard(vi.fn(), false, {
      attachments: [createAttachment()],
    });

    const image = screen.getByRole("img", { name: "image-1.png" });
    const attachmentSection = image.closest(".qp-card-attachments");

    expect(attachmentSection).toHaveClass("mb-4");
    expect(screen.getByText(/createdAt:/)).toBeInTheDocument();
  });

  it("allows compact layout title and content to wrap with independent card heights", () => {
    renderCard(vi.fn(), true, {
      title: "Long compact title ".repeat(12),
      content: "Long compact content\n".repeat(12),
    });

    const card = screen.getByText(/Long compact title/).closest(".rounded-2xl.border");
    const title = screen.getByText(/Long compact title/);
    const content = screen.getByText(/Long compact content/);

    expect(card).toHaveClass("self-start");
    expect(title).toHaveStyle("-webkit-line-clamp: 3");
    expect(title).not.toHaveClass("truncate");
    expect(content).toHaveStyle("-webkit-line-clamp: 3");
    expect(content).not.toHaveClass("truncate");
  });

  it("sets compact title and content line count from tag rows, image height, and default", () => {
    const imageHeight = renderCard(vi.fn(), true, {
      title: "Image height title ".repeat(12),
      content: "Image height content ".repeat(12),
      tags: ["one", "two", "three"],
      attachments: [createAttachment()],
    });

    expect(screen.getByText(/Image height title/)).toHaveStyle("-webkit-line-clamp: 3");
    expect(screen.getByText(/Image height content/)).toHaveStyle("-webkit-line-clamp: 3");

    imageHeight.unmount();

    const twoRows = renderCard(vi.fn(), true, {
      title: "Two row title ".repeat(12),
      content: "Two row content ".repeat(12),
      tags: ["one", "two", "three", "four"],
    });

    expect(screen.getByText(/Two row title/)).toHaveStyle("-webkit-line-clamp: 4");
    expect(screen.getByText(/Two row content/)).toHaveStyle("-webkit-line-clamp: 4");

    twoRows.unmount();

    const fourRows = renderCard(vi.fn(), true, {
      title: "Four row title ".repeat(12),
      content: "Four row content ".repeat(12),
      tags: ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
    });

    expect(screen.getByText(/Four row title/)).toHaveStyle("-webkit-line-clamp: 6");
    expect(screen.getByText(/Four row content/)).toHaveStyle("-webkit-line-clamp: 6");

    fourRows.unmount();

    renderCard(vi.fn(), true, {
      title: "Default title ".repeat(12),
      content: "Default content ".repeat(12),
      tags: [],
      attachments: [],
    });

    expect(screen.getByText(/Default title/)).toHaveStyle("-webkit-line-clamp: 3");
    expect(screen.getByText(/Default content/)).toHaveStyle("-webkit-line-clamp: 3");
  });

  it("renders every compact image attachment beside text without visible metadata", () => {
    renderCard(vi.fn(), true, {
      attachments: [
        createAttachment(),
        createAttachment({
          id: "attachment-2",
          name: "image-2.png",
          relativePath: "attachments/prompt-1/attachment-2-image-2.png",
          thumbnailDataUrl: "data:image/webp;base64,thumbnail-2",
        }),
        createAttachment({
          id: "attachment-3",
          name: "image-3.png",
          relativePath: "attachments/prompt-1/attachment-3-image-3.png",
          thumbnailDataUrl: "data:image/webp;base64,thumbnail-3",
        }),
      ],
    });

    const images = screen.getAllByRole("img", { name: /image-\d\.png/ });
    expect(images).toHaveLength(3);

    images.forEach((image) => {
      expect(image.closest(".qp-compact-image-attachment")).toBeInTheDocument();
    });
    const attachmentList = images[0].closest(".qp-compact-attachments")?.firstElementChild;
    expect(attachmentList).toHaveClass("w-fit");
    expect(
      Array.from(attachmentList?.classList || []).some((className) => className.startsWith("max-w-"))
    ).toBe(false);
    expect(screen.queryByText("image-1.png")).not.toBeInTheDocument();
    expect(screen.queryByText("2 KB")).not.toBeInTheDocument();
  });

  it("orders compact layout sections from title through actions across the full row", () => {
    renderCard(vi.fn(), true, {
      attachments: [createAttachment()],
      tags: ["work", "email", "sales", "hidden"],
    }, {
      id: "default",
      name: "Default",
      enabled: true,
      color: "#6366f1",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    const card = screen.getByText("Prompt").closest(".rounded-2xl.border");
    const row = card?.querySelector(".qp-compact-content-row");

    expect(card).toHaveClass("w-full");
    expect(row).toHaveClass("w-full");
    expect(row).toHaveClass("gap-1");
    expect(
      Array.from(row?.children || []).map((child) => (
        Array.from(child.classList).find((className) => className.startsWith("qp-compact-"))
      ))
    ).toEqual([
      "qp-compact-drag",
      "qp-compact-title",
      "qp-compact-body",
      "qp-compact-attachments",
      "qp-compact-character-count",
      "qp-compact-tags",
      "qp-compact-category",
      "qp-compact-actions",
    ]);

    expect(row?.querySelector(".qp-compact-drag")).toContainElement(
      screen.getByRole("button", { name: "dragToReorder" })
    );
    expect(row?.querySelector(".qp-compact-title")).toHaveClass("flex-[1_1_0]");
    expect(row?.querySelector(".qp-compact-body")).toHaveClass("flex-[3_1_0]");
    expect(row?.querySelector(".qp-compact-tags")).toHaveClass("inline-grid");
    expect(row?.querySelector(".qp-compact-tags")).toHaveStyle({
      gridTemplateColumns: "repeat(3, max-content)",
    });
    expect(
      Array.from(row?.querySelector(".qp-compact-tags")?.classList || [])
        .some((className) => className.startsWith("max-w-"))
    ).toBe(false);
    expect(row?.querySelectorAll(".qp-compact-tags button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "#hidden" })).toBeInTheDocument();
    expect(
      Array.from(row?.querySelector(".qp-compact-actions")?.querySelectorAll("button") || [])
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual([
      "pinPrompt",
      "copy",
      "duplicate",
      "edit",
      "delete",
    ]);
  });

  it("vertically centers compact layout information and icons", () => {
    renderCard(vi.fn(), true, {
      pinned: true,
      attachments: [createAttachment()],
      tags: ["work", "email", "sales", "support"],
    }, {
      id: "default",
      name: "Default",
      enabled: true,
      color: "#6366f1",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    const row = screen.getByText("Prompt").closest(".qp-compact-content-row");
    const titleContent = row?.querySelector(".qp-compact-title > div");
    const pinnedIcon = row?.querySelector(".qp-compact-title svg");
    const attachmentList = row?.querySelector(".qp-compact-attachments")?.firstElementChild;

    expect(row).toHaveClass("items-center");
    expect(titleContent).toHaveClass("items-center");
    expect(pinnedIcon).not.toHaveClass("mt-0.5");
    expect(attachmentList).toHaveClass("items-center");
    expect(row?.querySelector(".qp-compact-actions")).toHaveClass("items-center");
  });

  it("normalizes compact content display while preserving original text for hover and copy", () => {
    const onCopy = vi.fn();
    const originalContent = "first line\nsecond line\r\nthird line";
    renderCard(vi.fn(), true, { content: originalContent }, undefined, onCopy);

    const displayedContent = screen.getByText("first line second line third line");
    const body = displayedContent.closest(".qp-compact-body");

    expect(displayedContent.textContent).toBe("first line second line third line");
    expect(displayedContent).toHaveStyle("-webkit-line-clamp: 3");
    expect(body).toHaveAttribute("title", `${originalContent}\n\nclickToCopy`);

    fireEvent.click(body!);

    expect(onCopy).toHaveBeenCalledWith(originalContent, "prompt-1");
  });

  it("omits the compact drag handle when custom sorting is disabled", () => {
    renderCard(vi.fn(), true, {}, undefined, vi.fn(), false);

    const row = screen.getByText("Prompt").closest(".qp-compact-content-row");

    expect(row?.querySelector(".qp-compact-drag")).toBeNull();
    expect(screen.queryByRole("button", { name: "dragToReorder" })).not.toBeInTheDocument();
  });
});
