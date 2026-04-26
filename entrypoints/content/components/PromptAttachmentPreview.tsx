import React, { useEffect, useState } from 'react'
import { browser } from '#imports'
import type { PromptAttachment } from '@/utils/types'
import { formatFileSize, isImageAttachment } from '@/utils/attachments/metadata'

interface PromptAttachmentPreviewProps {
  attachments?: PromptAttachment[]
}

interface ImagePreviewState {
  url?: string
}

const PromptAttachmentPreview: React.FC<PromptAttachmentPreviewProps> = ({ attachments = [] }) => {
  const [imagePreviews, setImagePreviews] = useState<Record<string, ImagePreviewState>>({})

  useEffect(() => {
    const imageAttachments = attachments.filter(isImageAttachment)
    const objectUrls: string[] = []
    let canceled = false

    if (imageAttachments.length === 0) {
      setImagePreviews({})
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

          if (!response?.success || !response.buffer) return

          const blob = new Blob([response.buffer], { type: response.contentType || attachment.type })
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
  }, [attachments])

  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="qp-attachments">
      {attachments.map((attachment) => {
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
