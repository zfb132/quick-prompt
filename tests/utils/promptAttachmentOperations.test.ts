import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromptItem } from '@/utils/types'
import {
  createAttachmentFromFile,
  deletePromptAttachmentFiles,
  duplicatePromptAttachmentFiles,
} from '@/utils/attachments/promptAttachmentOperations'

vi.mock('@/utils/attachments/fileSystem', () => ({
  copyFileToAttachmentRoot: vi.fn(),
  getFileFromAttachmentRoot: vi.fn(),
  removeAttachmentFileFromRoot: vi.fn(),
}))

const fileSystem = await import('@/utils/attachments/fileSystem')

const mockUuid = (id: string): ReturnType<Crypto['randomUUID']> => id as ReturnType<Crypto['randomUUID']>

const createPrompt = (overrides: Partial<PromptItem> = {}): PromptItem => ({
  id: 'prompt-1',
  title: 'Prompt',
  content: 'Content',
  tags: [],
  enabled: true,
  categoryId: 'default',
  attachments: [],
  ...overrides,
})

describe('prompt attachment operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUuid('att-1'))
  })

  it('copies a selected file and returns metadata', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })

    const attachment = await createAttachmentFromFile({} as any, 'prompt-1', file)

    expect(attachment).toMatchObject({
      id: 'att-1',
      name: 'hello.txt',
      type: 'text/plain',
      size: 5,
      relativePath: 'attachments/prompt-1/att-1-hello.txt',
    })
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledWith({} as any, 'attachments/prompt-1/att-1-hello.txt', file)
  })

  it('deletes every attachment file on a prompt', async () => {
    await deletePromptAttachmentFiles({} as any, createPrompt({
      attachments: [
        { id: 'a', name: 'a.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/a-a.txt', createdAt: 'now' },
        { id: 'b', name: 'b.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/b-b.txt', createdAt: 'now' },
      ],
    }))

    expect(fileSystem.removeAttachmentFileFromRoot).toHaveBeenCalledTimes(2)
  })

  it('duplicates files and rewrites metadata for a new prompt id', async () => {
    vi.mocked(fileSystem.getFileFromAttachmentRoot).mockResolvedValue(new File(['data'], 'source.txt', { type: 'text/plain' }))
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce(mockUuid('copy-1'))

    const attachments = await duplicatePromptAttachmentFiles({} as any, createPrompt({
      attachments: [
        { id: 'source', name: 'source.txt', type: 'text/plain', size: 4, relativePath: 'attachments/prompt-1/source-source.txt', createdAt: 'now' },
      ],
    }), 'prompt-2')

    expect(attachments[0].id).toBe('copy-1')
    expect(attachments[0].relativePath).toBe('attachments/prompt-2/copy-1-source.txt')
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledWith({} as any, 'attachments/prompt-2/copy-1-source.txt', expect.any(File))
  })
})
