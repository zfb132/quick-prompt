import type { EditableElement } from '@/utils/types'

const PROMPT_TRIGGER = '/p'
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

type EditableDomElement = HTMLInputElement | HTMLTextAreaElement | HTMLElement

const isElementNode = (target: EventTarget | null): target is Element =>
  target instanceof Element

export const isTextInputElement = (
  target: EventTarget | null
): target is HTMLInputElement | HTMLTextAreaElement => {
  if (target instanceof HTMLTextAreaElement) {
    return true
  }

  if (!(target instanceof HTMLInputElement)) {
    return false
  }

  return !NON_TEXT_INPUT_TYPES.has(target.type)
}

export const isContentEditableTarget = (
  target: EventTarget | null
): target is HTMLElement => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const contentEditable = target.getAttribute('contenteditable')
  return Boolean(target.isContentEditable) || (
    contentEditable !== null &&
    contentEditable.toLowerCase() !== 'false'
  )
}

export const findEditableElement = (
  target: EventTarget | null
): EditableDomElement | null => {
  if (isTextInputElement(target) || isContentEditableTarget(target)) {
    return target
  }

  const startElement = isElementNode(target)
    ? target
    : target instanceof Node
      ? target.parentElement
      : null

  const editable = startElement?.closest('input, textarea, [contenteditable]') ?? null
  if (isTextInputElement(editable) || isContentEditableTarget(editable)) {
    return editable
  }

  return null
}

export const getActiveEditableElement = (): EditableDomElement | null => {
  let activeElement: Element | null = document.activeElement

  while (activeElement?.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement
  }

  return findEditableElement(activeElement)
}

const setContentEditableValue = (element: HTMLElement, value: string): void => {
  element.textContent = value
  const inputEvent = new InputEvent('input', { bubbles: true })
  element.dispatchEvent(inputEvent)
}

const getTextOffset = (
  root: HTMLElement,
  container: Node,
  offset: number
): number => {
  if (container === root) {
    return Array.from(root.childNodes)
      .slice(0, offset)
      .reduce((total, node) => total + (node.textContent?.length || 0), 0)
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let currentOffset = 0
  let node = walker.nextNode()

  while (node) {
    const textLength = node.textContent?.length || 0
    if (node === container) {
      return currentOffset + Math.min(offset, textLength)
    }
    currentOffset += textLength
    node = walker.nextNode()
  }

  return root.textContent?.length || 0
}

const getTextPosition = (
  root: HTMLElement,
  offset: number
): { node: Node; offset: number } => {
  const normalizedOffset = Math.max(0, Math.min(offset, root.textContent?.length || 0))
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let currentOffset = 0
  let node = walker.nextNode()

  while (node) {
    const textLength = node.textContent?.length || 0
    if (currentOffset + textLength >= normalizedOffset) {
      return {
        node,
        offset: normalizedOffset - currentOffset,
      }
    }
    currentOffset += textLength
    node = walker.nextNode()
  }

  const textNode = document.createTextNode('')
  root.appendChild(textNode)
  return { node: textNode, offset: 0 }
}

const setContentEditableSelection = (
  element: HTMLElement,
  start: number,
  end: number
): void => {
  const selection = window.getSelection()
  if (!selection) {
    return
  }

  const range = document.createRange()
  const startPosition = getTextPosition(element, start)
  const endPosition = getTextPosition(element, end)

  range.setStart(startPosition.node, startPosition.offset)
  range.setEnd(endPosition.node, endPosition.offset)
  selection.removeAllRanges()
  selection.addRange(range)
}

export const createEditableAdapter = (
  element: EditableDomElement
): EditableElement => {
  if (isTextInputElement(element)) {
    let currentSelectionStart = element.selectionStart ?? element.value.length
    let currentSelectionEnd = element.selectionEnd ?? currentSelectionStart

    return {
      get value(): string {
        return element.value
      },
      set value(newValue: string) {
        element.value = newValue
      },
      get selectionStart(): number {
        return currentSelectionStart
      },
      get selectionEnd(): number {
        return currentSelectionEnd
      },
      focus(): void {
        element.focus()
      },
      setSelectionRange(start: number, end: number): void {
        currentSelectionStart = start
        currentSelectionEnd = end
        element.setSelectionRange(start, end)
      },
      dispatchEvent(event: Event): boolean {
        return element.dispatchEvent(event)
      },
    }
  }

  let currentSelectionStart = (() => {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      if (element.contains(range.startContainer)) {
        return getTextOffset(element, range.startContainer, range.startOffset)
      }
    }
    return element.textContent?.length || 0
  })()
  let currentSelectionEnd = currentSelectionStart

  return {
    _element: element,
    get value(): string {
      return element.textContent || ''
    },
    set value(newValue: string) {
      setContentEditableValue(element, newValue)
    },
    get selectionStart(): number {
      return currentSelectionStart
    },
    get selectionEnd(): number {
      return currentSelectionEnd
    },
    focus(): void {
      element.focus()
    },
    setSelectionRange(start: number, end: number): void {
      currentSelectionStart = start
      currentSelectionEnd = end
      setContentEditableSelection(element, start, end)
    },
    dispatchEvent(event: Event): boolean {
      return element.dispatchEvent(event)
    },
  }
}

export const getSelectedText = (): string => {
  const editableElement = getActiveEditableElement()

  if (isTextInputElement(editableElement)) {
    const start = editableElement.selectionStart ?? 0
    const end = editableElement.selectionEnd ?? start
    return editableElement.value.slice(start, end)
  }

  return window.getSelection()?.toString() || ''
}

export const buildPromptInsertion = (
  value: string,
  cursorPosition: number,
  content: string,
  options: { removePromptTrigger?: boolean } = {}
): { value: string; cursorPosition: number } => {
  const normalizedCursor = Math.max(0, Math.min(cursorPosition, value.length))
  const textBeforeCursor = value.slice(0, normalizedCursor)
  const textAfterCursor = value.slice(normalizedCursor)

  if (options.removePromptTrigger) {
    const triggerIndex = textBeforeCursor.toLowerCase().endsWith(PROMPT_TRIGGER)
      ? normalizedCursor - PROMPT_TRIGGER.length
      : value.toLowerCase().lastIndexOf(PROMPT_TRIGGER)

    if (triggerIndex >= 0) {
      const textBeforeTrigger = value.slice(0, triggerIndex)
      const textAfterTrigger = value.slice(triggerIndex + PROMPT_TRIGGER.length)

      return {
        value: textBeforeTrigger + content + textAfterTrigger,
        cursorPosition: textBeforeTrigger.length + content.length,
      }
    }
  }

  return {
    value: textBeforeCursor + content + textAfterCursor,
    cursorPosition: textBeforeCursor.length + content.length,
  }
}
