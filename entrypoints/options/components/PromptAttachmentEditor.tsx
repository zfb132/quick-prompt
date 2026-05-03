import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { FileText, FolderOpen, HardDrive, Loader2, Paperclip, Upload, X } from "lucide-react";

import type { PromptAttachment } from "@/utils/types";
import {
  type AttachmentStorageRootHandle,
  getAttachmentStorageMode,
  getAttachmentRootHandle,
  pickAndStoreAttachmentRoot,
  removeAttachmentDirectoryFromRoot,
  removeAttachmentFileFromRoot,
  useInternalAttachmentStorage,
  verifyReadWritePermission,
} from "@/utils/attachments/fileSystem";
import {
  buildPromptAttachmentDirectoryPath,
  formatFileSize,
  isImageAttachment,
} from "@/utils/attachments/metadata";
import {
  createAttachmentFromFile,
  isMissingAttachmentFileError,
} from "@/utils/attachments/promptAttachmentOperations";
import type { t as repoTranslate } from "@/utils/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PromptAttachmentEditorProps {
  promptId: string
  attachments: PromptAttachment[]
  onChange: (attachments: PromptAttachment[]) => void
  translate?: typeof repoTranslate
}

const defaultTranslate: typeof repoTranslate = (key) => key

const getAuthorizedRoot = async (translate: typeof repoTranslate): Promise<AttachmentStorageRootHandle> => {
  const root = await getAttachmentRootHandle()

  if (!root || !(await verifyReadWritePermission(root))) {
    throw new Error(translate('attachmentPermissionLost'))
  }

  return root
}

const getAttachmentType = (attachment: PromptAttachment): string => {
  return attachment.type || 'application/octet-stream'
}

const hasAuthorizedAttachmentStorage = async (): Promise<boolean> => {
  const mode = await getAttachmentStorageMode()

  if (mode === "internal") {
    return true
  }

  const root = await getAttachmentRootHandle()

  if (!root) {
    return false
  }

  return await verifyReadWritePermission(root)
}

const PromptAttachmentEditor = ({
  promptId,
  attachments,
  onChange,
  translate = defaultTranslate,
}: PromptAttachmentEditorProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isStorageDialogOpen, setIsStorageDialogOpen] = useState(false)
  const [isCheckingStorage, setIsCheckingStorage] = useState(false)
  const [isChoosingInternal, setIsChoosingInternal] = useState(false)
  const [isChoosingExternal, setIsChoosingExternal] = useState(false)
  const isExternalStorageUnsupported = typeof window.showDirectoryPicker !== "function"
  const isChoosingStorage = isChoosingInternal || isChoosingExternal

  const openFilePicker = () => {
    inputRef.current?.click()
  }

  const handleAddAttachmentClick = async () => {
    if (busy || isCheckingStorage || isChoosingStorage) return

    setError(null)
    setIsCheckingStorage(true)

    try {
      if (await hasAuthorizedAttachmentStorage()) {
        openFilePicker()
        return
      }

      setIsStorageDialogOpen(true)
    } catch (err) {
      console.error(translate("attachmentPermissionLost"), err)
      setIsStorageDialogOpen(true)
    } finally {
      setIsCheckingStorage(false)
    }
  }

  const chooseInternalStorage = async () => {
    setError(null)
    setIsChoosingInternal(true)

    try {
      await useInternalAttachmentStorage()
      setIsStorageDialogOpen(false)
      openFilePicker()
    } catch (err) {
      console.error(translate("attachmentStoragePermissionRequired"), err)
      setError(translate("attachmentStoragePermissionRequired"))
    } finally {
      setIsChoosingInternal(false)
    }
  }

  const chooseAttachmentDirectory = async () => {
    setError(null)
    setIsChoosingExternal(true)

    try {
      await pickAndStoreAttachmentRoot()
      setIsStorageDialogOpen(false)
      openFilePicker()
    } catch (err) {
      console.error(translate("attachmentStoragePermissionRequired"), err)
      setError(translate("attachmentStoragePermissionRequired"))
    } finally {
      setIsChoosingExternal(false)
    }
  }

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setBusy(true);
    setError(null);

    try {
      const root = await getAuthorizedRoot(translate);
      const created: PromptAttachment[] = [];

      for (const file of files) {
        created.push(await createAttachmentFromFile(root, promptId, file));
      }

      onChange([...attachments, ...created]);
    } catch (err) {
      console.error(translate("attachmentAddFailed"), err);
      setError(err instanceof Error ? err.message : translate("attachmentAddFailed"));
    } finally {
      setBusy(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleRemove = async (attachment: PromptAttachment) => {
    setBusy(true);
    setError(null);
    const nextAttachments = attachments.filter((item) => item.id !== attachment.id);

    try {
      const root = await getAuthorizedRoot(translate);
      try {
        await removeAttachmentFileFromRoot(root, attachment.relativePath);
      } catch (err) {
        if (!isMissingAttachmentFileError(err)) {
          throw err;
        }
      }

      if (nextAttachments.length === 0) {
        await removeAttachmentDirectoryFromRoot(root, buildPromptAttachmentDirectoryPath(promptId));
      }

      onChange(nextAttachments);
    } catch (err) {
      console.error(translate("attachmentRemoveFailed"), err);
      setError(err instanceof Error ? err.message : translate("attachmentRemoveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Paperclip className="size-4 text-muted-foreground" />
          {translate("attachmentsLabel")}
          <span className="font-normal text-muted-foreground">({translate("attachmentsOptional")})</span>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddAttachmentClick}
          disabled={busy || isCheckingStorage || isChoosingStorage}
        >
          {busy || isCheckingStorage ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {translate("addAttachment")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={busy}
          aria-label={translate("addAttachment")}
          onChange={handleFilesSelected}
          className="hidden"
        />
      </div>

      <Dialog open={isStorageDialogOpen} onOpenChange={(open) => {
        if (!isChoosingStorage) {
          setIsStorageDialogOpen(open)
          if (!open) {
            setError(null)
          }
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{translate("attachmentStorageTitle")}</DialogTitle>
            <DialogDescription>
              {translate("attachmentStorageDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-6">
            {error && (
              <Alert variant="destructive" className="py-3">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isExternalStorageUnsupported && (
              <Alert variant="warning" className="py-3">
                <AlertDescription>{translate("attachmentStorageUnsupported")}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={chooseAttachmentDirectory}
                disabled={isExternalStorageUnsupported || isChoosingStorage}
                className="group flex min-h-40 flex-col items-start rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left shadow-sm transition-all hover:border-primary/35 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-background text-primary shadow-sm ring-1 ring-border">
                  {isChoosingExternal ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
                </span>
                <Badge variant="secondary" className="mb-3 border-primary/15 bg-primary/10 text-primary">
                  {translate("attachmentStorageRecommended")}
                </Badge>
                <span className="text-sm font-semibold text-foreground">
                  {translate("useExternalAttachmentStorage")}
                </span>
                <span className="mt-2 text-xs leading-5 text-muted-foreground">
                  {translate("useExternalAttachmentStorageDescription")}
                </span>
              </button>

              <button
                type="button"
                onClick={chooseInternalStorage}
                disabled={isChoosingStorage}
                className="group flex min-h-40 flex-col items-start rounded-2xl border border-border bg-background/80 p-4 text-left shadow-sm transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground shadow-sm ring-1 ring-border">
                  {isChoosingInternal ? <Loader2 className="size-4 animate-spin" /> : <HardDrive className="size-4" />}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {translate("useBuiltInAttachmentStorage")}
                </span>
                <span className="mt-2 text-xs leading-5 text-muted-foreground">
                  {translate("useBuiltInAttachmentStorageDescription")}
                </span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {error && !isStorageDialogOpen && (
        <Alert variant="destructive" className="py-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {attachments.length > 0 && (
        <ul className="space-y-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-background text-muted-foreground ring-1 ring-border">
                  {isImageAttachment(attachment) && attachment.thumbnailDataUrl ? (
                    <img
                      src={attachment.thumbnailDataUrl}
                      alt={attachment.name}
                      loading="lazy"
                      decoding="async"
                      className="size-9 object-cover"
                    />
                  ) : (
                    <FileText className="size-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{attachment.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                  {getAttachmentType(attachment)} · {formatFileSize(attachment.size)}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                aria-label={translate("removeAttachment")}
                onClick={() => handleRemove(attachment)}
                className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PromptAttachmentEditor;
