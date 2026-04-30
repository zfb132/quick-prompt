import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@/utils/categoryUtils', () => ({
  getCategories: vi.fn().mockResolvedValue([
    {
      id: 'default',
      name: 'Default',
      enabled: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ]),
}))

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
  createAttachmentFromFile: vi.fn(),
  isMissingAttachmentFileError: vi.fn(),
}))

vi.mock('@/utils/i18n', () => ({ t: (key: string) => key }))
vi.mock('../../../utils/i18n', () => ({ t: (key: string) => key }))

const operations = await import('@/utils/attachments/promptAttachmentOperations')
const { default: PromptForm } = await import('@/entrypoints/options/components/PromptForm')

describe('PromptForm attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(operations.createAttachmentFromFile).mockImplementation(async (_root, promptId, file) => ({
      id: 'att-1',
      name: file.name,
      type: file.type,
      size: file.size,
      relativePath: `attachments/${promptId}/att-1-${file.name}`,
      createdAt: '2024-01-01T00:00:00.000Z',
    }))
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses an internally generated prompt id when adding attachments to a new prompt', async () => {
    const generatedPromptId = '00000000-0000-4000-8000-000000000000'
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(generatedPromptId)
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <PromptForm
        onSubmit={onSubmit}
        initialData={null}
        onCancel={vi.fn()}
        isEditing={false}
      />
    )

    await screen.findByLabelText('titleLabel')
    fireEvent.change(screen.getByLabelText('addAttachment'), {
      target: { files: [new File(['hello'], 'hello.txt', { type: 'text/plain' })] },
    })

    await waitFor(() => {
      expect(operations.createAttachmentFromFile).toHaveBeenCalledWith(
        { name: 'root' },
        generatedPromptId,
        expect.any(File)
      )
    })

    fireEvent.change(screen.getByLabelText('titleLabel'), {
      target: { value: 'New prompt' },
    })
    fireEvent.change(screen.getByLabelText('contentLabel'), {
      target: { value: 'Prompt content' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'savePromptButton' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        id: generatedPromptId,
        attachments: [
          expect.objectContaining({
            relativePath: `attachments/${generatedPromptId}/att-1-hello.txt`,
          }),
        ],
      }))
    })
  })

  it('uses prompt source URL translation keys for the URL field', async () => {
    render(
      <PromptForm
        onSubmit={vi.fn()}
        initialData={null}
        onCancel={vi.fn()}
        isEditing={false}
      />
    )

    await screen.findByLabelText('titleLabel')

    expect(screen.getByText('promptSourceUrlLabel')).toBeInTheDocument()
    expect(screen.getByText(/promptSourceUrlOptional/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('promptSourceUrlPlaceholder')).toBeInTheDocument()
    expect(screen.queryByText('thumbnailUrlLabel')).not.toBeInTheDocument()
  })

  it('fetches promptSourceUrl preview on blur and submits the base64 preview data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    vi.mocked(fetch).mockResolvedValue(new Response('preview', {
      headers: { 'content-type': 'image/png' },
    }))

    render(
      <PromptForm
        onSubmit={onSubmit}
        initialData={null}
        onCancel={vi.fn()}
        isEditing={false}
      />
    )

    await screen.findByLabelText('titleLabel')

    fireEvent.change(screen.getByLabelText('titleLabel'), {
      target: { value: 'Prompt with source' },
    })
    fireEvent.change(screen.getByLabelText('contentLabel'), {
      target: { value: 'Prompt content' },
    })
    fireEvent.change(screen.getByLabelText(/promptSourceUrlLabel/), {
      target: { value: 'https://example.cn/prompt-source' },
    })

    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('img', { name: 'promptSourceUrlPreviewAlt' })).not.toBeInTheDocument()

    fireEvent.blur(screen.getByLabelText(/promptSourceUrlLabel/))

    const preview = await screen.findByRole('img', { name: 'promptSourceUrlPreviewAlt' })
    expect(preview).toHaveAttribute('src', 'data:image/png;base64,cHJldmlldw==')
    expect(fetch).toHaveBeenCalledWith('https://example.cn/prompt-source')

    fireEvent.click(screen.getByRole('button', { name: 'savePromptButton' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        promptSourceUrl: 'https://example.cn/prompt-source',
        promptSourcePreviewDataUrl: 'data:image/png;base64,cHJldmlldw==',
      }))
    })
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('thumbnailUrl')
  })
})
