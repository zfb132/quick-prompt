import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildPromptInsertion,
  createEditableAdapter,
  findEditableElement,
  getSelectedText,
} from '@/entrypoints/content/utils/editableTarget'

describe('content editable target helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('treats plaintext-only contenteditable elements as prompt targets', () => {
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'plaintext-only')
    editable.textContent = 'hello /p'
    document.body.appendChild(editable)

    expect(findEditableElement(editable)).toBe(editable)
    expect(createEditableAdapter(editable).value).toBe('hello /p')
  })

  it('uses the closest editable host when input events originate from nested nodes', () => {
    const host = document.createElement('div')
    host.setAttribute('contenteditable', 'true')
    const child = document.createElement('span')
    host.appendChild(child)
    document.body.appendChild(host)

    expect(findEditableElement(child)).toBe(host)
  })

  it('keeps the original contenteditable cursor after the selector search input takes focus', () => {
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    editable.textContent = 'hello world'
    document.body.appendChild(editable)

    const range = document.createRange()
    range.setStart(editable.firstChild!, 5)
    range.collapse(true)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)

    const adapter = createEditableAdapter(editable)
    expect(adapter.selectionStart).toBe(5)

    const searchInput = document.createElement('input')
    document.body.appendChild(searchInput)
    searchInput.focus()

    expect(adapter.selectionStart).toBe(5)
  })

  it('keeps the original text input cursor if focus changes before prompt insertion', () => {
    const input = document.createElement('input')
    input.value = 'hello /p'
    document.body.appendChild(input)
    input.focus()
    input.setSelectionRange(8, 8)

    const adapter = createEditableAdapter(input)
    input.setSelectionRange(0, 0)

    expect(adapter.selectionStart).toBe(8)
  })

  it('reads selected text from focused text inputs', () => {
    const input = document.createElement('input')
    input.value = 'save this prompt'
    document.body.appendChild(input)
    input.focus()
    input.setSelectionRange(5, 9)

    expect(getSelectedText()).toBe('this')
  })

  it('removes a typed /p trigger even when the current cursor is unreliable', () => {
    expect(buildPromptInsertion('hello /p', 0, 'PROMPT', { removePromptTrigger: true })).toEqual({
      value: 'hello PROMPT',
      cursorPosition: 12,
    })
  })

  it('inserts at the cursor without removing literal /p for shortcut opens', () => {
    expect(buildPromptInsertion('hello /p', 8, 'PROMPT')).toEqual({
      value: 'hello /pPROMPT',
      cursorPosition: 14,
    })

    expect(buildPromptInsertion('hello world', 5, ' PROMPT')).toEqual({
      value: 'hello PROMPT world',
      cursorPosition: 12,
    })
  })
})
