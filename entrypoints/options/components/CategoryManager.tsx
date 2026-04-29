import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Download,
  FileInput,
  FilePenLine,
  FolderKanban,
  Link2,
  Plus,
  Search,
  Tags,
  Upload,
  X,
} from "lucide-react";
import CategoryForm from "./CategoryForm";
import CategoryList from "./CategoryList";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import "../App.css";
import "~/assets/tailwind.css";
import { Category } from "@/utils/types";
import {
  getCategories,
  saveCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  getPromptCountByCategory,
} from "@/utils/categoryUtils";
import { DEFAULT_CATEGORY_ID } from "@/utils/constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { PageSurface } from "@/components/layout/AppShell";
import { t } from '../../../utils/i18n';

const CategoryManager = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [promptCounts, setPromptCounts] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 添加远程导入相关状态
  const [isRemoteImportModalOpen, setIsRemoteImportModalOpen] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState("");
  const [isRemoteImporting, setIsRemoteImporting] = useState(false);

  // Load categories from storage
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoading(true);
        const storedCategories = await getCategories();
        setCategories(storedCategories);
        console.log(t('categoryPageLoadCategories'), storedCategories.length);

        // 加载每个分类下的提示词数量
        const counts: Record<string, number> = {};
        for (const category of storedCategories) {
          counts[category.id] = await getPromptCountByCategory(category.id);
        }
        setPromptCounts(counts);
      } catch (err) {
        console.error(t('categoryPageLoadError'), err);
        setError(t('loadCategoriesFailed'));
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []);

  // Filter categories based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const term = searchTerm.toLowerCase().trim();
    const filtered = categories.filter((category) => {
      const nameMatch = category.name.toLowerCase().includes(term);
      const descriptionMatch = category.description
        ?.toLowerCase()
        .includes(term);
      return nameMatch || descriptionMatch;
    });

    setFilteredCategories(filtered);
  }, [searchTerm, categories]);

  // Add a new category
  const handleAddCategory = async (
    categoryData: Omit<Category, "id" | "createdAt" | "updatedAt">
  ) => {
    try {
      const newCategory = await addCategory(categoryData);
      const updatedCategories = [newCategory, ...categories];
      setCategories(updatedCategories);
      setPromptCounts((prev) => ({ ...prev, [newCategory.id]: 0 }));
      closeModal();
    } catch (err) {
      console.error(t('categoryPageAddError'), err);
      setError(t('addCategoryFailed'));
    }
  };

  // Update an existing category
  const handleUpdateCategory = async (updatedCategory: Category) => {
    try {
      await updateCategory(updatedCategory.id, {
        name: updatedCategory.name,
        description: updatedCategory.description,
        color: updatedCategory.color,
        enabled: updatedCategory.enabled,
      });
      const updatedCategories = categories.map((c) =>
        c.id === updatedCategory.id ? updatedCategory : c
      );
      setCategories(updatedCategories);
      setEditingCategory(null);
      closeModal();
    } catch (err) {
      console.error(t('categoryPageUpdateError'), err);
      setError(t('updateCategoryFailed'));
    }
  };

  // Handle form submission for both add and update operations
  const handleCategorySubmit = async (
    category: Category | Omit<Category, "id" | "createdAt" | "updatedAt">
  ) => {
    if ("id" in category && category?.id) {
      await handleUpdateCategory(category as Category);
    } else {
      await handleAddCategory(category);
    }
  };

  // Delete a category
  const handleDeleteCategory = async (id: string) => {
    if (id === DEFAULT_CATEGORY_ID) {
      setError(t('cannotDeleteDefaultCategory'));
      return;
    }
    setCategoryToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (categoryToDelete) {
      try {
        await deleteCategory(categoryToDelete);
        const newCategories = categories.filter(
          (c) => c.id !== categoryToDelete
        );
        setCategories(newCategories);
        if (editingCategory?.id === categoryToDelete) {
          setEditingCategory(null);
        }
        const newPromptCounts = { ...promptCounts };
        delete newPromptCounts[categoryToDelete];
        setPromptCounts(newPromptCounts);
        setIsConfirmModalOpen(false); // Close modal on success
        setCategoryToDelete(null);
      } catch (err) {
        console.error(t('categoryPageDeleteError'), err);
        setError(t('deleteCategoryFailed'));
        setIsConfirmModalOpen(false); // Close modal on error too
        setCategoryToDelete(null);
      }
    }
  };

  // Start editing a category
  const startEdit = (id: string) => {
    const category = categories.find((c) => c.id === id);
    if (category) {
      setEditingCategory(category);
      setIsModalOpen(true);
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingCategory(null);
    closeModal();
  };

  // Open modal for adding a new category
  const openAddModal = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setError(null); // Clear error when closing modal
  };

  // 切换分类启用状态
  const toggleCategoryEnabled = async (id: string, enabled: boolean) => {
    try {
      await updateCategory(id, { enabled });
      const newCategories = categories.map((c) =>
        c.id === id ? { ...c, enabled } : c
      );
      setCategories(newCategories);
    } catch (err) {
      console.error(t('categoryPageToggleError'), err);
      setError(t('toggleCategoryStatusFailed'));
    }
  };

  const selectCategoryPrompts = (id: string) => {
    navigate({
      pathname: "/",
      search: `?category=${encodeURIComponent(id)}`,
    });
  };

  // 导出分类
  const exportCategories = () => {
    if (categories.length === 0) {
      alert(t('noCategoriesToExport'));
      return;
    }

    try {
      const dataStr = JSON.stringify(categories, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `categories-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log(t('exportCategoriesSuccess'));
    } catch (err) {
      console.error(t('exportCategoriesError'), err);
      setError(t('exportCategoriesFailed'));
    }
  };

  // 触发文件选择对话框
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 导入分类
  const importCategories = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileContent = await file.text();
      const importedCategories = JSON.parse(fileContent) as Category[];

      // 验证导入的数据格式
      if (!Array.isArray(importedCategories)) {
        throw new Error(t('invalidCategoryFileFormat'));
      }

      // 验证每个分类的结构
      const validCategories = importedCategories.filter((category) => {
        return (
          typeof category === "object" &&
          typeof category.id === "string" &&
          typeof category.name === "string" &&
          typeof category.enabled === "boolean" &&
          typeof category.createdAt === "string" &&
          typeof category.updatedAt === "string"
        );
      }).map((category) => ({
        ...category,
        // 确保有description和color字段
        description: category.description || "",
        color: category.color || "#6366f1",
      }));

      if (validCategories.length === 0) {
        throw new Error(t('noValidCategoriesInFile'));
      }

      // 确认是否需要合并或覆盖现有分类
      if (categories.length > 0) {
        const shouldImport = window.confirm(
          t('importCategoriesConfirm', [categories.length.toString(), validCategories.length.toString()])
        );

        if (shouldImport) {
          // 创建现有分类的Map，便于查找和更新
          const categoriesMap = new Map(categories.map(c => [c.id, c]));
          let addedCount = 0;
          let updatedCount = 0;

          validCategories.forEach(category => {
            if (categoriesMap.has(category.id)) {
              // 获取现有分类
              const existing = categoriesMap.get(category.id);
              // 待导入分类，合并现有分类属性
              const updatedCategory = { ...existing, ...category };
              // 排除 updatedAt 字段进行比较
              if (existing && JSON.stringify((({ updatedAt, ...rest }) => rest)(existing)) !== JSON.stringify((({ updatedAt, ...rest }) => rest)(updatedCategory))) {
                categoriesMap.set(category.id, {
                  ...updatedCategory,
                  updatedAt: new Date().toISOString(),
                });
                updatedCount++;
              }
            } else {
              // 添加新分类
              categoriesMap.set(category.id, {
                ...category,
                createdAt: category.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              addedCount++;
            }
          });

          // 如果没有新增也没有更新，显示提示
          if (addedCount === 0 && updatedCount === 0) {
            alert(t('noNewCategoriesFound'));
            return;
          }

          const newCategories = Array.from(categoriesMap.values());
          setCategories(newCategories);
          await saveCategories(newCategories);

          // 重新加载提示词数量
          const counts: Record<string, number> = {};
          for (const category of newCategories) {
            counts[category.id] = await getPromptCountByCategory(category.id);
          }
          setPromptCounts(counts);

          // 显示成功消息，包含新增和更新的数量
          alert(t('importSuccessful', [(addedCount + updatedCount).toString()]));
        }
        // 如果用户点击取消，不做任何操作
      } else {
        // 没有现有分类，直接保存导入的分类
        setCategories(validCategories);
        await saveCategories(validCategories);

        // 重新加载提示词数量
        const counts: Record<string, number> = {};
        for (const category of validCategories) {
          counts[category.id] = await getPromptCountByCategory(category.id);
        }
        setPromptCounts(counts);

        alert(t('importSuccessful', [validCategories.length.toString()]));
      }

      // 清除文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error(t('importCategoriesError'), err);
      setError(
        t('importCategoriesFailed', [err instanceof Error ? err.message : t('unknownError')])
      );

      // 清除文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 处理远程URL输入变化
  const handleRemoteUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRemoteUrl(e.target.value);
  };

  // 打开远程导入模态框
  const openRemoteImportModal = () => {
    setIsRemoteImportModalOpen(true);
    setRemoteUrl("");
    setError(null);
  };

  // 关闭远程导入模态框
  const closeRemoteImportModal = () => {
    setIsRemoteImportModalOpen(false);
    setRemoteUrl("");
    setError(null);
  };

  // 从远程URL导入分类
  const importFromRemoteUrl = async () => {
    if (!remoteUrl.trim()) {
      setError(t('enterValidUrl'));
      return;
    }

    try {
      setIsRemoteImporting(true);
      setError(null);

      const url = remoteUrl.trim();

      // 获取远程数据
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `远程请求失败: ${response.status} ${response.statusText}`
        );
      }

      const fileContent = await response.text();
      const importedCategories = JSON.parse(fileContent) as Category[];

      // 验证导入的数据格式
      if (!Array.isArray(importedCategories)) {
        throw new Error(t('invalidRemoteCategoryDataFormat'));
      }

      // 验证每个分类的结构
      const validCategories = importedCategories.filter((category) => {
        return (
          typeof category === "object" &&
          typeof category.id === "string" &&
          typeof category.name === "string" &&
          typeof category.enabled === "boolean" &&
          typeof category.createdAt === "string" &&
          typeof category.updatedAt === "string"
        );
      }).map((category) => ({
        ...category,
        // 确保有description和color字段
        description: category.description || "",
        color: category.color || "#6366f1",
      }));

      if (validCategories.length === 0) {
        throw new Error(t('noValidCategoriesInRemoteData'));
      }

      // 确认是否需要导入
      if (categories.length > 0) {
        const shouldImport = window.confirm(
          t('remoteImportCategoriesConfirm', [categories.length.toString(), validCategories.length.toString()])
        );

        if (shouldImport) {
          // 创建现有分类的Map，便于查找和更新
          const categoriesMap = new Map(categories.map(c => [c.id, c]));
          let addedCount = 0;
          let updatedCount = 0;

          validCategories.forEach(category => {
            if (categoriesMap.has(category.id)) {
              // 获取现有分类
              const existing = categoriesMap.get(category.id);
              // 待导入分类，合并现有分类属性
              const updatedCategory = { ...existing, ...category };
              // 排除 updatedAt 字段进行比较
              if (existing && JSON.stringify((({ updatedAt, ...rest }) => rest)(existing)) !== JSON.stringify((({ updatedAt, ...rest }) => rest)(updatedCategory))) {
                categoriesMap.set(category.id, {
                  ...updatedCategory,
                  updatedAt: new Date().toISOString(),
                });
                updatedCount++;
              }
            } else {
              // 添加新分类
              categoriesMap.set(category.id, {
                ...category,
                createdAt: category.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              addedCount++;
            }
          });

          if (addedCount === 0 && updatedCount === 0) {
            alert(t('noNewCategoriesFound'));
            closeRemoteImportModal();
            return;
          }

          const newCategories = Array.from(categoriesMap.values());
          setCategories(newCategories);
          await saveCategories(newCategories);

          // 重新加载提示词数量
          const counts: Record<string, number> = {};
          for (const category of newCategories) {
            counts[category.id] = await getPromptCountByCategory(category.id);
          }
          setPromptCounts(counts);

          alert(t('importSuccessful', [(addedCount + updatedCount).toString()]));
          closeRemoteImportModal();
        } else {
          // 用户取消导入
          closeRemoteImportModal();
        }
      } else {
        // 没有现有分类，直接保存导入的分类
        setCategories(validCategories);
        await saveCategories(validCategories);

        // 重新加载提示词数量
        const counts: Record<string, number> = {};
        for (const category of validCategories) {
          counts[category.id] = await getPromptCountByCategory(category.id);
        }
        setPromptCounts(counts);

        alert(t('importSuccessful', [validCategories.length.toString()]));
        closeRemoteImportModal();
      }
    } catch (err) {
      console.error(t('remoteImportCategoriesError'), err);
      setError(
        t('remoteImportCategoriesFailed', [err instanceof Error ? err.message : t('unknownError')])
      );
    } finally {
      setIsRemoteImporting(false);
    }
  };

  // 主题切换逻辑
  useEffect(() => {
    const updateTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.remove("light");
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      }
    };

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      updateTheme(true);
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      updateTheme(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  if (isLoading) {
    return (
      <PageSurface>
        <LoadingState title={t('loading')} description={t('loadingMessage')} />
      </PageSurface>
    );
  }

  return (
    <PageSurface className="flex min-h-full flex-col">
      <div className="flex-shrink-0 space-y-4 px-4 pt-4 sm:px-6 lg:px-8">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{error}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setError(null)}
                aria-label={t("close")}
                className="text-destructive hover:bg-destructive/10"
              >
                <X className="size-4" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <PageHeader
          icon={Tags}
          title={t('categoryManagement')}
          actions={
            <>
              <Button
                onClick={exportCategories}
                disabled={categories.length === 0}
                variant="outline"
                size="sm"
                title={categories.length === 0 ? t('noCategoriesToExport') : t('exportAllCategories')}
              >
                <Download className="size-4" />
                {t('exportCategories')}
              </Button>
              <Button onClick={triggerFileInput} variant="outline" size="sm" title={t('localImportCategories')}>
                <FileInput className="size-4" />
                {t('localImportCategories')}
              </Button>
              <Button onClick={openRemoteImportModal} variant="outline" size="sm" title={t('importCategoriesFromUrl')}>
                <Link2 className="size-4" />
                {t('remoteImportCategories')}
              </Button>
              <Button onClick={openAddModal} size="sm">
                <Plus className="size-4" />
                {t('addCategory')}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={importCategories}
                accept=".json"
                className="hidden"
              />
            </>
          }
        />

        <SectionCard contentClassName="pt-6">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('searchCategory')}
              className="pl-9"
            />
          </div>
        </SectionCard>
      </div>

      <div className="thin-scrollbar flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-6 lg:px-8">

        {/* 分类列表 */}
        <CategoryList
          categories={filteredCategories}
          onEdit={startEdit}
          onDelete={handleDeleteCategory}
          searchTerm={searchTerm}
          allCategoriesCount={categories.length}
          onToggleEnabled={toggleCategoryEnabled}
          onSelect={selectCategoryPrompts}
          promptCounts={promptCounts}
        />

        {filteredCategories.length === 0 && (
          <EmptyState
            icon={FolderKanban}
            title={searchTerm ? t('noMatchingCategories2') : t('noCategories')}
            description={searchTerm ? undefined : t('createFirstCategory')}
            actionLabel={searchTerm ? t('clearSearch') : t('createFirstCategory')}
            onAction={searchTerm ? () => setSearchTerm("") : openAddModal}
          />
        )}

        {/* 添加/编辑分类模态框 */}
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={editingCategory ? t('editCategory') : t('addCategory')}
          icon={editingCategory ? FilePenLine : Plus}
        >
          <CategoryForm
            onSubmit={handleCategorySubmit}
            initialData={editingCategory}
            onCancel={cancelEdit}
            isEditing={!!editingCategory}
          />
        </Modal>

        {/* 远程导入模态框 */}
        <Modal
          isOpen={isRemoteImportModalOpen}
          onClose={closeRemoteImportModal}
          title={t('importCategoriesFromUrl')}
          icon={Link2}
        >
          <div className="space-y-6 pt-2">
            <Alert variant="info">
              <AlertCircle className="size-4" />
              <AlertTitle>{t('importInstructions')}</AlertTitle>
              <AlertDescription>{t('importCategoriesInstructionsDetail')}</AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <label htmlFor="remote-url" className="mb-2 block text-sm font-semibold text-foreground">
                  {t('remoteUrl')}
                </label>
                <div className="relative">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    id="remote-url"
                    value={remoteUrl}
                    onChange={handleRemoteUrlChange}
                    placeholder="https://example.com/categories.json"
                    className="pl-9"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>{t('importFailed')}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button
                onClick={closeRemoteImportModal}
                variant="outline"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={importFromRemoteUrl}
                disabled={isRemoteImporting || !remoteUrl.trim()}
              >
                {isRemoteImporting ? (
                  <div className="flex items-center gap-2">
                    <Upload className="size-4 animate-pulse" />
                    {t('importing')}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Upload className="size-4" />
                    {t('startImport')}
                  </div>
                )}
              </Button>
            </div>
          </div>
        </Modal>

        {/* 确认删除对话框 */}
        <ConfirmModal
          isOpen={isConfirmModalOpen}
          onClose={() => {
            setIsConfirmModalOpen(false);
            setCategoryToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title={t('confirmDeleteCategory')}
          message={t('confirmDeleteCategoryMessage')} // Message as string
          confirmText={t('delete')}
          cancelText={t('cancel')}
        />
      </div>
    </PageSurface>
  );
};

export default CategoryManager;
