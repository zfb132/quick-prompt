import React, { useEffect, useState } from 'react'
import type { PromptAttachment } from '@/utils/types'
import { formatFileSize, isImageAttachment } from '@/utils/attachments/metadata'
import {
  getAttachmentRootHandle,
  getFileFromAttachmentRoot,
  verifyReadWritePermission,
} from '@/utils/attachments/fileSystem'
import { t } from '@/utils/i18n'

interface PromptAttachmentPreviewProps {
  attachments?: PromptAttachment[]
  compact?: boolean
}

interface ImagePreviewState {
  url?: string
  error?: string
}

const EMPTY_ATTACHMENTS: PromptAttachment[] = []

const PromptAttachmentPreview: React.FC<PromptAttachmentPreviewProps> = ({
  attachments,
  compact = false,
}) => {
  const safeAttachments = attachments ?? EMPTY_ATTACHMENTS
  const [imagePreviews, setImagePreviews] = useState<Record<string, ImagePreviewState>>({})

  useEffect(() => {
    const imageAttachments = safeAttachments.filter(isImageAttachment)
    const objectUrls: string[] = []
    let canceled = false

    if (imageAttachments.length === 0) {
      setImagePreviews((current) => Object.keys(current).length > 0 ? {} : current)
      return
    }

    const loadPreviews = async () => {
      const nextPreviews: Record<string, ImagePreviewState> = {}

      try {
        const root = await getAttachmentRootHandle()
        if (!root || !(await verifyReadWritePermission(root))) {
          throw new Error(t('attachmentPermissionLost'))
        }

        await Promise.all(imageAttachments.map(async (attachment) => {
          try {
            const file = await getFileFromAttachmentRoot(root, attachment.relativePath)
            const url = URL.createObjectURL(file)
            objectUrls.push(url)
            nextPreviews[attachment.id] = { url }
          } catch {
            nextPreviews[attachment.id] = { error: t('attachmentPermissionLost') }
          }
        }))
      } catch {
        imageAttachments.forEach((attachment) => {
          nextPreviews[attachment.id] = { error: t('attachmentPermissionLost') }
        })
      }

      if (!canceled) {
        setImagePreviews(nextPreviews)
      } else {
        objectUrls.forEach((url) => URL.revokeObjectURL(url))
      }
    }

    loadPreviews()

    return () => {
      canceled = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [safeAttachments])

  if (safeAttachments.length === 0) {
    return null
  }

  return (
    <div className={compact ? 'flex items-center gap-1.5 min-w-0' : 'mt-3 flex flex-wrap gap-2'}>
      {safeAttachments.map((attachment) => {
        const preview = imagePreviews[attachment.id]
        const hasImagePreview = isImageAttachment(attachment) && preview?.url

        return (
          <div
            key={attachment.id}
            className={
              compact
                ? 'flex items-center gap-1.5 min-w-0 max-w-[140px] rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-1.5 py-1'
                : 'flex items-center gap-2 min-w-0 max-w-full rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-2 py-1.5'
            }
          >
            {hasImagePreview && (
              <img
                src={preview.url}
                alt={attachment.name}
                className={compact ? 'w-7 h-7 object-cover rounded border border-gray-200 dark:border-gray-600 flex-shrink-0' : 'w-10 h-10 object-cover rounded border border-gray-200 dark:border-gray-600 flex-shrink-0'}
              />
            )}
            <div className='min-w-0'>
              <div className='text-xs font-medium text-gray-700 dark:text-gray-200 truncate'>
                {attachment.name}
              </div>
              <div className='text-[11px] text-gray-500 dark:text-gray-400 truncate'>
                {formatFileSize(attachment.size)}
              </div>
              {isImageAttachment(attachment) && preview?.error && (
                <div className='text-[11px] text-amber-600 dark:text-amber-400 truncate'>
                  {preview.error}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default PromptAttachmentPreview
