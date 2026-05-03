const PROMPT_SOURCE_PLACEHOLDER_BASE_URL = 'https://placehold.co/80x80/6366f1/white'

const MULTI_PART_PUBLIC_SUFFIXES = new Set([
  'ac.cn',
  'com.au',
  'com.br',
  'com.cn',
  'com.hk',
  'com.mx',
  'com.tw',
  'co.jp',
  'co.kr',
  'co.nz',
  'co.uk',
  'gov.cn',
  'gov.uk',
  'ne.jp',
  'net.au',
  'net.cn',
  'or.jp',
  'org.au',
  'org.cn',
  'org.uk',
])

const parsePromptSourceUrl = (url: string): URL | null => {
  try {
    return new URL(url.trim())
  } catch {
    return null
  }
}

const BASE64_CHUNK_SIZE = 0x6000

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  const chunks: string[] = []

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE)
    let binary = ''

    for (let index = 0; index < chunk.length; index++) {
      binary += String.fromCharCode(chunk[index])
    }

    chunks.push(btoa(binary))
  }

  return chunks.join('')
}

export const getPromptSourceDomainName = (url: string): string => {
  const parsed = parsePromptSourceUrl(url)
  if (!parsed) return ''

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
  const labels = hostname.split('.').filter(Boolean)

  if (labels.length <= 2) {
    return labels.join('.')
  }

  const publicSuffix = labels.slice(-2).join('.')
  if (MULTI_PART_PUBLIC_SUFFIXES.has(publicSuffix) && labels.length >= 3) {
    return labels.slice(-3).join('.')
  }

  return labels.slice(-2).join('.')
}

export const buildPromptSourcePreviewCandidates = (url: string): string[] => {
  const directUrl = url.trim()
  if (!directUrl) return []

  const candidates = [directUrl]
  const parsed = parsePromptSourceUrl(directUrl)

  if (parsed && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
    candidates.push(new URL('/favicon.ico', parsed.origin).toString())

    const domainName = getPromptSourceDomainName(directUrl)
    if (domainName) {
      candidates.push(`${PROMPT_SOURCE_PLACEHOLDER_BASE_URL}?text=${encodeURIComponent(domainName)}`)
    }
  }

  return Array.from(new Set(candidates))
}

export const fetchPromptSourcePreviewDataUrl = async (
  url: string,
  fetcher: (url: string) => Promise<Response> = fetch
): Promise<string | undefined> => {
  for (const candidate of buildPromptSourcePreviewCandidates(url)) {
    try {
      const response = await fetcher(candidate)
      if (!response.ok) continue

      const contentType = (
        response.headers.get('content-type')?.split(';')[0].trim() ||
        ''
      )

      if (!contentType.startsWith('image/')) continue

      const base64 = arrayBufferToBase64(await response.arrayBuffer())
      return `data:${contentType};base64,${base64}`
    } catch {
      // Try the next candidate.
    }
  }

  return undefined
}
