import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromptAttachment, PromptItem } from '@/utils/types'

vi.mock('#imports', () => ({
  storage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
  },
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('../../utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('@/utils/attachments/promptAttachmentOperations', () => ({
  deletePromptAttachmentFiles: vi.fn(),
  duplicatePromptAttachmentFiles: vi.fn(),
}))

const operations = await import('@/utils/attachments/promptAttachmentOperations')
const {
  buildPromptDuplicate,
  deletePromptWithAttachments,
  formatPromptBackupFileName,
} = await import('@/entrypoints/options/components/PromptManager')

const createAttachment = (overrides: Partial<PromptAttachment> = {}): PromptAttachment => ({
  id: 'att-1',
  name: 'file.txt',
  type: 'text/plain',
  size: 4,
  relativePath: 'attachments/prompt-1/att-1-file.txt',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

const createPrompt = (overrides: Partial<PromptItem> = {}): PromptItem => ({
  id: 'prompt-1',
  title: 'Prompt',
  content: 'Content',
  tags: [],
  enabled: true,
  categoryId: 'default',
  attachments: [createAttachment()],
  lastModified: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

describe('PromptManager attachment lifecycle helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes attachment files before removing prompt metadata', async () => {
    const root = { name: 'root' } as FileSystemDirectoryHandle
    const prompt = createPrompt()
    const prompts = [prompt, createPrompt({ id: 'prompt-2', title: 'Other', attachments: [] })]
    const events: string[] = []

    vi.mocked(operations.deletePromptAttachmentFiles).mockImplementation(async () => {
      events.push('files-deleted')
    })

    const result = await deletePromptWithAttachments(root, prompts, 'prompt-1')
    events.push('metadata-removed')

    expect(operations.deletePromptAttachmentFiles).toHaveBeenCalledWith(root, prompt)
    expect(result).toEqual([expect.objectContaining({ id: 'prompt-2' })])
    expect(events).toEqual(['files-deleted', 'metadata-removed'])
  })

  it('duplicates attachment files for copied prompts', async () => {
    const root = { name: 'root' } as FileSystemDirectoryHandle
    const copiedAttachments = [
      createAttachment({
        id: 'att-copy',
        relativePath: 'attachments/prompt-copy/att-copy-file.txt',
      }),
    ]

    vi.spyOn(crypto, 'randomUUID').mockReturnValue('prompt-copy' as ReturnType<Crypto['randomUUID']>)
    vi.mocked(operations.duplicatePromptAttachmentFiles).mockResolvedValue(copiedAttachments)

    const duplicate = await buildPromptDuplicate(root, createPrompt(), 'Copy')

    expect(operations.duplicatePromptAttachmentFiles).toHaveBeenCalledWith(root, expect.objectContaining({ id: 'prompt-1' }), 'prompt-copy')
    expect(duplicate).toMatchObject({
      id: 'prompt-copy',
      title: 'Prompt (Copy)',
      pinned: false,
      attachments: copiedAttachments,
    })

    vi.restoreAllMocks()
  })

  it('formats prompt backup export file names with compact local timestamps', () => {
    expect(formatPromptBackupFileName(new Date(2026, 3, 30, 9, 4, 5))).toBe(
      'quick-prompt-backup-20260430090405.zip'
    )
  })
})
