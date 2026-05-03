import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PromptAttachment } from '@/utils/types'

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentStorageMode: vi.fn().mockResolvedValue('external'),
  getAttachmentRootHandle: vi.fn().mockResolvedValue({ name: 'root' }),
  pickAndStoreAttachmentRoot: vi.fn().mockResolvedValue({ name: 'root' }),
  useInternalAttachmentStorage: vi.fn().mockResolvedValue({ name: 'internal-root' }),
  verifyReadWritePermission: vi.fn().mockResolvedValue(true),
  removeAttachmentDirectoryFromRoot: vi.fn(),
  removeAttachmentFileFromRoot: vi.fn(),
}))

vi.mock('@/utils/attachments/promptAttachmentOperations', () => ({
  createAttachmentFromFile: vi.fn().mockResolvedValue({
    id: 'att-1',
    name: 'hello.txt',
    type: 'text/plain',
    size: 5,
    relativePath: 'attachments/prompt-1/att-1-hello.txt',
    createdAt: '2024-01-01T00:00:00.000Z',
  }),
  isMissingAttachmentFileError: (err: unknown) => {
    const error = err as { name?: string; message?: string }
    const message = error.message?.toLowerCase() || ''
    return error.name === 'NotFoundError' || message.includes('missing')
  },
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

const fileSystem = await import('@/utils/attachments/fileSystem')
const { default: PromptAttachmentEditor } = await import('@/entrypoints/options/components/PromptAttachmentEditor')

const createAttachment = (overrides: Partial<PromptAttachment> = {}): PromptAttachment => ({
  id: 'att-existing',
  name: 'existing.pdf',
  type: 'application/pdf',
  size: 2048,
  relativePath: 'attachments/prompt-1/att-existing-existing.pdf',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

describe('PromptAttachmentEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fileSystem.getAttachmentStorageMode).mockResolvedValue('external')
    vi.mocked(fileSystem.getAttachmentRootHandle).mockResolvedValue({ name: 'root' } as any)
    vi.mocked(fileSystem.pickAndStoreAttachmentRoot).mockResolvedValue({ name: 'root' } as any)
    vi.mocked(fileSystem.useInternalAttachmentStorage).mockResolvedValue({ name: 'internal-root' } as any)
    vi.mocked(fileSystem.verifyReadWritePermission).mockResolvedValue(true)
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: vi.fn(),
      configurable: true,
    })
  })

  it('adds selected files and reports the updated attachment list', async () => {
    const onChange = vi.fn()
    render(<PromptAttachmentEditor promptId="prompt-1" attachments={[]} onChange={onChange} />)

    const input = screen.getByLabelText('addAttachment')
    fireEvent.change(input, {
      target: { files: [new File(['hello'], 'hello.txt', { type: 'text/plain' })] },
    })

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'hello.txt' })])
    })
  })

  it('prompts for an attachment storage choice when upload is clicked without a configured root', async () => {
    vi.mocked(fileSystem.getAttachmentStorageMode).mockResolvedValue(undefined)
    vi.mocked(fileSystem.getAttachmentRootHandle).mockResolvedValue(undefined)
    const onChange = vi.fn()

    render(<PromptAttachmentEditor promptId="prompt-1" attachments={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'addAttachment' }))

    expect(await screen.findByRole('dialog', { name: 'attachmentStorageTitle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /useExternalAttachmentStorage/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /useBuiltInAttachmentStorage/ })).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('opens the file picker after choosing built-in storage from the upload prompt', async () => {
    vi.mocked(fileSystem.getAttachmentStorageMode).mockResolvedValue(undefined)
    vi.mocked(fileSystem.getAttachmentRootHandle).mockResolvedValue(undefined)
    const inputClick = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    render(<PromptAttachmentEditor promptId="prompt-1" attachments={[]} onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'addAttachment' }))
    fireEvent.click(await screen.findByRole('button', { name: /useBuiltInAttachmentStorage/ }))

    await waitFor(() => {
      expect(fileSystem.useInternalAttachmentStorage).toHaveBeenCalled()
      expect(inputClick).toHaveBeenCalled()
    })
    expect(screen.queryByRole('dialog', { name: 'attachmentStorageTitle' })).not.toBeInTheDocument()

    inputClick.mockRestore()
  })

  it('shows image attachment thumbnails in the editor list', () => {
    render(
      <PromptAttachmentEditor
        promptId="prompt-1"
        attachments={[
          createAttachment({
            name: 'photo.png',
            type: 'image/png',
            thumbnailDataUrl: 'data:image/webp;base64,thumbnail',
          }),
        ]}
        onChange={vi.fn()}
      />
    )

    const image = screen.getByRole('img', { name: 'photo.png' })
    expect(image).toHaveAttribute('src', 'data:image/webp;base64,thumbnail')
    expect(image).toHaveClass('object-cover')
  })

  it('removes an attachment and reports the updated list', async () => {
    const onChange = vi.fn()
    render(<PromptAttachmentEditor promptId="prompt-1" attachments={[createAttachment()]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'removeAttachment' }))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([])
    })
    expect(fileSystem.removeAttachmentDirectoryFromRoot).toHaveBeenCalledWith(
      { name: 'root' },
      'attachments/prompt-1'
    )
  })

  it('keeps the prompt attachment directory when other attachments remain', async () => {
    const onChange = vi.fn()
    render(
      <PromptAttachmentEditor
        promptId="prompt-1"
        attachments={[
          createAttachment(),
          createAttachment({
            id: 'att-second',
            name: 'second.pdf',
            relativePath: 'attachments/prompt-1/att-second-second.pdf',
          }),
        ]}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'removeAttachment' })[0])

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'att-second' }),
      ])
    })
    expect(fileSystem.removeAttachmentDirectoryFromRoot).not.toHaveBeenCalled()
  })

  it('removes attachment metadata when the file is already missing', async () => {
    vi.mocked(fileSystem.removeAttachmentFileFromRoot).mockRejectedValue(new DOMException('Missing', 'NotFoundError'))
    const onChange = vi.fn()

    render(<PromptAttachmentEditor promptId="prompt-1" attachments={[createAttachment()]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'removeAttachment' }))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([])
    })
    expect(screen.queryByText('attachmentRemoveFailed')).not.toBeInTheDocument()
  })
})
