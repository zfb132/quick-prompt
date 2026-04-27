import { useState, useEffect } from 'react'
import { AlertCircle, Check, Save, X } from "lucide-react"
import type { Category } from '@/utils/types'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { t } from '@/utils/i18n'

interface CategoryFormProps {
  onSubmit: (category: Category | Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  initialData: Category | null
  onCancel: () => void
  isEditing: boolean
}

const CategoryForm = ({ onSubmit, initialData, onCancel, isEditing }: CategoryFormProps) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [enabled, setEnabled] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 预设颜色选项
  const colorOptions = [
    { name: t('blue'), value: '#6366f1' },
    { name: t('green'), value: '#10b981' },
    { name: t('yellow'), value: '#f59e0b' },
    { name: t('red'), value: '#ef4444' },
    { name: t('purple'), value: '#8b5cf6' },
    { name: t('pink'), value: '#ec4899' },
    { name: t('cyan'), value: '#06b6d4' },
    { name: t('orange'), value: '#f97316' },
  ]

  // Reset form when initialData changes
  useEffect(() => {
    if (initialData) {
      setName(initialData.name)
      setDescription(initialData.description || '')
      setColor(initialData.color || '#6366f1')
      setEnabled(initialData.enabled)
    } else {
      setName('')
      setDescription('')
      setColor('#6366f1')
      setEnabled(true)
    }
    setError(null)
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form inputs
    if (!name.trim()) {
      setError(t('categoryNameCannotBeEmpty'))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const categoryData = {
        ...(initialData ? { id: initialData.id, createdAt: initialData.createdAt } : {}),
        name: name.trim(),
        description: description.trim(),
        color,
        enabled,
      }

      await onSubmit(categoryData as any)

      // Clear form if not in edit mode
      if (!isEditing) {
        setName('')
        setDescription('')
        setColor('#6366f1')
        setEnabled(true)
      }
    } catch (err) {
      console.error('提交分类表单出错:', err)
      setError(t('saveFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className='space-y-5'>
        <div>
          <label htmlFor='name' className='mb-1.5 block text-sm font-medium text-foreground'>
            {t('categoryName')}
          </label>
          <Input
            type='text'
            id='name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('categoryExample')}
          />
        </div>

        <div>
          <label htmlFor='description' className='mb-1.5 block text-sm font-medium text-foreground'>
            {t('description')} <span className='font-normal text-muted-foreground'>({t('optional')})</span>
          </label>
          <Textarea
            id='description'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder={t('descriptionExample')}
          />
        </div>

        <div>
          <label className='mb-2 block text-sm font-medium text-foreground'>
            {t('categoryColor')}
          </label>
          <div className='flex flex-wrap gap-2'>
            {colorOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => setColor(option.value)}
                className={cn(
                  "relative flex size-9 cursor-pointer items-center justify-center rounded-full ring-1 ring-border transition-all hover:ring-2 hover:ring-ring",
                  color === option.value && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                )}
                style={{ backgroundColor: option.value }}
                title={option.name}
                aria-label={option.name}
              >
                <Check
                  className={cn(
                    "size-5 text-white transition-all",
                    color === option.value ? "scale-100 opacity-100" : "scale-75 opacity-0",
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div className='flex items-center justify-between rounded-2xl border border-border bg-muted/40 p-4'>
          <div>
            <div className="text-sm font-medium text-foreground">
              {enabled ? t('enabled') : t('disabled')}
            </div>
            <div className="text-xs text-muted-foreground">{t('disabledTips')}</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={enabled ? t('enabled') : t('disabled')} />
        </div>

        <div className='flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end'>
          <Button
            type='button'
            onClick={onCancel}
            variant="outline"
          >
            <X className="size-4" />
            {t('cancel')}
          </Button>

          <Button
            type='submit'
            disabled={isSubmitting}
          >
            <Save className="size-4" />
            {isSubmitting ? t('saving') : isEditing ? t('updateCategory') : t('saveCategory')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default CategoryForm
