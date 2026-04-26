import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { PromptAttachment } from '@/utils/types'

const sendMessage = vi.fn()

vi.mock('#imports', () => ({
  browser: {
    runtime: {
      sendMessage,
    },
  },
}))

vi.mock('@/utils/i18n', () => ({ t: (key: string) => `localized:${key}` }))

const { default: PromptAttachmentPreview } = await import('@/entrypoints/content/components/PromptAttachmentPreview')

const createAttachment = (overrides: Partial<PromptAttachment> = {}): PromptAttachment => ({
  id: 'attachment-1',
  name: 'image.png',
  type: 'image/png',
  size: 1536,
  relativePath: 'attachments/prompt-1/attachment-1-image.png',
  createdAt: '2026-04-26T00:00:00.000Z',
  ...overrides,
})

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []

  private callback: IntersectionObserverCallback
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  trigger(isIntersecting = true) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

describe('content PromptAttachmentPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    MockIntersectionObserver.instances = []
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:content-preview-url'),
      revokeObjectURL: vi.fn(),
    })
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing and does not request previews when attachments are undefined', async () => {
    const { container } = render(<PromptAttachmentPreview />)

    expect(container).toBeEmptyDOMElement()
    await waitFor(() => expect(sendMessage).not.toHaveBeenCalled())
  })

  it('keeps metadata visible and lazy-loads image previews when intersecting', async () => {
    sendMessage.mockResolvedValue({
      success: true,
      base64: btoa('image-bytes'),
      contentType: 'image/png',
    })

    render(<PromptAttachmentPreview attachments={[createAttachment()]} />)

    expect(screen.getByText('image.png')).toBeInTheDocument()
    expect(screen.getByText('1.5 KB')).toBeInTheDocument()
    expect(sendMessage).not.toHaveBeenCalled()

    act(() => {
      MockIntersectionObserver.instances[0].trigger()
    })

    const image = await screen.findByRole('img', { name: 'image.png' })
    expect(image).toHaveAttribute('src', 'blob:content-preview-url')
    expect(image).toHaveClass('qp-attachment-image')
    expect(sendMessage).toHaveBeenCalledWith({
      action: 'getAttachmentPreview',
      attachment: createAttachment(),
    })
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  })

  it('opens a large image viewer and switches content preview images', async () => {
    vi.mocked(URL.createObjectURL)
      .mockReturnValueOnce('blob:first-content-preview')
      .mockReturnValueOnce('blob:second-content-preview')
    sendMessage.mockResolvedValue({
      success: true,
      base64: btoa('image-bytes'),
      contentType: 'image/png',
    })

    render(
      <PromptAttachmentPreview
        attachments={[
          createAttachment({ id: 'attachment-1', name: 'first.png' }),
          createAttachment({ id: 'attachment-2', name: 'second.png', relativePath: 'attachments/prompt-1/attachment-2-second.png' }),
        ]}
      />
    )

    act(() => {
      MockIntersectionObserver.instances[0].trigger()
    })

    fireEvent.click(await screen.findByRole('button', { name: 'first.png' }))

    const dialog = screen.getByRole('dialog', { name: 'localized:imagePreviewDialog' })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('img', { name: 'first.png' })).toHaveAttribute('src', 'blob:first-content-preview')

    fireEvent.click(screen.getByRole('button', { name: 'localized:nextImage' }))
    expect(within(dialog).getByRole('img', { name: 'second.png' })).toHaveAttribute('src', 'blob:second-content-preview')
    expect(screen.getByRole('button', { name: 'localized:closeImagePreview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'localized:previousImage' })).toBeInTheDocument()
  })

  it('loads immediately when IntersectionObserver is unavailable and revokes object URLs on unmount', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    sendMessage.mockResolvedValue({
      success: true,
      base64: btoa('image-bytes'),
      contentType: 'image/png',
    })

    const { unmount } = render(<PromptAttachmentPreview attachments={[createAttachment()]} />)

    await screen.findByRole('img', { name: 'image.png' })
    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:content-preview-url')
  })
})
