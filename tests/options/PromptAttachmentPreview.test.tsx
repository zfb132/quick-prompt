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

const fs = await import('@/utils/attachments/fileSystem')

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
    expect(image).toHaveAttribute('src', 'blob:preview-url')
    expect(image).toHaveClass('w-20', 'h-20')
    expect(image.closest('div')).toHaveClass('flex-col')
    expect(screen.getByText('image.png')).toBeInTheDocument()
    expect(screen.getByText('1.5 KB')).toBeInTheDocument()
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(File))
    expect(fs.verifyReadWritePermission).not.toHaveBeenCalled()
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

    fireEvent.click(screen.getByRole('button', { name: 'nextImage' }))
    expect(within(dialog).getByRole('img', { name: 'second.png' })).toHaveAttribute('src', 'blob:second-preview')

    fireEvent.click(screen.getByRole('button', { name: 'previousImage' }))
    expect(within(dialog).getByRole('img', { name: 'first.png' })).toHaveAttribute('src', 'blob:first-preview')

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
