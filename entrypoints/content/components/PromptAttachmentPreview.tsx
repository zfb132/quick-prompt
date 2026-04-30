import React, { useEffect, useMemo, useRef, useState } from 'react'
import { browser } from '#imports'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { PromptAttachment } from '@/utils/types'
import { formatFileSize, isImageAttachment } from '@/utils/attachments/metadata'
import { t } from '@/utils/i18n'

interface PromptAttachmentPreviewProps {
  attachments?: PromptAttachment[]
}

interface ImagePreviewState {
  thumbnailUrl?: string
  fullUrl?: string
  objectUrl?: string
  isLoadingFull?: boolean
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
  const objectUrlsRef = useRef<Set<string>>(new Set())
  const [imagePreviews, setImagePreviews] = useState<Record<string, ImagePreviewState>>({})
  const [isPreviewVisible, setIsPreviewVisible] = useState(false)
  const [activeImageId, setActiveImageId] = useState<string | null>(null)

  const getPreview = (attachment: PromptAttachment): ImagePreviewState | undefined => {
    const loadedPreview = imagePreviews[attachment.id]

    if (attachment.thumbnailDataUrl) {
      return {
        ...loadedPreview,
        thumbnailUrl: attachment.thumbnailDataUrl,
      }
    }

    return loadedPreview
  }

  const viewableImages = useMemo(() => (
    safeAttachments
      .filter(isImageAttachment)
      .map((attachment) => {
        const preview = getPreview(attachment)
        return {
          attachment,
          url: preview?.fullUrl || preview?.thumbnailUrl,
        }
      })
      .filter((item): item is { attachment: PromptAttachment; url: string } => Boolean(item.url))
  ), [safeAttachments, imagePreviews])

  const activeImageIndex = activeImageId
    ? viewableImages.findIndex((item) => item.attachment.id === activeImageId)
    : -1
  const activeImage = activeImageIndex >= 0 ? viewableImages[activeImageIndex] : null

  const loadFullPreview = async (attachment: PromptAttachment) => {
    const currentPreview = getPreview(attachment)
    if (currentPreview?.fullUrl || currentPreview?.isLoadingFull) return

    setImagePreviews((current) => ({
      ...current,
      [attachment.id]: {
        ...current[attachment.id],
        thumbnailUrl: attachment.thumbnailDataUrl || current[attachment.id]?.thumbnailUrl,
        isLoadingFull: true,
      },
    }))

    try {
      const response = await browser.runtime.sendMessage({
        action: 'getAttachmentPreview',
        attachment,
      })

      if (!response?.success || !response.base64) {
        setImagePreviews((current) => ({
          ...current,
          [attachment.id]: {
            ...current[attachment.id],
            thumbnailUrl: attachment.thumbnailDataUrl || current[attachment.id]?.thumbnailUrl,
            isLoadingFull: false,
          },
        }))
        return
      }

      const blob = base64ToBlob(response.base64, response.contentType || attachment.type)
      const fullUrl = URL.createObjectURL(blob)
      objectUrlsRef.current.add(fullUrl)

      setImagePreviews((current) => ({
        ...current,
        [attachment.id]: {
          ...current[attachment.id],
          thumbnailUrl: attachment.thumbnailDataUrl || current[attachment.id]?.thumbnailUrl,
          fullUrl,
          isLoadingFull: false,
        },
      }))
    } catch {
      setImagePreviews((current) => ({
        ...current,
        [attachment.id]: {
          ...current[attachment.id],
          thumbnailUrl: attachment.thumbnailDataUrl || current[attachment.id]?.thumbnailUrl,
          isLoadingFull: false,
        },
      }))
    }
  }

  const openImageViewer = (attachment: PromptAttachment) => {
    setActiveImageId(attachment.id)
    void loadFullPreview(attachment)
  }

  const showPreviousImage = () => {
    if (viewableImages.length === 0 || activeImageIndex < 0) return
    const previousIndex = (activeImageIndex - 1 + viewableImages.length) % viewableImages.length
    const previousAttachment = viewableImages[previousIndex].attachment
    setActiveImageId(previousAttachment.id)
    void loadFullPreview(previousAttachment)
  }

  const showNextImage = () => {
    if (viewableImages.length === 0 || activeImageIndex < 0) return
    const nextIndex = (activeImageIndex + 1) % viewableImages.length
    const nextAttachment = viewableImages[nextIndex].attachment
    setActiveImageId(nextAttachment.id)
    void loadFullPreview(nextAttachment)
  }

  useEffect(() => {
    const imageAttachments = safeAttachments.filter((attachment) => (
      isImageAttachment(attachment) && !attachment.thumbnailDataUrl
    ))

    if (imageAttachments.length === 0) {
      setIsPreviewVisible(false)
      setImagePreviews((current) => {
        const nextEntries = Object.entries(current).filter(([id, preview]) => (
          safeAttachments.some((attachment) => attachment.id === id) && (preview.fullUrl || preview.isLoadingFull)
        ))
        return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries)
      })
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
    const imageAttachments = safeAttachments.filter((attachment) => (
      isImageAttachment(attachment) && !attachment.thumbnailDataUrl
    ))
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
          nextPreviews[attachment.id] = { thumbnailUrl: url, fullUrl: url, objectUrl: url }
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

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrlsRef.current.clear()
    }
  }, [])

  if (safeAttachments.length === 0) {
    return null
  }

  return (
    <div ref={containerRef} className="qp-attachments">
      {safeAttachments.map((attachment) => {
        const isImage = isImageAttachment(attachment)
        const thumbnailUrl = getPreview(attachment)?.thumbnailUrl

        if (isImage) {
          if (!thumbnailUrl) {
            return null
          }

          return (
            <div key={attachment.id} className="qp-attachment qp-attachment-image-only">
              <button
                type="button"
                className="qp-attachment-image-button"
                aria-label={attachment.name}
                onClick={() => openImageViewer(attachment)}
              >
                <img
                  src={thumbnailUrl}
                  alt={attachment.name}
                  className="qp-attachment-image"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </div>
          )
        }

        return (
          <div key={attachment.id} className="qp-attachment">
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
              <X aria-hidden="true" />
            </button>
            {viewableImages.length > 1 && (
              <>
                <button
                  type="button"
                  className="qp-image-viewer-nav qp-image-viewer-prev"
                  aria-label={t('previousImage')}
                  onClick={showPreviousImage}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="qp-image-viewer-nav qp-image-viewer-next"
                  aria-label={t('nextImage')}
                  onClick={showNextImage}
                >
                  <ChevronRight aria-hidden="true" />
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
