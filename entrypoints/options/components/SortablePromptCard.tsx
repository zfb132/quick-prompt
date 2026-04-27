import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  FileText,
  GripVertical,
  Pencil,
  Pin,
  PinOff,
  PlusSquare,
  Trash2,
} from "lucide-react";

import type { PromptItem, Category } from "@/utils/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { t } from "../../../utils/i18n";
import PromptAttachmentPreview from "./PromptAttachmentPreview";

interface SortablePromptCardProps {
  prompt: PromptItem;
  category?: Category;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggleEnabled?: (id: string, enabled: boolean) => void;
  onTogglePinned?: (id: string, pinned: boolean) => void;
  onCopy: (content: string, id: string) => void;
  copiedId: string | null;
  selectedTag?: string | null;
  onTagSelect?: (tag: string) => void;
  compact?: boolean;
  isDragEnabled?: boolean;
}

const countPromptCharacters = (content: string): number => (
  Array.from(content.replace(/\s/g, "")).length
);

const COMPACT_TAGS_PER_ROW = 3;
const COMPACT_IMAGE_TEXT_LINE_COUNT = 3;
const COMPACT_DEFAULT_TEXT_LINE_COUNT = 3;

const SortablePromptCard: React.FC<SortablePromptCardProps> = ({
  prompt,
  category,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleEnabled,
  onTogglePinned,
  onCopy,
  copiedId,
  selectedTag,
  onTagSelect,
  compact = false,
  isDragEnabled = true,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: prompt.id,
    data: {
      type: "prompt",
      prompt,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 1000 : "auto",
  };

  const enabled = prompt.enabled !== undefined ? prompt.enabled : true;
  const characterCount = countPromptCharacters(prompt.content || "");
  const normalizedContentPreview = (prompt.content || "").replace(/\r?\n/g, " ");
  const compactTagRowCount = Math.ceil(prompt.tags.length / COMPACT_TAGS_PER_ROW);
  const hasCompactImageAttachment = Boolean(
    prompt.attachments?.some((attachment) => attachment.type.startsWith("image/")),
  );
  const compactTextLineCount = compactTagRowCount > 1
    ? compactTagRowCount + 2
    : hasCompactImageAttachment
      ? COMPACT_IMAGE_TEXT_LINE_COUNT
      : COMPACT_DEFAULT_TEXT_LINE_COUNT;
  const compactTextClampStyle = {
    display: "-webkit-box",
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: compactTextLineCount,
  } as React.CSSProperties;

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return t("noModificationTime");

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return t("invalidTime");

      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      if (diffInMs < 0) return date.toLocaleDateString();

      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
      if (diffInDays === 0) {
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        if (diffInHours === 0) {
          const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
          return diffInMinutes <= 1 ? t("justNow") : t("minutesAgo", [diffInMinutes.toString()]);
        }
        return diffInHours === 1 ? t("oneHourAgo") : t("hoursAgo", [diffInHours.toString()]);
      }
      if (diffInDays === 1) return t("oneDayAgo");
      if (diffInDays < 7) return t("daysAgo", [diffInDays.toString()]);
      return date.toLocaleDateString();
    } catch (err) {
      console.error("格式化时间出错:", err, "timestamp:", timestamp);
      return t("invalidTime");
    }
  };

  const selectTag = (event: React.MouseEvent, tag: string) => {
    event.stopPropagation();
    onTagSelect?.(tag);
  };

  const DragHandle = () => (
    isDragEnabled ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-grab active:cursor-grabbing"
        title={t("dragToReorder")}
        aria-label={t("dragToReorder")}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </Button>
    ) : null
  );

  const ActionButtons = ({ small = false }: { small?: boolean }) => (
    <div className="flex items-center gap-1">
      {onTogglePinned && (
        <Button
          type="button"
          variant={prompt.pinned ? "soft" : "ghost"}
          size={small ? "icon-sm" : "icon"}
          onClick={() => onTogglePinned(prompt.id, !prompt.pinned)}
          title={prompt.pinned ? t("unpinPrompt") : t("pinPrompt")}
          aria-label={prompt.pinned ? t("unpinPrompt") : t("pinPrompt")}
          className={prompt.pinned ? "text-amber-700 dark:text-amber-300" : ""}
        >
          {prompt.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </Button>
      )}
      <Button
        type="button"
        variant={copiedId === prompt.id ? "soft" : "ghost"}
        size={small ? "icon-sm" : "icon"}
        onClick={() => onCopy(prompt.content, prompt.id)}
        title={copiedId === prompt.id ? t("copied") : t("copy")}
        aria-label={copiedId === prompt.id ? t("copied") : t("copy")}
        className={copiedId === prompt.id ? "text-emerald-600 dark:text-emerald-300" : ""}
      >
        {copiedId === prompt.id ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={small ? "icon-sm" : "icon"}
        onClick={() => onDuplicate(prompt.id)}
        title={t("duplicate")}
        aria-label={t("duplicate")}
      >
        <PlusSquare className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={small ? "icon-sm" : "icon"}
        onClick={() => onEdit(prompt.id)}
        title={t("edit")}
        aria-label={t("edit")}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size={small ? "icon-sm" : "icon"}
        onClick={() => onDelete(prompt.id)}
        title={t("delete")}
        aria-label={t("delete")}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );

  if (compact) {
    return (
      <Card
        ref={setNodeRef}
        style={style}
        className={cn(
          "w-full self-start overflow-hidden transition-all hover:border-primary/30 hover:shadow-md",
          isDragging && "scale-[1.01] border-primary shadow-lg ring-2 ring-primary/25",
          prompt.pinned && "border-amber-500/30 bg-amber-500/5",
        )}
      >
        <div className="qp-compact-content-row flex w-full items-center gap-1 px-3 py-2">
          <div
            className="qp-compact-title min-w-[120px] flex-[1_1_0] cursor-pointer"
            title={`${prompt.content}\n\n${t("clickToCopy")}`}
            onClick={() => onCopy(prompt.content, prompt.id)}
          >
            <div className="flex items-center gap-1.5">
              {prompt.pinned && <Pin className="size-3.5 shrink-0 text-amber-500" />}
              <span
                className="break-words text-sm font-medium leading-5 text-foreground"
                style={compactTextClampStyle}
              >
                {prompt.title}
              </span>
            </div>
          </div>
          <div
            className="qp-compact-body min-w-[200px] flex-[3_1_0] cursor-pointer"
            title={`${prompt.content}\n\n${t("clickToCopy")}`}
            onClick={() => onCopy(prompt.content, prompt.id)}
          >
            <p
              className="whitespace-normal break-words text-xs leading-5 text-muted-foreground"
              style={compactTextClampStyle}
            >
              {normalizedContentPreview}
            </p>
          </div>
          {prompt.attachments && prompt.attachments.length > 0 && (
            <div className="qp-compact-attachments min-w-0 flex-[0_1_auto]">
              <PromptAttachmentPreview attachments={prompt.attachments} compact />
            </div>
          )}
          <Badge variant="muted" className="qp-compact-character-count shrink-0">
            {t("promptCharacterCountValue", [characterCount.toString()])}
          </Badge>
          {prompt.tags.length > 0 && (
            <div
              className="qp-compact-tags inline-grid shrink-0 gap-1"
              style={{
                gridTemplateColumns: `repeat(${Math.min(prompt.tags.length, 3)}, max-content)`,
              }}
            >
              {prompt.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(event) => selectTag(event, tag)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                    selectedTag === tag
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                  title={t("filterByTag")}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
          {category && (
            <Badge variant="outline" className="qp-compact-category shrink-0 gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: category.color || "#6366f1" }}
              />
              {category.name}
            </Badge>
          )}
          <div className="qp-compact-actions flex shrink-0 items-center gap-1">
            <ActionButtons small />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "mb-4 flex break-inside-avoid flex-col self-start overflow-hidden transition-all hover:border-primary/30 hover:shadow-md",
        isDragging && "scale-[1.01] border-primary shadow-lg ring-2 ring-primary/25",
        prompt.pinned && "border-amber-500/30",
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3 border-b border-border px-5 py-4",
          prompt.pinned && "bg-amber-500/5",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            {prompt.pinned && <Pin className="mt-1 size-4 shrink-0 text-amber-500" />}
            <h3 className="line-clamp-3 break-words text-base font-semibold leading-6 text-foreground">{prompt.title}</h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {category && (
              <Badge variant="outline" className="gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: category.color || "#6366f1" }}
                />
                {category.name}
              </Badge>
            )}
            <Badge variant={enabled ? "success" : "muted"}>
              {enabled ? t("enabled") : t("disabled")}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DragHandle />
          {onToggleEnabled && (
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => onToggleEnabled(prompt.id, checked)}
              aria-label={enabled ? t("enabled") : t("disabled")}
            />
          )}
        </div>
      </div>

      <div className="flex gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {prompt.tags && prompt.tags.length > 0 ? (
              prompt.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(event) => selectTag(event, tag)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
                    selectedTag === tag
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                  title={t("filterByTag")}
                >
                  #{tag}
                </button>
              ))
            ) : (
              <span className="text-xs italic text-muted-foreground">{t("noTags")}</span>
            )}
          </div>

          <p
            className="mb-4 line-clamp-5 cursor-pointer whitespace-normal break-words text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground"
            title={`${prompt.content}\n\n${t("clickToCopy")}`}
            onClick={() => onCopy(prompt.content, prompt.id)}
          >
            {normalizedContentPreview}
          </p>

          {prompt.attachments && prompt.attachments.length > 0 && (
            <div className={cn("qp-card-attachments", hasCompactImageAttachment && "mb-4")}>
              <PromptAttachmentPreview attachments={prompt.attachments} />
            </div>
          )}

          {prompt.notes && prompt.notes.trim() && (
            <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
                <div className="min-w-0">
                  <h4 className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                    {t("notes")}
                  </h4>
                  <p className="whitespace-pre-wrap text-xs leading-5 text-amber-800/80 dark:text-amber-100/80">
                    {prompt.notes}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {t("createdAt")}: {formatTime(prompt.createdAt)}
            </div>
            <div className="inline-flex items-center gap-1.5">
              <Clock3 className="size-3.5" />
              {t("lastModified")}: {formatTime(prompt.lastModified)}
            </div>
            <div className="inline-flex items-center gap-1.5">
              <FileText className="size-3.5" />
              {t("promptCharacterCount")}: {t("promptCharacterCountValue", [characterCount.toString()])}
            </div>
          </div>
        </div>

        {prompt.thumbnailUrl && (
          <img
            src={prompt.thumbnailUrl}
            alt={prompt.title}
            className="size-24 shrink-0 rounded-2xl border border-border object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>

      <div className="flex justify-end border-t border-border bg-muted/35 px-4 py-3">
        <ActionButtons />
      </div>
    </Card>
  );
};

export default SortablePromptCard;
