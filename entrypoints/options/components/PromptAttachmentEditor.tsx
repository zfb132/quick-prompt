import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { FileText, Loader2, Paperclip, Upload, X } from "lucide-react";

import type { PromptAttachment } from "@/utils/types";
import {
  type AttachmentStorageRootHandle,
  getAttachmentRootHandle,
  removeAttachmentDirectoryFromRoot,
  removeAttachmentFileFromRoot,
  verifyReadWritePermission,
} from "@/utils/attachments/fileSystem";
import {
  buildPromptAttachmentDirectoryPath,
  formatFileSize,
} from "@/utils/attachments/metadata";
import {
  createAttachmentFromFile,
  isMissingAttachmentFileError,
} from "@/utils/attachments/promptAttachmentOperations";
import type { t as repoTranslate } from "@/utils/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const PromptAttachmentEditor = ({
  promptId,
  attachments,
  onChange,
  translate = defaultTranslate,
}: PromptAttachmentEditorProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <label
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "cursor-pointer",
            busy && "pointer-events-none opacity-50",
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
          {translate("addAttachment")}
          <input
            ref={inputRef}
            type="file"
            multiple
            disabled={busy}
            aria-label={translate("addAttachment")}
            onChange={handleFilesSelected}
            className="hidden"
          />
        </label>
      </div>

      {error && (
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
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-muted-foreground ring-1 ring-border">
                  <FileText className="size-4" />
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
