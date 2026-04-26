import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Category } from '@/utils/types'

vi.mock('@/utils/i18n', () => ({
  t: (key: string, substitutions?: string[]) => (
    substitutions?.length ? `${key}:${substitutions.join(',')}` : key
  ),
}))

const { default: CategoryList } = await import('@/entrypoints/options/components/CategoryList')

const createCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'work',
  name: 'Work',
  description: 'Work prompts',
  color: '#2563eb',
  enabled: true,
  createdAt: '2026-04-26T00:00:00.000Z',
  updatedAt: '2026-04-26T00:00:00.000Z',
  ...overrides,
})

describe('CategoryList', () => {
  it('selects a category when its card is clicked', () => {
    const onSelect = vi.fn()

    render(
      <CategoryList
        categories={[createCategory()]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onSelect={onSelect}
        searchTerm=""
        allCategoriesCount={1}
        promptCounts={{ work: 3 }}
      />
    )

    fireEvent.click(screen.getByText('Work'))

    expect(onSelect).toHaveBeenCalledWith('work')
  })

  it('does not select the category when editing or toggling it', () => {
    const onEdit = vi.fn()
    const onToggleEnabled = vi.fn()
    const onSelect = vi.fn()

    render(
      <CategoryList
        categories={[createCategory()]}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onSelect={onSelect}
        searchTerm=""
        allCategoriesCount={1}
        onToggleEnabled={onToggleEnabled}
        promptCounts={{ work: 3 }}
      />
    )

    fireEvent.click(screen.getByTitle('edit'))
    fireEvent.click(screen.getByRole('checkbox'))

    expect(onEdit).toHaveBeenCalledWith('work')
    expect(onToggleEnabled).toHaveBeenCalledWith('work', false)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
