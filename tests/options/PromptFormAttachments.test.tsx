import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  getAttachmentRootHandle: vi.fn().mockResolvedValue({ name: 'root' }),
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
})
