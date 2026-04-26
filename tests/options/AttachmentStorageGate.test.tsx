import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentRootHandle: vi.fn(),
  pickAndStoreAttachmentRoot: vi.fn(),
  verifyReadWritePermission: vi.fn(),
}))

const fs = await import('@/utils/attachments/fileSystem')
const { default: AttachmentStorageGate } = await import('@/entrypoints/options/components/AttachmentStorageGate')

describe('AttachmentStorageGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: vi.fn(),
      configurable: true,
    })
  })

  it('renders children when an existing handle has readwrite permission', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue({ name: 'Quick Prompt' } as any)
    vi.mocked(fs.verifyReadWritePermission).mockResolvedValue(true)

    render(<AttachmentStorageGate><div>Options Ready</div></AttachmentStorageGate>)

    expect(await screen.findByText('Options Ready')).toBeInTheDocument()
  })

  it('blocks options until the user chooses a directory', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue(undefined)
    vi.mocked(fs.pickAndStoreAttachmentRoot).mockResolvedValue({ name: 'Quick Prompt' } as any)

    render(<AttachmentStorageGate><div>Options Ready</div></AttachmentStorageGate>)

    expect(await screen.findByText('attachmentStorageTitle')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'chooseAttachmentDirectory' }))

    await waitFor(() => expect(screen.getByText('Options Ready')).toBeInTheDocument())
  })

  it('disables directory selection when the File System Access API is unavailable', async () => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: undefined,
      configurable: true,
    })

    render(<AttachmentStorageGate><div>Options Ready</div></AttachmentStorageGate>)

    expect(await screen.findByText('attachmentStorageUnsupported')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'chooseAttachmentDirectory' })).toBeDisabled()
  })

  it('shows a permission error when directory selection fails', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue(undefined)
    vi.mocked(fs.pickAndStoreAttachmentRoot).mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))

    render(<AttachmentStorageGate><div>Options Ready</div></AttachmentStorageGate>)

    await screen.findByText('attachmentStorageTitle')
    fireEvent.click(screen.getByRole('button', { name: 'chooseAttachmentDirectory' }))

    expect(await screen.findByText('attachmentStoragePermissionRequired')).toBeInTheDocument()
    expect(screen.queryByText('Options Ready')).not.toBeInTheDocument()
  })
})
