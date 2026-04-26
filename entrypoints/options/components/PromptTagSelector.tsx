import React, { useMemo, useState } from 'react'

interface PromptTagSelectorProps {
  selectedTags: string[]
  availableTags?: string[]
  onChange: (tags: string[]) => void
  translate?: (key: string, substitutions?: string[]) => string
}

const defaultTranslate = (key: string) => key

const normalizeTag = (tag: string) => tag.trim()

const getTagKey = (tag: string) => normalizeTag(tag).toLocaleLowerCase()

const uniqueTags = (tags: string[]) => {
  const seen = new Set<string>()
  const result: string[] = []

  tags.forEach((tag) => {
    const normalized = normalizeTag(tag)
    const key = getTagKey(normalized)

    if (!normalized || seen.has(key)) return

    seen.add(key)
    result.push(normalized)
  })

  return result
}

const PromptTagSelector: React.FC<PromptTagSelectorProps> = ({
  selectedTags,
  availableTags = [],
  onChange,
  translate = defaultTranslate,
}) => {
  const [customTag, setCustomTag] = useState('')
  const normalizedSelectedTags = useMemo(() => uniqueTags(selectedTags), [selectedTags])
  const selectedKeys = useMemo(
    () => new Set(normalizedSelectedTags.map(getTagKey)),
    [normalizedSelectedTags]
  )
  const selectableTags = useMemo(() => (
    uniqueTags([...availableTags, ...normalizedSelectedTags])
      .filter((tag) => !selectedKeys.has(getTagKey(tag)))
      .sort((left, right) => left.localeCompare(right))
  ), [availableTags, normalizedSelectedTags, selectedKeys])

  const addTag = (tag: string) => {
    const normalized = normalizeTag(tag)

    if (!normalized) return

    if (!selectedKeys.has(getTagKey(normalized))) {
      onChange([...normalizedSelectedTags, normalized])
    }

    setCustomTag('')
  }

  const removeTag = (tag: string) => {
    const keyToRemove = getTagKey(tag)
    onChange(normalizedSelectedTags.filter((item) => getTagKey(item) !== keyToRemove))
  }

  return (
    <div className="space-y-3">
      {normalizedSelectedTags.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          aria-label={translate('selectedTags')}
        >
          {normalizedSelectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-sm text-blue-700"
            >
              <span className="truncate">{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-blue-500 hover:bg-blue-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={translate('removeTag', [tag])}
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {selectableTags.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          aria-label={translate('availableTags')}
        >
          {selectableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="inline-flex max-w-full items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-sm text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="truncate">{tag}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          id="tags"
          value={customTag}
          onChange={(event) => setCustomTag(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addTag(customTag)
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 shadow-sm transition-colors duration-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={translate('tagsPlaceholder')}
        />
        <button
          type="button"
          onClick={() => addTag(customTag)}
          disabled={!normalizeTag(customTag)}
          className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {translate('addTag')}
        </button>
      </div>
    </div>
  )
}

export default PromptTagSelector
