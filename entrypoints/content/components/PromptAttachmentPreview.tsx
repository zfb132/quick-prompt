import React, { useEffect, useRef, useState } from 'react'
import { browser } from '#imports'
import type { PromptAttachment } from '@/utils/types'
import { formatFileSize, isImageAttachment } from '@/utils/attachments/metadata'

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
              <img src={preview.url} alt={attachment.name} className="qp-attachment-image" />
            )}
            <div className="qp-attachment-meta">
              <span className="qp-attachment-name">{attachment.name}</span>
              <span className="qp-attachment-size">{formatFileSize(attachment.size)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default PromptAttachmentPreview
