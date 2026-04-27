import { describe, expect, it } from 'vitest'
import {
  isOpenPromptSelectorShortcut,
  isSaveSelectedPromptShortcut,
} from '@/entrypoints/content/utils/keyboardShortcuts'

const keydown = (key: string, options: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent('keydown', {
    key,
    ctrlKey: true,
    shiftKey: true,
    bubbles: true,
    ...options,
  })

describe('content keyboard shortcuts', () => {
  it('recognizes Ctrl+Shift+E as prompt selector shortcut', () => {
    expect(isOpenPromptSelectorShortcut(keydown('K'))).toBe(true)
    expect(isOpenPromptSelectorShortcut(keydown('k'))).toBe(true)
    expect(isOpenPromptSelectorShortcut(keydown('E'))).toBe(true)
    expect(isOpenPromptSelectorShortcut(keydown('e'))).toBe(true)
  })

  it('recognizes Ctrl+Shift+F as save selected prompt shortcut', () => {
    expect(isSaveSelectedPromptShortcut(keydown('F'))).toBe(true)
    expect(isSaveSelectedPromptShortcut(keydown('f'))).toBe(true)
  })

  it('does not treat unrelated modified keys as extension shortcuts', () => {
    expect(isOpenPromptSelectorShortcut(keydown('E', { altKey: true }))).toBe(false)
    expect(isOpenPromptSelectorShortcut(keydown('P'))).toBe(false)
    expect(isSaveSelectedPromptShortcut(keydown('F', { ctrlKey: false, metaKey: false }))).toBe(false)
  })
})
