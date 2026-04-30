import { describe, expect, it } from 'vitest'

import {
  buildPromptSourcePreviewCandidates,
  fetchPromptSourcePreviewDataUrl,
  getPromptSourceDomainName,
} from '@/utils/promptSourcePreview'

describe('promptSourcePreview', () => {
  it('builds direct, favicon, and placeholder preview candidates', () => {
    expect(buildPromptSourcePreviewCandidates('https://cdn.example.cn/prompts/source')).toEqual([
      'https://cdn.example.cn/prompts/source',
      'https://cdn.example.cn/favicon.ico',
      'https://placehold.co/80x80/6366f1/white?text=example.cn',
    ])
  })

  it('uses the registrable domain for placeholder text', () => {
    expect(getPromptSourceDomainName('https://www.assets.example.co.uk/prompt')).toBe('example.co.uk')
    expect(getPromptSourceDomainName('https://sub.example.cn/prompt')).toBe('example.cn')
  })

  it('fetches the first image candidate as a base64 data URL', async () => {
    const fetcher = async (url: string) => {
      if (url === 'https://example.cn/prompt') {
        return new Response('not an image', {
          headers: { 'content-type': 'text/html' },
        })
      }

      return new Response('favicon', {
        headers: { 'content-type': 'image/png' },
      })
    }

    await expect(fetchPromptSourcePreviewDataUrl('https://example.cn/prompt', fetcher)).resolves.toBe(
      'data:image/png;base64,ZmF2aWNvbg=='
    )
  })
})
