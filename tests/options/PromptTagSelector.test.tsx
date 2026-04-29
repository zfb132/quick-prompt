import React, { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PromptTagSelector from '@/entrypoints/options/components/PromptTagSelector'

const translate = (key: string, substitutions?: string[]) => (
  substitutions?.length ? `${key}:${substitutions.join(',')}` : key
)

const Harness = ({
  initialTags = [],
  availableTags = ['work', 'email', 'coding'],
}: {
  initialTags?: string[]
  availableTags?: string[]
}) => {
  const [selectedTags, setSelectedTags] = useState(initialTags)

  return (
    <>
      <PromptTagSelector
        selectedTags={selectedTags}
        availableTags={availableTags}
        onChange={setSelectedTags}
        translate={translate}
      />
      <output data-testid="selected-tags">{selectedTags.join('|')}</output>
    </>
  )
}

describe('PromptTagSelector', () => {
  it('selects multiple existing tags', () => {
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: 'work' }))
    fireEvent.click(screen.getByRole('button', { name: 'email' }))

    expect(screen.getByTestId('selected-tags')).toHaveTextContent('work|email')
  })

  it('adds a custom tag from the input', () => {
    render(<Harness initialTags={['work']} />)

    fireEvent.change(screen.getByPlaceholderText('tagsPlaceholder'), {
      target: { value: 'urgent' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'addTag' }))

    expect(screen.getByTestId('selected-tags')).toHaveTextContent('work|urgent')
  })

  it('removes selected tags', () => {
    render(<Harness initialTags={['work', 'email']} />)

    fireEvent.click(screen.getByRole('button', { name: 'removeTag:work' }))

    expect(screen.getByTestId('selected-tags')).toHaveTextContent('email')
  })
})
