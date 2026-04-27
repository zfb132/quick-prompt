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
  it('recognizes Ctrl+Shift+P as the prompt selector shortcut fallback', () => {
    expect(isOpenPromptSelectorShortcut(keydown('P'))).toBe(true)
    expect(isOpenPromptSelectorShortcut(keydown('p'))).toBe(true)
  })

  it('recognizes Ctrl+Shift+S as the save selected prompt shortcut fallback', () => {
    expect(isSaveSelectedPromptShortcut(keydown('S'))).toBe(true)
    expect(isSaveSelectedPromptShortcut(keydown('s'))).toBe(true)
  })

  it('does not treat unrelated modified keys as extension shortcuts', () => {
    expect(isOpenPromptSelectorShortcut(keydown('P', { altKey: true }))).toBe(false)
    expect(isOpenPromptSelectorShortcut(keydown('K'))).toBe(false)
    expect(isOpenPromptSelectorShortcut(keydown('E'))).toBe(false)
    expect(isSaveSelectedPromptShortcut(keydown('F'))).toBe(false)
    expect(isSaveSelectedPromptShortcut(keydown('S', { ctrlKey: false, metaKey: false }))).toBe(false)
  })
})
