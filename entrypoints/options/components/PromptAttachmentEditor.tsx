import { useRef, useState } from 'react'
import type { PromptAttachment } from '@/utils/types'
import {
  getAttachmentRootHandle,
  removeAttachmentFileFromRoot,
  verifyReadWritePermission,
} from '@/utils/attachments/fileSystem'
import { formatFileSize } from '@/utils/attachments/metadata'
import { createAttachmentFromFile } from '@/utils/attachments/promptAttachmentOperations'
import type { t as repoTranslate } from '@/utils/i18n'

interface PromptAttachmentEditorProps {
  promptId: string
  attachments: PromptAttachment[]
  onChange: (attachments: PromptAttachment[]) => void
  translate?: typeof repoTranslate
}

const defaultTranslate: typeof repoTranslate = (key) => key

const getAuthorizedRoot = async (translate: typeof repoTranslate): Promise<FileSystemDirectoryHandle> => {
  const root = await getAttachmentRootHandle()

  if (!root || !(await verifyReadWritePermission(root))) {
    throw new Error(translate('attachmentPermissionLost'))
  }

  return root
}

const getAttachmentType = (attachment: PromptAttachment): string => {
  return attachment.type || 'application/octet-stream'
}

const isMissingAttachmentFileError = (err: unknown): boolean => {
  if (err instanceof DOMException && err.name === 'NotFoundError') {
    return true
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase()
    return err.name === 'NotFoundError'
      || message.includes('notfound')
      || message.includes('not found')
      || message.includes('missing')
      || message.includes('no such file')
  }

  return false
}

const PromptAttachmentEditor = ({
  promptId,
  attachments,
  onChange,
  translate = defaultTranslate,
}: PromptAttachmentEditorProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    setBusy(true)
    setError(null)

    try {
      const root = await getAuthorizedRoot(translate)
      const created: PromptAttachment[] = []

      for (const file of files) {
        created.push(await createAttachmentFromFile(root, promptId, file))
      }

      onChange([...attachments, ...created])
    } catch (err) {
      console.error(translate('attachmentAddFailed'), err)
      setError(err instanceof Error ? err.message : translate('attachmentAddFailed'))
    } finally {
      setBusy(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleRemove = async (attachment: PromptAttachment) => {
    setBusy(true)
    setError(null)

    try {
      const root = await getAuthorizedRoot(translate)
      await removeAttachmentFileFromRoot(root, attachment.relativePath)
      onChange(attachments.filter((item) => item.id !== attachment.id))
    } catch (err) {
      if (isMissingAttachmentFileError(err)) {
        onChange(attachments.filter((item) => item.id !== attachment.id))
        return
      }

      console.error(translate('attachmentRemoveFailed'), err)
      setError(err instanceof Error ? err.message : translate('attachmentRemoveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className='flex items-center justify-between mb-1'>
        <label className='block text-sm font-medium text-gray-700'>
          {translate('attachmentsLabel')} <span className='text-gray-400 font-normal'>({translate('attachmentsOptional')})</span>
        </label>
        <label className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
          busy
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer'
        }`}>
          {translate('addAttachment')}
          <input
            ref={inputRef}
            type='file'
            multiple
            disabled={busy}
            aria-label={translate('addAttachment')}
            onChange={handleFilesSelected}
            className='hidden'
          />
        </label>
      </div>

      {error && (
        <p className='mt-1 text-sm text-red-600'>{error}</p>
      )}

      {attachments.length > 0 && (
        <ul className='mt-2 space-y-2'>
          {attachments.map((attachment) => (
            <li key={attachment.id} className='flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2'>
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium text-gray-800'>{attachment.name}</p>
                <p className='text-xs text-gray-500'>
                  {getAttachmentType(attachment)} · {formatFileSize(attachment.size)}
                </p>
              </div>
              <button
                type='button'
                disabled={busy}
                aria-label={translate('removeAttachment')}
                onClick={() => handleRemove(attachment)}
                className='flex-shrink-0 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
              >
                {translate('removeAttachment')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default PromptAttachmentEditor
