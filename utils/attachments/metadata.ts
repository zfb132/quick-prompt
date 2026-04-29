import type { PromptAttachment, PromptItem } from '@/utils/types'

export type PromptItemWithAttachments = PromptItem & { attachments: PromptAttachment[] }

export const ATTACHMENTS_DIR_NAME = 'attachments'

export const sanitizeFileName = (fileName: string): string => {
  const sanitized = fileName
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/[:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.-]+/, '')

  return sanitized || 'attachment'
}

export const buildAttachmentRelativePath = (
  promptId: string,
  attachmentId: string,
  fileName: string
): string => {
  return `${ATTACHMENTS_DIR_NAME}/${promptId}/${attachmentId}-${sanitizeFileName(fileName)}`
}

export const buildPromptAttachmentDirectoryPath = (promptId: string): string => {
  return `${ATTACHMENTS_DIR_NAME}/${promptId}`
}

export const getAttachmentPathSegments = (relativePath: string): string[] => {
  return relativePath.split('/').filter(Boolean)
}

export const isImageAttachment = (attachment: Pick<PromptAttachment, 'type'>): boolean => {
  return attachment.type.toLowerCase().startsWith('image/')
}

export const formatFileSize = (size: number): string => {
  if (!Number.isFinite(size) || size <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value = value / 1024
    unitIndex++
  }

  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, '')
  return `${formatted} ${units[unitIndex]}`
}

export const normalizePromptAttachments = (prompt: PromptItem): PromptItemWithAttachments => {
  return {
    ...prompt,
    attachments: Array.isArray(prompt.attachments) ? prompt.attachments : [],
  }
}
