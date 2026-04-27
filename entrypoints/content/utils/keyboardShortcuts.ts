const OPEN_PROMPT_SELECTOR_KEYS = new Set(['k', 'e'])
const SAVE_SELECTED_PROMPT_KEY = 'f'

const isSupportedModifierShortcut = (event: KeyboardEvent): boolean =>
  event.shiftKey &&
  !event.altKey &&
  !event.repeat &&
  (event.ctrlKey || event.metaKey)

export const isOpenPromptSelectorShortcut = (event: KeyboardEvent): boolean =>
  isSupportedModifierShortcut(event) &&
  OPEN_PROMPT_SELECTOR_KEYS.has(event.key.toLowerCase())

export const isSaveSelectedPromptShortcut = (event: KeyboardEvent): boolean =>
  isSupportedModifierShortcut(event) &&
  event.key.toLowerCase() === SAVE_SELECTED_PROMPT_KEY
