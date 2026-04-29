import React from 'react'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { t } from '../../../utils/i18n'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

const SearchBar = ({ value, onChange }: SearchBarProps) => {
  const handleClear = () => {
    onChange('')
  }

  return (
    <div className='relative w-full'>
      <div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
        <Search className='size-4 text-muted-foreground' aria-hidden='true' />
      </div>
      <Input
        type='text'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='h-11 rounded-xl pl-10 pr-10'
        placeholder={t('searchPromptTitleContentTag')}
      />

      {value && (
        <div className='absolute inset-y-0 right-0 flex items-center pr-1.5'>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            onClick={handleClear}
            className='text-muted-foreground'
            aria-label={t('clearSearch')}
          >
            <X className='size-4' />
          </Button>
        </div>
      )}
    </div>
  )
}

export default SearchBar
