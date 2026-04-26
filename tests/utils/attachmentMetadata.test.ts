import { describe, expect, it } from 'vitest'
import type { PromptItem } from '@/utils/types'
import {
  ATTACHMENTS_DIR_NAME,
  buildAttachmentRelativePath,
  formatFileSize,
  isImageAttachment,
  normalizePromptAttachments,
  sanitizeFileName,
} from '@/utils/attachments/metadata'

const createPrompt = (overrides: Partial<PromptItem> = {}): PromptItem => ({
  id: 'prompt-1',
  title: 'Prompt',
  content: 'Content',
  tags: [],
  enabled: true,
  categoryId: 'default',
  ...overrides,
})

describe('attachment metadata helpers', () => {
  it('sanitizes file names without changing safe names', () => {
    expect(sanitizeFileName('photo.png')).toBe('photo.png')
    expect(sanitizeFileName('../secret:file?.png')).toBe('secret-file-.png')
    expect(sanitizeFileName('   ')).toBe('attachment')
  })

  it('builds stable relative paths for prompt attachments', () => {
    expect(buildAttachmentRelativePath('prompt-1', 'att-1', 'a/b.txt')).toBe(
      `${ATTACHMENTS_DIR_NAME}/prompt-1/att-1-a-b.txt`
    )
  })

  it('formats file sizes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1023)).toBe('1023 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(1048576)).toBe('1 MB')
  })

  it('detects image attachments by mime type', () => {
    expect(isImageAttachment({ id: '1', name: 'a', type: 'image/png', size: 1, relativePath: 'x', createdAt: 'now' })).toBe(true)
    expect(isImageAttachment({ id: '2', name: 'a', type: 'application/pdf', size: 1, relativePath: 'x', createdAt: 'now' })).toBe(false)
  })

  it('normalizes prompts to always have an attachments array', () => {
    expect(normalizePromptAttachments(createPrompt()).attachments).toEqual([])
    expect(
      normalizePromptAttachments(createPrompt({
        attachments: [{ id: 'a', name: 'f.txt', type: '', size: 1, relativePath: 'attachments/prompt-1/a-f.txt', createdAt: '2024-01-01T00:00:00.000Z' }],
      })).attachments
    ).toHaveLength(1)
  })
})
