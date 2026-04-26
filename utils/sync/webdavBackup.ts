import {
  WEBDAV_FILENAME,
  deserializeFromWebDavContent,
  ensureWebDavDirectory,
  getWebDavBlobFile,
  getWebDavTextFile,
  putWebDavFile,
  serializeToWebDavContent,
  type WebDavConfig,
} from "@/utils/sync/webdavSync";
import {
  copyFileToAttachmentRoot,
  getFileFromAttachmentRoot,
} from "@/utils/attachments/fileSystem";
import type { Category, PromptAttachment, PromptItem } from "@/utils/types";

export type WebDavBackupDownloadMode = "append" | "replace";

export interface WebDavBackupUploadResult {
  success: boolean;
  uploadedFiles: string[];
  errors: string[];
}

export interface WebDavBackupDownloadResult {
  success: boolean;
  prompts: PromptItem[];
  categories: Category[];
  downloadedFiles: string[];
  errors: string[];
}

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

const getPromptAttachments = (prompt: PromptItem): PromptAttachment[] => (
  Array.isArray(prompt.attachments) ? prompt.attachments : []
);

const getRemoteParentPath = (relativePath: string): string => {
  const segments = relativePath.split("/").filter(Boolean);
  return segments.slice(0, -1).join("/");
};

const getAttachmentFileName = (attachment: PromptAttachment): string => {
  const pathFileName = attachment.relativePath.split("/").filter(Boolean).at(-1);
  return attachment.name || pathFileName || "attachment";
};

const createFileFromBlob = (blob: Blob, attachment: PromptAttachment): File => (
  new File([blob], getAttachmentFileName(attachment), {
    type: blob.type || attachment.type || "application/octet-stream",
  })
);

const uploadAttachment = async (
  config: WebDavConfig,
  rootHandle: FileSystemDirectoryHandle,
  attachment: PromptAttachment
): Promise<void> => {
  const remoteParentPath = getRemoteParentPath(attachment.relativePath);

  if (remoteParentPath) {
    await ensureWebDavDirectory(config, remoteParentPath);
  } else {
    await ensureWebDavDirectory(config, "");
  }

  const file = await getFileFromAttachmentRoot(rootHandle, attachment.relativePath);
  await putWebDavFile(
    config,
    attachment.relativePath,
    file,
    file.type || attachment.type || "application/octet-stream"
  );
};

const downloadAttachment = async (
  config: WebDavConfig,
  rootHandle: FileSystemDirectoryHandle,
  attachment: PromptAttachment
): Promise<void> => {
  const blob = await getWebDavBlobFile(config, attachment.relativePath);
  await copyFileToAttachmentRoot(rootHandle, attachment.relativePath, createFileFromBlob(blob, attachment));
};

export const uploadWebDavBackup = async (
  config: WebDavConfig,
  rootHandle: FileSystemDirectoryHandle,
  prompts: PromptItem[],
  categories: Category[]
): Promise<WebDavBackupUploadResult> => {
  const uploadedFiles: string[] = [];
  const errors: string[] = [];

  try {
    await ensureWebDavDirectory(config, "");
    await putWebDavFile(
      config,
      WEBDAV_FILENAME,
      serializeToWebDavContent(prompts, categories),
      "application/json"
    );
    uploadedFiles.push(WEBDAV_FILENAME);
  } catch (error) {
    return {
      success: false,
      uploadedFiles,
      errors: [getErrorMessage(error)],
    };
  }

  for (const prompt of prompts) {
    for (const attachment of getPromptAttachments(prompt)) {
      try {
        await uploadAttachment(config, rootHandle, attachment);
        uploadedFiles.push(attachment.relativePath);
      } catch (error) {
        errors.push(`${attachment.relativePath}: ${getErrorMessage(error)}`);
      }
    }
  }

  return {
    success: errors.length === 0,
    uploadedFiles,
    errors,
  };
};

export const downloadWebDavBackup = async (
  config: WebDavConfig,
  rootHandle: FileSystemDirectoryHandle,
  localPrompts: PromptItem[],
  localCategories: Category[],
  mode: WebDavBackupDownloadMode
): Promise<WebDavBackupDownloadResult> => {
  const downloadedFiles: string[] = [];
  const errors: string[] = [];

  let remotePrompts: PromptItem[];
  let remoteCategories: Category[];

  try {
    const content = await getWebDavTextFile(config, WEBDAV_FILENAME);
    const data = deserializeFromWebDavContent(content);
    remotePrompts = data.prompts;
    remoteCategories = data.categories;
  } catch (error) {
    return {
      success: false,
      prompts: localPrompts,
      categories: localCategories,
      downloadedFiles,
      errors: [getErrorMessage(error)],
    };
  }

  const promptsToDownload = mode === "replace"
    ? remotePrompts
    : remotePrompts.filter((prompt) => !localPrompts.some((localPrompt) => localPrompt.id === prompt.id));

  for (const prompt of promptsToDownload) {
    for (const attachment of getPromptAttachments(prompt)) {
      try {
        await downloadAttachment(config, rootHandle, attachment);
        downloadedFiles.push(attachment.relativePath);
      } catch (error) {
        errors.push(`${attachment.relativePath}: ${getErrorMessage(error)}`);
      }
    }
  }

  if (mode === "replace") {
    return {
      success: errors.length === 0,
      prompts: remotePrompts,
      categories: remoteCategories,
      downloadedFiles,
      errors,
    };
  }

  const localPromptIds = new Set(localPrompts.map((prompt) => prompt.id));
  const localCategoryIds = new Set(localCategories.map((category) => category.id));

  return {
    success: errors.length === 0,
    prompts: [
      ...localPrompts,
      ...remotePrompts.filter((prompt) => !localPromptIds.has(prompt.id)),
    ],
    categories: [
      ...localCategories,
      ...remoteCategories.filter((category) => !localCategoryIds.has(category.id)),
    ],
    downloadedFiles,
    errors,
  };
};
