import type { PromptAttachment, PromptItem } from '@/utils/types'
import { buildAttachmentRelativePath } from '@/utils/attachments/metadata'
import {
  copyFileToAttachmentRoot,
  getFileFromAttachmentRoot,
  removeAttachmentFileFromRoot,
} from './fileSystem'

export const createAttachmentFromFile = async (
  rootHandle: FileSystemDirectoryHandle,
  promptId: string,
  file: File
): Promise<PromptAttachment> => {
  const id = crypto.randomUUID()
  const relativePath = buildAttachmentRelativePath(promptId, id, file.name)

  await copyFileToAttachmentRoot(rootHandle, relativePath, file)

  return {
    id,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    relativePath,
    createdAt: new Date().toISOString(),
  }
}

export const deletePromptAttachmentFiles = async (
  rootHandle: FileSystemDirectoryHandle,
  prompt: PromptItem
): Promise<void> => {
  for (const attachment of prompt.attachments || []) {
    await removeAttachmentFileFromRoot(rootHandle, attachment.relativePath)
  }
}

export const duplicatePromptAttachmentFiles = async (
  rootHandle: FileSystemDirectoryHandle,
  sourcePrompt: PromptItem,
  targetPromptId: string
): Promise<PromptAttachment[]> => {
  const duplicatedAttachments: PromptAttachment[] = []

  for (const attachment of sourcePrompt.attachments || []) {
    const file = await getFileFromAttachmentRoot(rootHandle, attachment.relativePath)
    const id = crypto.randomUUID()
    const relativePath = buildAttachmentRelativePath(targetPromptId, id, attachment.name)

    await copyFileToAttachmentRoot(rootHandle, relativePath, file)

    duplicatedAttachments.push({
      ...attachment,
      id,
      relativePath,
      createdAt: new Date().toISOString(),
    })
  }

  return duplicatedAttachments
}
