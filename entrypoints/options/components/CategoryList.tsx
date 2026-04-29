import React from "react";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";

import type { Category } from "@/utils/types";
import { DEFAULT_CATEGORY_ID } from "@/utils/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { t } from "../../../utils/i18n";

interface CategoryListProps {
  categories: Category[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  searchTerm: string;
  allCategoriesCount: number;
  onToggleEnabled?: (id: string, enabled: boolean) => void;
  onSelect?: (id: string) => void;
  promptCounts: Record<string, number>;
}

const CategoryList = ({
  categories,
  onEdit,
  onDelete,
  searchTerm,
  allCategoriesCount,
  onToggleEnabled,
  onSelect,
  promptCounts,
}: CategoryListProps) => {
  if (allCategoriesCount === 0) return null;
  if (categories.length === 0 && searchTerm) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {categories.map((category) => {
        const isSelectable = Boolean(onSelect);
        const selectCategory = () => onSelect?.(category.id);
        const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (!isSelectable) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectCategory();
          }
        };

        return (
          <Card
            key={category.id}
            role={isSelectable ? "button" : undefined}
            tabIndex={isSelectable ? 0 : undefined}
            onClick={selectCategory}
            onKeyDown={handleKeyDown}
            className={cn(
              "group overflow-hidden transition-all hover:border-primary/30 hover:shadow-md",
              isSelectable && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
              !category.enabled && "opacity-70",
            )}
          >
            <div className="p-4">
              <div className="mb-3 flex items-start gap-3">
                <span
                  className="mt-1 size-3 rounded-full shadow-sm ring-4 ring-muted"
                  style={{ backgroundColor: category.color || "#6366f1" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {category.name}
                    </h3>
                    {category.id === DEFAULT_CATEGORY_ID && (
                      <Badge variant="secondary">{t("default")}</Badge>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
                    {category.description || t("noDescription")}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/45 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {t("prompts", [`${promptCounts[category.id] || 0}`])}
                </span>
                {onToggleEnabled && (
                  <Switch
                    checked={category.enabled}
                    onCheckedChange={(checked) => onToggleEnabled(category.id, checked)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={category.enabled ? t("enabled") : t("disabled")}
                    className="scale-75"
                  />
                )}
              </div>
            </div>

            <div
              className="flex items-center justify-between border-t border-border bg-muted/25 px-3 py-2"
              onClick={(event) => event.stopPropagation()}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  selectCategory();
                }}
                className={cn(!isSelectable && "invisible")}
              >
                {t("viewAllCategories")}
                <ArrowRight className="size-3.5" />
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit(category.id);
                  }}
                  title={t("edit")}
                  aria-label={t("edit")}
                >
                  <Pencil className="size-4" />
                </Button>

                {category.id !== DEFAULT_CATEGORY_ID && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(category.id);
                    }}
                    title={t("delete")}
                    aria-label={t("delete")}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default CategoryList;
