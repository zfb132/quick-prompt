import React, { useMemo, useState } from 'react'
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-sm text-primary"
            >
              <span className="truncate">{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="inline-flex size-4 flex-shrink-0 items-center justify-center rounded-full hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label={translate('removeTag', [tag])}
              >
                <X className="size-3" aria-hidden="true" />
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
              className="inline-flex max-w-full items-center rounded-full border border-border bg-muted px-2.5 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <span className="truncate">{tag}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
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
          className="min-w-0 flex-1"
          placeholder={translate('tagsPlaceholder')}
        />
        <Button
          type="button"
          onClick={() => addTag(customTag)}
          disabled={!normalizeTag(customTag)}
          variant="outline"
        >
          <Plus className="size-4" />
          {translate('addTag')}
        </Button>
      </div>
    </div>
  )
}

export default PromptTagSelector
