import type { PromptAttachment, PromptItem } from '@/utils/types'
import { buildAttachmentRelativePath } from '@/utils/attachments/metadata'
import {
  type AttachmentStorageRootHandle,
  copyFileToAttachmentRoot,
  getFileFromAttachmentRoot,
  removeAttachmentFileFromRoot,
} from './fileSystem'

export const isMissingAttachmentFileError = (err: unknown): boolean => {
  if (err instanceof DOMException && err.name === 'NotFoundError') {
    return true
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase()
    return err.name === 'NotFoundError'
      || message.includes('notfound')
      || message.includes('not found')
      || message.includes('missing')
      || message.includes('no such file')
  }

  return false
}

export const createAttachmentFromFile = async (
  rootHandle: AttachmentStorageRootHandle,
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
  rootHandle: AttachmentStorageRootHandle,
  prompt: PromptItem
): Promise<void> => {
  const errors: unknown[] = []

  for (const attachment of prompt.attachments || []) {
    try {
      await removeAttachmentFileFromRoot(rootHandle, attachment.relativePath)
    } catch (err) {
      if (!isMissingAttachmentFileError(err)) {
        errors.push(err)
      }
    }
  }

  if (errors.length > 0) {
    const message = `Failed to delete ${errors.length} attachment file${errors.length === 1 ? '' : 's'}`

    if (typeof AggregateError === 'function') {
      throw new AggregateError(errors, message)
    }

    throw new Error(message)
  }
}

export const duplicatePromptAttachmentFiles = async (
  rootHandle: AttachmentStorageRootHandle,
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
