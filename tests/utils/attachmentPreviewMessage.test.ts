import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromptAttachment } from '@/utils/types'

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }))

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentRootHandle: vi.fn(),
  getFileFromAttachmentRoot: vi.fn(),
  verifyReadWritePermission: vi.fn(),
}))

const fs = await import('@/utils/attachments/fileSystem')
const { buildAttachmentPreviewResponse } = await import('@/utils/browser/messageHandler')

const createAttachment = (overrides: Partial<PromptAttachment> = {}): PromptAttachment => ({
  id: 'attachment-1',
  name: 'image.png',
  type: 'image/png',
  size: 4,
  relativePath: 'attachments/prompt-1/attachment-1-image.png',
  createdAt: '2026-04-26T00:00:00.000Z',
  ...overrides,
})

describe('buildAttachmentPreviewResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an ArrayBuffer and content type for image attachments', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue({ name: 'root' } as any)
    vi.mocked(fs.verifyReadWritePermission).mockResolvedValue(true)
    vi.mocked(fs.getFileFromAttachmentRoot).mockResolvedValue(new File(['data'], 'image.png', { type: 'image/png' }))

    const response = await buildAttachmentPreviewResponse(createAttachment())

    expect(response.success).toBe(true)
    if (!response.success) throw new Error('Expected success response')
    expect(response.buffer).toBeInstanceOf(ArrayBuffer)
    expect(new TextDecoder().decode(response.buffer)).toBe('data')
    expect(response.contentType).toBe('image/png')
  })

  it('returns a failure when the root handle is unavailable', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue(undefined)

    const response = await buildAttachmentPreviewResponse(createAttachment())

    expect(response).toEqual({ success: false, error: 'attachmentPermissionLost' })
    expect(fs.getFileFromAttachmentRoot).not.toHaveBeenCalled()
  })

  it('returns a failure when root permission is unavailable', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue({ name: 'root' } as any)
    vi.mocked(fs.verifyReadWritePermission).mockResolvedValue(false)

    const response = await buildAttachmentPreviewResponse(createAttachment())

    expect(response).toEqual({ success: false, error: 'attachmentPermissionLost' })
    expect(fs.getFileFromAttachmentRoot).not.toHaveBeenCalled()
  })
})
