import React, { useEffect, useMemo, useState } from 'react'
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
  const [activeImageId, setActiveImageId] = useState<string | null>(null)

  const viewableImages = useMemo(() => (
    safeAttachments
      .filter(isImageAttachment)
      .map((attachment) => ({
        attachment,
        url: imagePreviews[attachment.id]?.url,
      }))
      .filter((item): item is { attachment: PromptAttachment; url: string } => Boolean(item.url))
  ), [safeAttachments, imagePreviews])

  const activeImageIndex = activeImageId
    ? viewableImages.findIndex((item) => item.attachment.id === activeImageId)
    : -1
  const activeImage = activeImageIndex >= 0 ? viewableImages[activeImageIndex] : null

  const showPreviousImage = () => {
    if (viewableImages.length === 0 || activeImageIndex < 0) return
    const previousIndex = (activeImageIndex - 1 + viewableImages.length) % viewableImages.length
    setActiveImageId(viewableImages[previousIndex].attachment.id)
  }

  const showNextImage = () => {
    if (viewableImages.length === 0 || activeImageIndex < 0) return
    const nextIndex = (activeImageIndex + 1) % viewableImages.length
    setActiveImageId(viewableImages[nextIndex].attachment.id)
  }

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
              <button
                type="button"
                onClick={() => setActiveImageId(attachment.id)}
                className="flex-shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-700"
                aria-label={attachment.name}
              >
                <img
                  src={preview.url}
                  alt={attachment.name}
                  className={compact ? 'w-12 h-12 object-cover rounded border border-gray-200 dark:border-gray-600' : 'w-20 h-20 object-cover rounded border border-gray-200 dark:border-gray-600'}
                />
              </button>
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
      {activeImage && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('imagePreviewDialog')}
          onClick={() => setActiveImageId(null)}
        >
          <div className="relative flex max-h-full max-w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <img
              src={activeImage.url}
              alt={activeImage.attachment.name}
              className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setActiveImageId(null)}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={t('closeImagePreview')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {viewableImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPreviousImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label={t('previousImage')}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={showNextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label={t('nextImage')}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PromptAttachmentPreview
