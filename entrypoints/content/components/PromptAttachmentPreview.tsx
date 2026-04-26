import React, { useEffect, useMemo, useRef, useState } from 'react'
import { browser } from '#imports'
import type { PromptAttachment } from '@/utils/types'
import { formatFileSize, isImageAttachment } from '@/utils/attachments/metadata'
import { t } from '@/utils/i18n'

interface PromptAttachmentPreviewProps {
  attachments?: PromptAttachment[]
}

interface ImagePreviewState {
  url?: string
}

const EMPTY_ATTACHMENTS: PromptAttachment[] = []

const base64ToBlob = (base64: string, contentType: string): Blob => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: contentType })
}

const PromptAttachmentPreview: React.FC<PromptAttachmentPreviewProps> = ({ attachments }) => {
  const safeAttachments = attachments ?? EMPTY_ATTACHMENTS
  const containerRef = useRef<HTMLDivElement>(null)
  const [imagePreviews, setImagePreviews] = useState<Record<string, ImagePreviewState>>({})
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
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

    if (imageAttachments.length === 0) {
      setIsPreviewVisible(false)
      setImagePreviews((current) => Object.keys(current).length > 0 ? {} : current)
      return
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsPreviewVisible(true)
      return
    }

    const target = containerRef.current
    if (!target) return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsPreviewVisible(true)
        observer.disconnect()
      }
    }, {
      rootMargin: '200px',
    })

    observer.observe(target)

    return () => observer.disconnect()
  }, [safeAttachments])

  useEffect(() => {
    const imageAttachments = safeAttachments.filter(isImageAttachment)
    const objectUrls: string[] = []
    let canceled = false

    if (imageAttachments.length === 0) {
      setImagePreviews((current) => Object.keys(current).length > 0 ? {} : current)
      return
    }

    if (!isPreviewVisible) {
      return
    }

    const loadPreviews = async () => {
      const nextPreviews: Record<string, ImagePreviewState> = {}

      await Promise.all(imageAttachments.map(async (attachment) => {
        try {
          const response = await browser.runtime.sendMessage({
            action: 'getAttachmentPreview',
            attachment,
          })

          if (!response?.success || !response.base64) return

          const blob = base64ToBlob(response.base64, response.contentType || attachment.type)
          const url = URL.createObjectURL(blob)
          objectUrls.push(url)
          nextPreviews[attachment.id] = { url }
        } catch {
          // Metadata remains visible below when image preview loading fails.
        }
      }))

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
  }, [safeAttachments, isPreviewVisible])

  if (safeAttachments.length === 0) {
    return null
  }

  return (
    <div ref={containerRef} className="qp-attachments">
      {safeAttachments.map((attachment) => {
        const preview = imagePreviews[attachment.id]

        return (
          <div key={attachment.id} className="qp-attachment">
            {isImageAttachment(attachment) && preview?.url && (
              <button
                type="button"
                className="qp-attachment-image-button"
                aria-label={attachment.name}
                onClick={() => setActiveImageId(attachment.id)}
              >
                <img src={preview.url} alt={attachment.name} className="qp-attachment-image" />
              </button>
            )}
            <div className="qp-attachment-meta">
              <span className="qp-attachment-name">{attachment.name}</span>
              <span className="qp-attachment-size">{formatFileSize(attachment.size)}</span>
            </div>
          </div>
        )
      })}
      {activeImage && (
        <div
          className="qp-image-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={t('imagePreviewDialog')}
          onClick={() => setActiveImageId(null)}
        >
          <div className="qp-image-viewer-inner" onClick={(event) => event.stopPropagation()}>
            <img
              src={activeImage.url}
              alt={activeImage.attachment.name}
              className="qp-image-viewer-image"
            />
            <button
              type="button"
              className="qp-image-viewer-close"
              aria-label={t('closeImagePreview')}
              onClick={() => setActiveImageId(null)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {viewableImages.length > 1 && (
              <>
                <button
                  type="button"
                  className="qp-image-viewer-nav qp-image-viewer-prev"
                  aria-label={t('previousImage')}
                  onClick={showPreviousImage}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="qp-image-viewer-nav qp-image-viewer-next"
                  aria-label={t('nextImage')}
                  onClick={showNextImage}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
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
