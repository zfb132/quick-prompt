import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, waitFor } from '@testing-library/react'
import type { Category, EditableElement, PromptItemWithVariables } from '@/utils/types'

const getCategories = vi.fn()
const getGlobalSetting = vi.fn()
const t = vi.fn((key: string) => `translated:${key}`)

vi.mock('@/utils/categoryUtils', () => ({ getCategories }))
vi.mock('@/utils/globalSettings', () => ({ getGlobalSetting }))
vi.mock('@/utils/i18n', () => ({ t }))
vi.mock('@/entrypoints/content/components/PromptAttachmentPreview', () => ({
  default: () => null,
}))

const { showPromptSelector } = await import('@/entrypoints/content/components/PromptSelector')

const createCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'default',
  name: 'Default',
  enabled: true,
  color: '#6366f1',
  createdAt: '2026-04-27T00:00:00.000Z',
  updatedAt: '2026-04-27T00:00:00.000Z',
  ...overrides,
})

const createPrompt = (overrides: Partial<PromptItemWithVariables> = {}): PromptItemWithVariables => ({
  id: 'prompt-1',
  title: 'Prompt title',
  content: 'Prompt content',
  tags: [],
  enabled: true,
  categoryId: 'default',
  ...overrides,
})

const createTarget = (): EditableElement => {
  const input = document.createElement('textarea')
  document.body.appendChild(input)
  return input
}

describe('content PromptSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.documentElement.innerHTML = '<head></head><body></body>'
    vi.clearAllMocks()
    getGlobalSetting.mockResolvedValue(true)
    getCategories.mockResolvedValue([
      createCategory(),
      createCategory({ id: 'code', name: 'Code', color: '#10b981' }),
    ])
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    Element.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a localized custom category selector instead of the native select', async () => {
    await act(async () => {
      showPromptSelector([createPrompt()], createTarget())
    })

    const host = document.getElementById('quick-prompt-selector')!
    const shadowRoot = host.shadowRoot!

    await waitFor(() => {
      expect(shadowRoot.querySelector('.qp-category-trigger')).not.toBeNull()
    })

    expect(shadowRoot.querySelector('select.qp-category-select')).toBeNull()

    const trigger = shadowRoot.querySelector('.qp-category-trigger') as HTMLButtonElement
    expect(trigger).toHaveTextContent('translated:allCategories')
    expect(trigger).toHaveAttribute('aria-label', 'translated:filterByCategory')
  })

  it('selects a category from the dropdown after a shadow-dom retargeted mouse down', async () => {
    await act(async () => {
      showPromptSelector([
        createPrompt({ id: 'default-prompt', title: 'Default prompt', categoryId: 'default' }),
        createPrompt({ id: 'code-prompt', title: 'Code prompt', categoryId: 'code' }),
      ], createTarget())
    })

    const host = document.getElementById('quick-prompt-selector')!
    const shadowRoot = host.shadowRoot!

    let trigger: HTMLButtonElement | null = null
    await waitFor(() => {
      trigger = shadowRoot.querySelector('.qp-category-trigger')
      expect(trigger).not.toBeNull()
    })

    fireEvent.click(trigger!)

    const picker = shadowRoot.querySelector('.qp-category-picker')!
    let codeOption: HTMLButtonElement | undefined
    await waitFor(() => {
      codeOption = Array.from(shadowRoot.querySelectorAll('.qp-category-option'))
        .find((option) => option.textContent?.includes('Code')) as HTMLButtonElement
      expect(codeOption).toBeDefined()
    })

    const retargetedMouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      composed: true,
    })
    Object.defineProperty(retargetedMouseDown, 'composedPath', {
      value: () => [
        codeOption,
        picker,
        shadowRoot,
        host,
        document.documentElement,
        document,
        window,
      ],
    })

    await act(async () => {
      document.dispatchEvent(retargetedMouseDown)
    })

    await waitFor(() => {
      expect(shadowRoot.querySelector('.qp-category-menu')).not.toBeNull()
    })

    codeOption = Array.from(shadowRoot.querySelectorAll('.qp-category-option'))
      .find((option) => option.textContent?.includes('Code')) as HTMLButtonElement
    fireEvent.click(codeOption)

    await waitFor(() => {
      expect(trigger!).toHaveTextContent('Code')
      expect(shadowRoot).toHaveTextContent('Code prompt')
      expect(shadowRoot).not.toHaveTextContent('Default prompt')
    })
  })

})
