import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PromptAttachment } from '@/utils/types'

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentRootHandle: vi.fn().mockResolvedValue({ name: 'root' }),
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
