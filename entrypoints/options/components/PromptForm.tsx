import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Info, Save, X } from "lucide-react"
import type { PromptItem, Category, PromptAttachment } from '@/utils/types'
import { getCategories } from '@/utils/categoryUtils'
import { DEFAULT_CATEGORY_ID } from '@/utils/constants'
import { getValidCategoryId } from '@/utils/promptUtils'
import { fetchPromptSourcePreviewDataUrl } from '@/utils/promptSourcePreview'
import PromptAttachmentEditor from './PromptAttachmentEditor'
import PromptTagSelector from './PromptTagSelector'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { t } from '../../../utils/i18n'

interface PromptFormProps {
  onSubmit: (prompt: PromptItem | Omit<PromptItem, 'id'>) => Promise<void>
  initialData: PromptItem | null
  initialContent?: string | null
  onCancel: () => void
  isEditing: boolean
  availableTags?: string[]
}

const PromptForm = ({
  onSubmit,
  initialData,
  initialContent,
  onCancel,
  isEditing,
  availableTags = [],
}: PromptFormProps) => {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<PromptAttachment[]>([])
  const [promptSourceUrl, setPromptSourceUrl] = useState('')
  const [promptSourcePreviewDataUrl, setPromptSourcePreviewDataUrl] = useState('')
  const [resolvedPromptSourceUrl, setResolvedPromptSourceUrl] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [newPromptId, setNewPromptId] = useState(() => crypto.randomUUID())
  const promptSourceUrlRef = useRef('')
  const promptId = initialData?.id || newPromptId

  useEffect(() => {
    promptSourceUrlRef.current = promptSourceUrl
  }, [promptSourceUrl])

  // 加载分类列表并初始化表单
  useEffect(() => {
    const initForm = async () => {
      try {
        setLoadingCategories(true)
        const categoriesList = await getCategories()
        const enabledCategories = categoriesList.filter(cat => cat.enabled)
        setCategories(enabledCategories)

        if (initialData) {
          setTitle(initialData.title)
          setContent(initialData.content)
          setTags(initialData.tags || [])
          setNotes(initialData.notes || '')
          setAttachments(initialData.attachments || [])
          const sourceUrl = initialData.promptSourceUrl || (initialData as PromptItem & { thumbnailUrl?: string }).thumbnailUrl || ''
          setPromptSourceUrl(sourceUrl)
          setPromptSourcePreviewDataUrl(initialData.promptSourcePreviewDataUrl || '')
          setResolvedPromptSourceUrl(initialData.promptSourcePreviewDataUrl ? sourceUrl : '')
          setEnabled(initialData.enabled !== undefined ? initialData.enabled : true)
          setCategoryId(getValidCategoryId(initialData.categoryId, enabledCategories))
        } else {
          setTitle('')
          setContent(initialContent || '')
          setTags([])
          setNotes('')
          setAttachments([])
          setPromptSourceUrl('')
          setPromptSourcePreviewDataUrl('')
          setResolvedPromptSourceUrl('')
          setEnabled(true)
          setCategoryId(getValidCategoryId(DEFAULT_CATEGORY_ID, enabledCategories))
        }
        setError(null)
      } catch (err) {
        console.error(t('loadCategoriesError'), err)
      } finally {
        setLoadingCategories(false)
      }
    }

    initForm()
  }, [initialData, initialContent])

  const handlePromptSourceUrlChange = (value: string) => {
    setPromptSourceUrl(value)

    if (value.trim() !== resolvedPromptSourceUrl) {
      setPromptSourcePreviewDataUrl('')
      setResolvedPromptSourceUrl('')
    }
  }

  const resolvePromptSourcePreview = async (): Promise<string> => {
    const sourceUrl = promptSourceUrl.trim()

    if (!sourceUrl) {
      setPromptSourcePreviewDataUrl('')
      setResolvedPromptSourceUrl('')
      return ''
    }

    if (sourceUrl === resolvedPromptSourceUrl && promptSourcePreviewDataUrl) {
      return promptSourcePreviewDataUrl
    }

    const dataUrl = await fetchPromptSourcePreviewDataUrl(sourceUrl)

    if (promptSourceUrlRef.current.trim() === sourceUrl) {
      setPromptSourcePreviewDataUrl(dataUrl || '')
      setResolvedPromptSourceUrl(dataUrl ? sourceUrl : '')
    }

    return dataUrl || ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form inputs
    if (!title.trim()) {
      setError(t('titleCannotBeEmpty'))
      return
    }

    if (!content.trim()) {
      setError(t('contentCannotBeEmpty'))
      return
    }

    if (!categoryId) {
      setError(t('pleaseSelectCategory'))
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const now = new Date().toISOString()
      const submittedPromptId = initialData?.id || newPromptId
      const submittedPromptSourceUrl = promptSourceUrl.trim()
      const submittedPromptSourcePreviewDataUrl = submittedPromptSourceUrl
        ? await resolvePromptSourcePreview()
        : ''
      // Create prompt object
      const promptData = {
        ...(submittedPromptId ? { id: submittedPromptId } : {}),
        title: title.trim(),
        content: content.trim(),
        tags,
        notes: notes.trim(),
        attachments,
        promptSourceUrl: submittedPromptSourceUrl || undefined,
        promptSourcePreviewDataUrl: submittedPromptSourcePreviewDataUrl || undefined,
        enabled,
        categoryId,
        createdAt: initialData?.createdAt || now,
        lastModified: now,
      }

      await onSubmit(promptData as any) // Type assertion to handle both new and edited prompts

      // Clear form if not in edit mode (adding new prompt)
      if (!isEditing) {
        setTitle('')
        setContent('')
        setTags([])
        setNotes('')
        setAttachments([])
        setPromptSourceUrl('')
        setPromptSourcePreviewDataUrl('')
        setResolvedPromptSourceUrl('')
        setNewPromptId(crypto.randomUUID())
        // 保持当前分类选中，而不是重置为可能无效的默认分类
      }
    } catch (err) {
      console.error(t('formSubmitError'), err)
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
          <label htmlFor='title' className='mb-1.5 block text-sm font-medium text-foreground'>
            {t('titleLabel')}
          </label>
          <Input
            type='text'
            id='title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
          />
        </div>

        <div>
          <label htmlFor='content' className='mb-1.5 block text-sm font-medium text-foreground'>
            {t('contentLabel')}
          </label>
          <Textarea
            id='content'
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder={t('contentPlaceholder')}
          />
          <div className='mt-2 rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground'>
            <p className="flex items-center gap-2 text-foreground">
              <Info className="size-4 text-primary" />
              {t('variableFormatTip')}
            </p>
            <p className='mt-1 text-xs'>{t('variableExample')}</p>
          </div>
        </div>

        <div>
          <label htmlFor='category' className='mb-1.5 block text-sm font-medium text-foreground'>
            {t('categoryLabel')}
          </label>
          {loadingCategories ? (
            <div className='flex h-10 w-full items-center rounded-xl border border-input bg-muted px-3 text-sm text-muted-foreground'>
              {t('loadingCategories')}
            </div>
          ) : (
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="category">
                <SelectValue placeholder={t('pleaseSelectCategory')} />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {categories.length === 0 && !loadingCategories && (
            <p className='mt-2 text-sm text-muted-foreground'>
              {t('noAvailableCategories')}
              <Link 
                to='/categories' 
                className='ml-1 text-primary hover:underline'
              >
                {t('createCategory')}
              </Link>
            </p>
          )}
        </div>

        <div>
          <label htmlFor='tags' className='mb-1.5 block text-sm font-medium text-foreground'>
            {t('tagsLabel')} <span className='font-normal text-muted-foreground'>({t('tagsOptional')})</span>
          </label>
          <PromptTagSelector
            selectedTags={tags}
            availableTags={availableTags}
            onChange={setTags}
            translate={t}
          />
        </div>

        <div>
          <label htmlFor='notes' className='mb-1.5 block text-sm font-medium text-foreground'>
            {t('notesLabel')} <span className='font-normal text-muted-foreground'>({t('notesOptional')})</span>
          </label>
          <Textarea
            id='notes'
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder={t('notesPlaceholder')}
          />
          <div className='mt-1 text-xs text-muted-foreground'>
            {t('notesHelp')}
          </div>
        </div>

        <PromptAttachmentEditor
          promptId={promptId}
          attachments={attachments}
          onChange={setAttachments}
          translate={t}
        />

        <div>
          <label htmlFor='promptSourceUrl' className='mb-1.5 block text-sm font-medium text-foreground'>
            {t('promptSourceUrlLabel')} <span className='font-normal text-muted-foreground'>({t('promptSourceUrlOptional')})</span>
          </label>
          <Input
            type='url'
            id='promptSourceUrl'
            value={promptSourceUrl}
            onChange={(e) => handlePromptSourceUrlChange(e.target.value)}
            onBlur={() => void resolvePromptSourcePreview()}
            placeholder={t('promptSourceUrlPlaceholder')}
          />
          {promptSourcePreviewDataUrl && (
            <div className='mt-2'>
              <img
                src={promptSourcePreviewDataUrl}
                alt={t('promptSourceUrlPreviewAlt')}
                className='max-h-32 max-w-32 rounded-xl border border-border object-cover'
                onLoad={(e) => {
                  (e.target as HTMLImageElement).style.display = 'block'
                }}
              />
            </div>
          )}
        </div>

        <div className='flex items-center justify-between rounded-2xl border border-border bg-muted/40 p-4'>
          <div>
            <div className="text-sm font-medium text-foreground">
              {enabled ? t('enabledStatus') : t('disabledStatus')}
            </div>
            <div className="text-xs text-muted-foreground">{t('disabledStatusTip')}</div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={enabled ? t('enabledStatus') : t('disabledStatus')} />
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
            {isSubmitting ? t('savingPrompt') : isEditing ? t('updatePrompt') : t('savePromptButton')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default PromptForm
