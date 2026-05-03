import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { PromptAttachment } from '@/utils/types'

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }))

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentRootHandle: vi.fn(),
  getFileFromAttachmentRoot: vi.fn(),
  hasReadWritePermission: vi.fn(),
  verifyReadWritePermission: vi.fn(),
}))

vi.mock('@/utils/attachments/imageThumbnail', () => ({
  createImageThumbnailDataUrl: vi.fn(),
}))

const fs = await import('@/utils/attachments/fileSystem')
const imageThumbnail = await import('@/utils/attachments/imageThumbnail')

const { default: PromptAttachmentPreview } = await import('@/entrypoints/options/components/PromptAttachmentPreview')

const createAttachment = (overrides: Partial<PromptAttachment> = {}): PromptAttachment => ({
  id: 'attachment-1',
  name: 'image.png',
  type: 'image/png',
  size: 1536,
  relativePath: 'attachments/prompt-1/attachment-1-image.png',
  createdAt: '2026-04-26T00:00:00.000Z',
  ...overrides,
})

describe('PromptAttachmentPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:preview-url'),
      revokeObjectURL: vi.fn(),
    })
    vi.mocked(imageThumbnail.createImageThumbnailDataUrl).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders an image preview when the stored attachment file can be read', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue({ name: 'root' } as any)
    vi.mocked(fs.hasReadWritePermission).mockResolvedValue(true)
    vi.mocked(fs.getFileFromAttachmentRoot).mockResolvedValue(new File(['image-bytes'], 'image.png', { type: 'image/png' }))

    render(<PromptAttachmentPreview attachments={[createAttachment()]} />)

    const image = await screen.findByRole('img', { name: 'image.png' })
    const outerTile = image.closest('div')

    expect(image).toHaveAttribute('src', 'blob:preview-url')
    expect(image).toHaveClass('w-20', 'h-20')
    expect(image).toHaveClass('border', 'border-border', 'rounded-xl')
    expect(outerTile).not.toHaveClass('border')
    expect(outerTile).toHaveAttribute('title', 'image.png (1.5 KB)')
    expect(screen.queryByText('image.png')).not.toBeInTheDocument()
    expect(screen.queryByText('1.5 KB')).not.toBeInTheDocument()
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(File))
    expect(fs.verifyReadWritePermission).not.toHaveBeenCalled()
  })

  it('keeps compact image previews to a single inner border without visible metadata', async () => {
    render(
      <PromptAttachmentPreview
        compact
        attachments={[
          createAttachment({ thumbnailDataUrl: 'data:image/webp;base64,thumbnail' }),
        ]}
      />
    )

    const image = screen.getByRole('img', { name: 'image.png' })
    const outerTile = image.closest('div')

    expect(image).toHaveClass('w-12', 'h-12')
    expect(image).toHaveClass('border', 'border-border', 'rounded-xl')
    expect(outerTile).not.toHaveClass('border')
    expect(outerTile).toHaveAttribute('title', 'image.png (1.5 KB)')
    expect(screen.queryByText('image.png')).not.toBeInTheDocument()
    expect(screen.queryByText('1.5 KB')).not.toBeInTheDocument()
  })

  it('uses stored thumbnail data without reading the original file until opening the viewer', async () => {
    vi.mocked(URL.createObjectURL).mockReturnValue('blob:full-image')
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue({ name: 'root' } as any)
    vi.mocked(fs.hasReadWritePermission).mockResolvedValue(true)
    vi.mocked(fs.getFileFromAttachmentRoot).mockResolvedValue(new File(['image-bytes'], 'image.png', { type: 'image/png' }))

    render(
      <PromptAttachmentPreview
        attachments={[
          createAttachment({ thumbnailDataUrl: 'data:image/webp;base64,thumbnail' }),
        ]}
      />
    )

    const image = screen.getByRole('img', { name: 'image.png' })
    expect(image).toHaveAttribute('src', 'data:image/webp;base64,thumbnail')
    expect(fs.getAttachmentRootHandle).not.toHaveBeenCalled()
    expect(fs.getFileFromAttachmentRoot).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'image.png' }))

    const dialog = await screen.findByRole('dialog', { name: 'imagePreviewDialog' })
    await waitFor(() => {
      expect(within(dialog).getByRole('img', { name: 'image.png' })).toHaveAttribute('src', 'blob:full-image')
    })
    expect(fs.getAttachmentRootHandle).toHaveBeenCalledTimes(1)
    expect(fs.getFileFromAttachmentRoot).toHaveBeenCalledTimes(1)
  })

  it('prefers a newly stored thumbnail over a previously loaded runtime preview', async () => {
    vi.mocked(URL.createObjectURL).mockReturnValue('blob:stale-preview')
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue({ name: 'root' } as any)
    vi.mocked(fs.hasReadWritePermission).mockResolvedValue(true)
    vi.mocked(fs.getFileFromAttachmentRoot).mockResolvedValue(new File(['image-bytes'], 'image.png', { type: 'image/png' }))

    const { rerender } = render(<PromptAttachmentPreview attachments={[createAttachment()]} />)

    expect(await screen.findByRole('img', { name: 'image.png' })).toHaveAttribute('src', 'blob:stale-preview')

    rerender(
      <PromptAttachmentPreview
        attachments={[
          createAttachment({ thumbnailDataUrl: 'data:image/webp;base64,fresh-thumbnail' }),
        ]}
      />
    )

    expect(screen.getByRole('img', { name: 'image.png' })).toHaveAttribute('src', 'data:image/webp;base64,fresh-thumbnail')
  })

  it('evicts old runtime thumbnails instead of growing cache without bound', async () => {
    vi.mocked(imageThumbnail.createImageThumbnailDataUrl).mockImplementation(async (file) => (
      `data:image/webp;base64,${file.name}`
    ))
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue({ name: 'root' } as any)
    vi.mocked(fs.hasReadWritePermission).mockResolvedValue(true)
    vi.mocked(fs.getFileFromAttachmentRoot).mockImplementation(async (_root, relativePath) => (
      new File(['image-bytes'], relativePath.split('/').at(-1) || 'image.png', { type: 'image/png' })
    ))

    const cacheLimit = 80
    const attachments = Array.from({ length: cacheLimit + 1 }, (_, index) => (
      createAttachment({
        id: `cache-${index}`,
        name: `cache-${index}.png`,
        relativePath: `attachments/prompt-1/cache-${index}.png`,
        createdAt: `2026-04-26T00:00:${String(index).padStart(2, '0')}.000Z`,
      })
    ))

    const { unmount } = render(<PromptAttachmentPreview attachments={attachments} />)

    await waitFor(() => expect(fs.getFileFromAttachmentRoot).toHaveBeenCalledTimes(cacheLimit + 1))
    unmount()
    vi.mocked(fs.getFileFromAttachmentRoot).mockClear()

    render(<PromptAttachmentPreview attachments={[attachments[0]]} />)

    await screen.findByRole('img', { name: 'cache-0.png' })
    expect(fs.getFileFromAttachmentRoot).toHaveBeenCalledWith(expect.anything(), attachments[0].relativePath)
  })

  it('opens a large image viewer and switches between image attachments', async () => {
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:first-preview')
      .mockReturnValueOnce('blob:second-preview')
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue({ name: 'root' } as any)
    vi.mocked(fs.hasReadWritePermission).mockResolvedValue(true)
    vi.mocked(fs.getFileFromAttachmentRoot).mockResolvedValue(new File(['image-bytes'], 'image.png', { type: 'image/png' }))

    render(
      <PromptAttachmentPreview
        attachments={[
          createAttachment({ id: 'attachment-1', name: 'first.png' }),
          createAttachment({ id: 'attachment-2', name: 'second.png', relativePath: 'attachments/prompt-1/attachment-2-second.png' }),
          createAttachment({ id: 'attachment-3', name: 'notes.pdf', type: 'application/pdf' }),
        ]}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: 'first.png' }))

    const dialog = await screen.findByRole('dialog', { name: 'imagePreviewDialog' })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'first.png' })).toHaveAttribute('src', 'blob:first-preview')
    const imageStage = within(dialog).getByRole('img', { name: 'first.png' }).parentElement

    fireEvent.click(screen.getByRole('button', { name: 'nextImage' }))
    expect(within(dialog).getByRole('img', { name: 'second.png' })).toHaveAttribute('src', 'blob:second-preview')
    expect(screen.getByRole('button', { name: 'nextImage' }).parentElement).toBe(dialog)

    fireEvent.click(screen.getByRole('button', { name: 'previousImage' }))
    expect(within(dialog).getByRole('img', { name: 'first.png' })).toHaveAttribute('src', 'blob:first-preview')
    expect(screen.getByRole('button', { name: 'previousImage' }).parentElement).toBe(dialog)

    const closeButton = screen.getByRole('button', { name: 'closeImagePreview' })
    expect(closeButton.parentElement).toBe(dialog)
    expect(closeButton).toHaveClass('fixed')
    expect(imageStage).not.toContainElement(closeButton)

    fireEvent.click(screen.getByRole('button', { name: 'closeImagePreview' }))
    expect(screen.queryByRole('dialog', { name: 'imagePreviewDialog' })).not.toBeInTheDocument()
  })

  it('renders nothing and does not read the attachment root when attachments are undefined', async () => {
    const { container } = render(<PromptAttachmentPreview />)

    expect(container).toBeEmptyDOMElement()
    await waitFor(() => expect(fs.getAttachmentRootHandle).not.toHaveBeenCalled())
  })

  it('revokes image preview object URLs on unmount', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue({ name: 'root' } as any)
    vi.mocked(fs.hasReadWritePermission).mockResolvedValue(true)
    vi.mocked(fs.getFileFromAttachmentRoot).mockResolvedValue(new File(['image-bytes'], 'image.png', { type: 'image/png' }))

    const { unmount } = render(<PromptAttachmentPreview attachments={[createAttachment()]} />)

    await screen.findByRole('img', { name: 'image.png' })
    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-url')
  })

  it('keeps image metadata visible when permission or file reads fail', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue(undefined)

    render(<PromptAttachmentPreview attachments={[createAttachment()]} />)

    expect(await screen.findByText('image.png')).toBeInTheDocument()
    expect(screen.getByText('1.5 KB')).toBeInTheDocument()
    expect(screen.getByText('attachmentPermissionLost')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'image.png' })).not.toBeInTheDocument()
  })

  it('renders non-image attachment metadata without reading the file', async () => {
    render(
      <PromptAttachmentPreview
        attachments={[createAttachment({ name: 'notes.pdf', type: 'application/pdf', size: 2048 })]}
      />
    )

    expect(screen.getByText('notes.pdf')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()
    await waitFor(() => expect(fs.getAttachmentRootHandle).not.toHaveBeenCalled())
  })
})
