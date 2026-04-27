import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromptItem } from '@/utils/types'
import {
  createAttachmentFromFile,
  deletePromptAttachmentFiles,
  duplicatePromptAttachmentFiles,
} from '@/utils/attachments/promptAttachmentOperations'

vi.mock('@/utils/attachments/fileSystem', () => ({
  copyFileToAttachmentRoot: vi.fn(),
  getFileFromAttachmentRoot: vi.fn(),
  removeAttachmentDirectoryFromRoot: vi.fn(),
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

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
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

  it('stores a generated thumbnail for large image attachments without changing the original file', async () => {
    const imageBitmap = { width: 4000, height: 2000, close: vi.fn() }
    const drawImage = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(imageBitmap))
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({ drawImage })),
          toDataURL: vi.fn(() => 'data:image/webp;base64,thumbnail'),
        } as unknown as HTMLCanvasElement
      }

      return originalCreateElement(tagName)
    })

    const file = new File([new Uint8Array(8 * 1024 * 1024)], 'large.png', { type: 'image/png' })

    const attachment = await createAttachmentFromFile({} as any, 'prompt-1', file)

    expect(attachment.thumbnailDataUrl).toBe('data:image/webp;base64,thumbnail')
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledWith(
      {} as any,
      'attachments/prompt-1/att-1-large.png',
      file
    )
    expect(drawImage).toHaveBeenCalledWith(imageBitmap, 0, 0, 192, 96)
    expect(imageBitmap.close).toHaveBeenCalled()
  })

  it('still adds an image when browser thumbnail decoding reports the source file as missing', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new DOMException('A requested file or directory could not be found at the time an operation was processed.', 'NotFoundError'))
    )

    const file = new File(['image-bytes'], 'missing-source.png', { type: 'image/png' })

    const attachment = await createAttachmentFromFile({} as any, 'prompt-1', file)

    expect(attachment).toMatchObject({
      id: 'att-1',
      name: 'missing-source.png',
      relativePath: 'attachments/prompt-1/att-1-missing-source.png',
    })
    expect(attachment.thumbnailDataUrl).toBeUndefined()
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledWith(
      {} as any,
      'attachments/prompt-1/att-1-missing-source.png',
      file
    )
  })

  it('deletes every attachment file on a prompt', async () => {
    await deletePromptAttachmentFiles({} as any, createPrompt({
      attachments: [
        { id: 'a', name: 'a.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/a-a.txt', createdAt: 'now' },
        { id: 'b', name: 'b.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/b-b.txt', createdAt: 'now' },
      ],
    }))

    expect(fileSystem.removeAttachmentFileFromRoot).toHaveBeenCalledTimes(2)
    expect(fileSystem.removeAttachmentDirectoryFromRoot).toHaveBeenCalledWith({} as any, 'attachments/prompt-1')
  })

  it('deletes the prompt attachment directory even when prompt metadata has no attachments', async () => {
    await deletePromptAttachmentFiles({} as any, createPrompt({
      attachments: [],
    }))

    expect(fileSystem.removeAttachmentFileFromRoot).not.toHaveBeenCalled()
    expect(fileSystem.removeAttachmentDirectoryFromRoot).toHaveBeenCalledWith({} as any, 'attachments/prompt-1')
  })

  it('ignores missing attachment files while deleting prompt attachments', async () => {
    vi.mocked(fileSystem.removeAttachmentFileFromRoot).mockRejectedValueOnce(new DOMException('Missing', 'NotFoundError'))

    await expect(deletePromptAttachmentFiles({} as any, createPrompt({
      attachments: [
        { id: 'a', name: 'a.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/a-a.txt', createdAt: 'now' },
      ],
    }))).resolves.toBeUndefined()
  })

  it('attempts every attachment deletion when one has a hard failure', async () => {
    vi.mocked(fileSystem.removeAttachmentFileFromRoot)
      .mockRejectedValueOnce(new Error('disk write failed'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)

    await expect(deletePromptAttachmentFiles({} as any, createPrompt({
      attachments: [
        { id: 'a', name: 'a.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/a-a.txt', createdAt: 'now' },
        { id: 'b', name: 'b.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/b-b.txt', createdAt: 'now' },
        { id: 'c', name: 'c.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/c-c.txt', createdAt: 'now' },
      ],
    }))).rejects.toThrow('Failed to delete 1 attachment file')

    expect(fileSystem.removeAttachmentFileFromRoot).toHaveBeenCalledTimes(3)
  })

  it('reports hard deletion failures after all attempts', async () => {
    const error = new Error('permission denied')
    vi.mocked(fileSystem.removeAttachmentFileFromRoot)
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(new Error('No such file'))

    await expect(deletePromptAttachmentFiles({} as any, createPrompt({
      attachments: [
        { id: 'a', name: 'a.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/a-a.txt', createdAt: 'now' },
        { id: 'b', name: 'b.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/b-b.txt', createdAt: 'now' },
      ],
    }))).rejects.toMatchObject({
      message: expect.stringContaining('Failed to delete 1 attachment file'),
    })

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
