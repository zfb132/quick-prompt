# Prompt Attachments And WebDAV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent local prompt attachments stored through File System Access API and WebDAV upload/download with optional automatic upload.

**Architecture:** Keep prompt records in `browser.storage.local` and store only attachment metadata there. Store attachment bytes in a user-authorized local directory, with file operations isolated in `utils/attachments/*`. Add WebDAV as a separate sync integration that uploads one JSON manifest plus attachment files under the same relative paths.

**Tech Stack:** TypeScript, React, WXT, Browser extension APIs, File System Access API, IndexedDB, Vitest, WebDAV over `fetch`.

---

## File Structure

- Modify `utils/types.ts`: add `PromptAttachment` and `attachments?: PromptAttachment[]`.
- Create `utils/attachments/metadata.ts`: pure helpers for file-name sanitization, relative paths, image detection, size formatting, and prompt normalization.
- Create `utils/attachments/fileSystem.ts`: IndexedDB handle persistence, permission checks, directory picker, file copy/read/delete, and fake-handle-friendly helpers.
- Create `utils/attachments/promptAttachmentOperations.ts`: prompt-level copy/delete/duplicate operations.
- Create `entrypoints/options/components/AttachmentStorageGate.tsx`: blocks options UI until a root directory has persistent `readwrite` permission.
- Modify `entrypoints/options/App.tsx`: wrap options routes in `AttachmentStorageGate`.
- Create `entrypoints/options/components/PromptAttachmentEditor.tsx`: add/remove attachment UI inside `PromptForm`.
- Create `entrypoints/options/components/PromptAttachmentPreview.tsx`: prompt card attachment rendering.
- Modify `entrypoints/options/components/PromptForm.tsx`: manage attachment state and submit attachment metadata.
- Modify `entrypoints/options/components/PromptManager.tsx`: allocate IDs before adding, delete prompt files, duplicate attachment files.
- Modify `entrypoints/options/components/SortablePromptCard.tsx`: render attachment previews.
- Create `entrypoints/content/components/PromptAttachmentPreview.tsx`: `/p` selector attachment display.
- Modify `entrypoints/content/components/PromptSelector.tsx`: include attachment preview in selector rows.
- Modify `entrypoints/content/utils/styles.ts`: add attachment selector styles.
- Modify `utils/browser/messageHandler.ts`: return attachment preview bytes for image attachments.
- Create `utils/sync/webdavSync.ts`: WebDAV request helpers, path helpers, XML multistatus parsing, manifest serialization.
- Create `utils/sync/webdavBackup.ts`: upload/download orchestration using prompt/category storage plus local attachment files.
- Create `entrypoints/options/components/WebDavIntegration.tsx`: WebDAV settings, status, manual upload/download.
- Create `entrypoints/options/components/WebDavIntegrationPage.tsx`: page shell.
- Modify `entrypoints/options/App.tsx`: add `/integrations/webdav`.
- Modify `entrypoints/options/components/Sidebar.tsx`: add WebDAV link.
- Modify `utils/browser/storageManager.ts`: add debounced WebDAV automatic upload.
- Modify `public/_locales/en/messages.json` and `public/_locales/zh/messages.json`: add attachment, authorization, and WebDAV strings.
- Modify `types/global.d.ts`: add File System Access API and `showDirectoryPicker` declarations needed by TypeScript.
- Add tests under `tests/utils/` and `tests/options/` for pure helpers, WebDAV helpers, backup orchestration, and the authorization gate.

---

### Task 1: Attachment Types And Pure Metadata Helpers

**Files:**
- Modify: `utils/types.ts`
- Create: `utils/attachments/metadata.ts`
- Test: `tests/utils/attachmentMetadata.test.ts`

- [ ] **Step 1: Write the failing test**

Add `tests/utils/attachmentMetadata.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { PromptItem } from '@/utils/types'
import {
  ATTACHMENTS_DIR_NAME,
  buildAttachmentRelativePath,
  formatFileSize,
  isImageAttachment,
  normalizePromptAttachments,
  sanitizeFileName,
} from '@/utils/attachments/metadata'

const createPrompt = (overrides: Partial<PromptItem> = {}): PromptItem => ({
  id: 'prompt-1',
  title: 'Prompt',
  content: 'Content',
  tags: [],
  enabled: true,
  categoryId: 'default',
  ...overrides,
})

describe('attachment metadata helpers', () => {
  it('sanitizes file names without changing safe names', () => {
    expect(sanitizeFileName('photo.png')).toBe('photo.png')
    expect(sanitizeFileName('../secret:file?.png')).toBe('secret-file-.png')
    expect(sanitizeFileName('   ')).toBe('attachment')
  })

  it('builds stable relative paths for prompt attachments', () => {
    expect(buildAttachmentRelativePath('prompt-1', 'att-1', 'a/b.txt')).toBe(
      `${ATTACHMENTS_DIR_NAME}/prompt-1/att-1-a-b.txt`
    )
  })

  it('formats file sizes', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(1023)).toBe('1023 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(1048576)).toBe('1 MB')
  })

  it('detects image attachments by mime type', () => {
    expect(isImageAttachment({ id: '1', name: 'a', type: 'image/png', size: 1, relativePath: 'x', createdAt: 'now' })).toBe(true)
    expect(isImageAttachment({ id: '2', name: 'a', type: 'application/pdf', size: 1, relativePath: 'x', createdAt: 'now' })).toBe(false)
  })

  it('normalizes prompts to always have an attachments array', () => {
    expect(normalizePromptAttachments(createPrompt()).attachments).toEqual([])
    expect(
      normalizePromptAttachments(createPrompt({
        attachments: [{ id: 'a', name: 'f.txt', type: '', size: 1, relativePath: 'attachments/prompt-1/a-f.txt', createdAt: '2024-01-01T00:00:00.000Z' }],
      })).attachments
    ).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm vitest run tests/utils/attachmentMetadata.test.ts
```

Expected: FAIL because `@/utils/attachments/metadata` does not exist.

- [ ] **Step 3: Add the types and minimal implementation**

Update `utils/types.ts`:

```ts
export interface PromptAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  relativePath: string;
  createdAt: string;
}
```

Add `attachments?: PromptAttachment[];` to `PromptItem`.

Create `utils/attachments/metadata.ts`:

```ts
import type { PromptAttachment, PromptItem } from '@/utils/types'

export const ATTACHMENTS_DIR_NAME = 'attachments'

export const sanitizeFileName = (fileName: string): string => {
  const sanitized = fileName
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/[:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')

  return sanitized || 'attachment'
}

export const buildAttachmentRelativePath = (
  promptId: string,
  attachmentId: string,
  fileName: string
): string => {
  return `${ATTACHMENTS_DIR_NAME}/${promptId}/${attachmentId}-${sanitizeFileName(fileName)}`
}

export const getAttachmentPathSegments = (relativePath: string): string[] => {
  return relativePath.split('/').filter(Boolean)
}

export const isImageAttachment = (attachment: Pick<PromptAttachment, 'type'>): boolean => {
  return attachment.type.toLowerCase().startsWith('image/')
}

export const formatFileSize = (size: number): string => {
  if (!Number.isFinite(size) || size <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value = value / 1024
    unitIndex++
  }

  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(1).replace(/\.0$/, '')
  return `${formatted} ${units[unitIndex]}`
}

export const normalizePromptAttachments = (prompt: PromptItem): PromptItem => {
  return {
    ...prompt,
    attachments: Array.isArray(prompt.attachments) ? prompt.attachments : [],
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm vitest run tests/utils/attachmentMetadata.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/types.ts utils/attachments/metadata.ts tests/utils/attachmentMetadata.test.ts
git commit -m "feat: add prompt attachment metadata helpers"
```

---

### Task 2: File System Access Handle Utilities

**Files:**
- Modify: `types/global.d.ts`
- Create: `utils/attachments/fileSystem.ts`
- Test: `tests/utils/attachmentFileSystem.test.ts`

- [ ] **Step 1: Write the failing test**

Add `tests/utils/attachmentFileSystem.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  copyFileToAttachmentRoot,
  getFileFromAttachmentRoot,
  removeAttachmentFileFromRoot,
} from '@/utils/attachments/fileSystem'

const createFakeFileHandle = () => {
  let currentFile = new File([''], 'empty.txt')
  return {
    kind: 'file',
    name: 'empty.txt',
    async getFile() {
      return currentFile
    },
    async createWritable() {
      return {
        async write(value: Blob) {
          currentFile = new File([value], 'written.txt', { type: value.type })
        },
        async close() {},
      }
    },
  }
}

const createFakeDirectory = () => {
  const directories = new Map<string, any>()
  const files = new Map<string, any>()
  return {
    kind: 'directory',
    name: 'root',
    removed: [] as string[],
    async getDirectoryHandle(name: string, options?: { create?: boolean }) {
      if (!directories.has(name)) {
        if (!options?.create) throw new DOMException('Not found', 'NotFoundError')
        directories.set(name, createFakeDirectory())
      }
      return directories.get(name)
    },
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!files.has(name)) {
        if (!options?.create) throw new DOMException('Not found', 'NotFoundError')
        files.set(name, createFakeFileHandle())
      }
      return files.get(name)
    },
    async removeEntry(name: string) {
      files.delete(name)
      directories.delete(name)
      this.removed.push(name)
    },
    async queryPermission() {
      return 'granted'
    },
    async requestPermission() {
      return 'granted'
    },
  }
}

describe('attachment file system helpers', () => {
  it('copies a file into the relative attachment path', async () => {
    const root = createFakeDirectory()
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })

    await copyFileToAttachmentRoot(root as any, 'attachments/prompt-1/att-1-hello.txt', file)
    const copied = await getFileFromAttachmentRoot(root as any, 'attachments/prompt-1/att-1-hello.txt')

    expect(await copied.text()).toBe('hello')
    expect(copied.type).toBe('text/plain')
  })

  it('removes a file by relative path', async () => {
    const root = createFakeDirectory()
    const file = new File(['hello'], 'hello.txt')

    await copyFileToAttachmentRoot(root as any, 'attachments/prompt-1/att-1-hello.txt', file)
    await removeAttachmentFileFromRoot(root as any, 'attachments/prompt-1/att-1-hello.txt')

    await expect(getFileFromAttachmentRoot(root as any, 'attachments/prompt-1/att-1-hello.txt')).rejects.toThrow()
  })

  it('returns false when readwrite permission is denied', async () => {
    const root = {
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission: vi.fn().mockResolvedValue('denied'),
    }

    const { verifyReadWritePermission } = await import('@/utils/attachments/fileSystem')
    await expect(verifyReadWritePermission(root as any)).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm vitest run tests/utils/attachmentFileSystem.test.ts
```

Expected: FAIL because `@/utils/attachments/fileSystem` does not exist.

- [ ] **Step 3: Add TypeScript declarations**

Append to `types/global.d.ts` inside `declare global`:

```ts
  type FileSystemPermissionMode = 'read' | 'readwrite';

  interface FileSystemHandlePermissionDescriptor {
    mode?: FileSystemPermissionMode;
  }

  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: 'directory';
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    values?(): AsyncIterableIterator<FileSystemHandle>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string): Promise<void>;
    close(): Promise<void>;
  }

  interface Window {
    showDirectoryPicker?: (options?: { mode?: FileSystemPermissionMode }) => Promise<FileSystemDirectoryHandle>;
  }
```

- [ ] **Step 4: Add the file-system utility**

Create `utils/attachments/fileSystem.ts`:

```ts
import { getAttachmentPathSegments } from './metadata'

const DB_NAME = 'quick-prompt-attachments'
const DB_VERSION = 1
const STORE_NAME = 'handles'
const ROOT_HANDLE_KEY = 'attachmentRoot'

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

export const saveAttachmentRootHandle = async (handle: FileSystemDirectoryHandle): Promise<void> => {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(handle, ROOT_HANDLE_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export const getAttachmentRootHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const db = await openDb()
  const handle = await new Promise<FileSystemDirectoryHandle | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(ROOT_HANDLE_KEY)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  db.close()
  return handle || null
}

export const verifyReadWritePermission = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
  const descriptor = { mode: 'readwrite' as const }
  if ((await handle.queryPermission(descriptor)) === 'granted') return true
  return (await handle.requestPermission(descriptor)) === 'granted'
}

export const pickAndStoreAttachmentRoot = async (): Promise<FileSystemDirectoryHandle> => {
  if (!window.showDirectoryPicker) {
    throw new Error('File System Access API is not available in this browser')
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
  const granted = await verifyReadWritePermission(handle)
  if (!granted) {
    throw new Error('Read and write permission was not granted')
  }
  await saveAttachmentRootHandle(handle)
  return handle
}

export const getDirectoryForSegments = async (
  rootHandle: FileSystemDirectoryHandle,
  segments: string[],
  create: boolean
): Promise<FileSystemDirectoryHandle> => {
  let directory = rootHandle
  for (const segment of segments) {
    directory = await directory.getDirectoryHandle(segment, { create })
  }
  return directory
}

export const copyFileToAttachmentRoot = async (
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
  file: File
): Promise<void> => {
  const segments = getAttachmentPathSegments(relativePath)
  const fileName = segments.at(-1)
  if (!fileName) throw new Error('Attachment relative path is empty')
  const directory = await getDirectoryForSegments(rootHandle, segments.slice(0, -1), true)
  const fileHandle = await directory.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(file)
  await writable.close()
}

export const getFileFromAttachmentRoot = async (
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string
): Promise<File> => {
  const segments = getAttachmentPathSegments(relativePath)
  const fileName = segments.at(-1)
  if (!fileName) throw new Error('Attachment relative path is empty')
  const directory = await getDirectoryForSegments(rootHandle, segments.slice(0, -1), false)
  const fileHandle = await directory.getFileHandle(fileName)
  return fileHandle.getFile()
}

export const removeAttachmentFileFromRoot = async (
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string
): Promise<void> => {
  const segments = getAttachmentPathSegments(relativePath)
  const fileName = segments.at(-1)
  if (!fileName) return
  const directory = await getDirectoryForSegments(rootHandle, segments.slice(0, -1), false)
  await directory.removeEntry(fileName)
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
pnpm vitest run tests/utils/attachmentFileSystem.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add types/global.d.ts utils/attachments/fileSystem.ts tests/utils/attachmentFileSystem.test.ts
git commit -m "feat: add attachment file system access utilities"
```

---

### Task 3: Options Page Authorization Gate

**Files:**
- Create: `entrypoints/options/components/AttachmentStorageGate.tsx`
- Modify: `entrypoints/options/App.tsx`
- Modify: `public/_locales/en/messages.json`
- Modify: `public/_locales/zh/messages.json`
- Test: `tests/options/AttachmentStorageGate.test.tsx`

- [ ] **Step 1: Write the failing test**

Add `tests/options/AttachmentStorageGate.test.tsx`:

```tsx
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AttachmentStorageGate from '@/entrypoints/options/components/AttachmentStorageGate'

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentRootHandle: vi.fn(),
  pickAndStoreAttachmentRoot: vi.fn(),
  verifyReadWritePermission: vi.fn(),
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

const fs = await import('@/utils/attachments/fileSystem')

describe('AttachmentStorageGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'showDirectoryPicker', {
      value: vi.fn(),
      configurable: true,
    })
  })

  it('renders children when an existing handle has readwrite permission', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue({ name: 'Quick Prompt' } as any)
    vi.mocked(fs.verifyReadWritePermission).mockResolvedValue(true)

    render(<AttachmentStorageGate><div>Options Ready</div></AttachmentStorageGate>)

    expect(await screen.findByText('Options Ready')).toBeInTheDocument()
  })

  it('blocks options until the user chooses a directory', async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue(null)
    vi.mocked(fs.pickAndStoreAttachmentRoot).mockResolvedValue({ name: 'Quick Prompt' } as any)

    render(<AttachmentStorageGate><div>Options Ready</div></AttachmentStorageGate>)

    expect(await screen.findByText('attachmentStorageTitle')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'chooseAttachmentDirectory' }))

    await waitFor(() => expect(screen.getByText('Options Ready')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm vitest run tests/options/AttachmentStorageGate.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Add i18n keys**

Add to both locale JSON files:

```json
"attachmentStorageTitle": { "message": "Attachment Storage" },
"attachmentStorageDescription": { "message": "Choose a local folder for Quick Prompt attachments before opening the management page." },
"chooseAttachmentDirectory": { "message": "Choose Attachment Folder" },
"attachmentStoragePermissionRequired": { "message": "Read and write permission is required to use attachments." },
"attachmentStorageUnsupported": { "message": "This browser does not support File System Access API." }
```

Use Chinese translations in `public/_locales/zh/messages.json`:

```json
"attachmentStorageTitle": { "message": "附件存储" },
"attachmentStorageDescription": { "message": "进入管理页前，请为 Quick Prompt 附件选择一个本地文件夹。" },
"chooseAttachmentDirectory": { "message": "选择附件文件夹" },
"attachmentStoragePermissionRequired": { "message": "需要读写权限才能使用附件功能。" },
"attachmentStorageUnsupported": { "message": "当前浏览器不支持 File System Access API。" }
```

- [ ] **Step 4: Add the gate component**

Create `entrypoints/options/components/AttachmentStorageGate.tsx`:

```tsx
import { useEffect, useState } from 'react'
import {
  getAttachmentRootHandle,
  pickAndStoreAttachmentRoot,
  verifyReadWritePermission,
} from '@/utils/attachments/fileSystem'
import { t } from '@/utils/i18n'

interface AttachmentStorageGateProps {
  children: React.ReactNode
}

type GateStatus = 'checking' | 'ready' | 'needs-permission' | 'unsupported'

const AttachmentStorageGate = ({ children }: AttachmentStorageGateProps) => {
  const [status, setStatus] = useState<GateStatus>('checking')
  const [error, setError] = useState<string | null>(null)

  const checkPermission = async () => {
    if (!window.showDirectoryPicker) {
      setStatus('unsupported')
      return
    }

    const handle = await getAttachmentRootHandle()
    if (!handle) {
      setStatus('needs-permission')
      return
    }

    const granted = await verifyReadWritePermission(handle)
    setStatus(granted ? 'ready' : 'needs-permission')
  }

  useEffect(() => {
    checkPermission().catch((err) => {
      console.error('Attachment storage permission check failed:', err)
      setStatus('needs-permission')
    })
  }, [])

  const handleChooseDirectory = async () => {
    try {
      setError(null)
      await pickAndStoreAttachmentRoot()
      setStatus('ready')
    } catch (err) {
      console.error('Attachment directory authorization failed:', err)
      setError(t('attachmentStoragePermissionRequired'))
    }
  }

  if (status === 'ready') return <>{children}</>

  if (status === 'checking') {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">{t('loading')}</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('attachmentStorageTitle')}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {status === 'unsupported' ? t('attachmentStorageUnsupported') : t('attachmentStorageDescription')}
        </p>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleChooseDirectory}
          disabled={status === 'unsupported'}
          className="mt-5 w-full px-4 py-2 bg-blue-600 disabled:bg-gray-400 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {t('chooseAttachmentDirectory')}
        </button>
      </div>
    </div>
  )
}

export default AttachmentStorageGate
```

- [ ] **Step 5: Wrap the options app**

In `entrypoints/options/App.tsx`, import `AttachmentStorageGate` and wrap the current layout:

```tsx
import AttachmentStorageGate from "./components/AttachmentStorageGate";
```

Then render:

```tsx
return (
  <AttachmentStorageGate>
    <Router>
      {/* existing options layout */}
    </Router>
  </AttachmentStorageGate>
);
```

- [ ] **Step 6: Run the test and compile**

Run:

```bash
pnpm vitest run tests/options/AttachmentStorageGate.test.tsx
pnpm compile
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add entrypoints/options/components/AttachmentStorageGate.tsx entrypoints/options/App.tsx public/_locales/en/messages.json public/_locales/zh/messages.json tests/options/AttachmentStorageGate.test.tsx
git commit -m "feat: require attachment directory authorization"
```

---

### Task 4: Prompt Attachment File Operations

**Files:**
- Create: `utils/attachments/promptAttachmentOperations.ts`
- Test: `tests/utils/promptAttachmentOperations.test.ts`

- [ ] **Step 1: Write the failing test**

Add `tests/utils/promptAttachmentOperations.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PromptItem } from '@/utils/types'
import {
  createAttachmentFromFile,
  deletePromptAttachmentFiles,
  duplicatePromptAttachmentFiles,
} from '@/utils/attachments/promptAttachmentOperations'

vi.mock('@/utils/attachments/fileSystem', () => ({
  copyFileToAttachmentRoot: vi.fn(),
  getFileFromAttachmentRoot: vi.fn(),
  removeAttachmentFileFromRoot: vi.fn(),
}))

const fileSystem = await import('@/utils/attachments/fileSystem')

const createPrompt = (overrides: Partial<PromptItem> = {}): PromptItem => ({
  id: 'prompt-1',
  title: 'Prompt',
  content: 'Content',
  tags: [],
  enabled: true,
  categoryId: 'default',
  attachments: [],
  ...overrides,
})

describe('prompt attachment operations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('att-1')
  })

  it('copies a selected file and returns metadata', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })

    const attachment = await createAttachmentFromFile({} as any, 'prompt-1', file)

    expect(attachment).toMatchObject({
      id: 'att-1',
      name: 'hello.txt',
      type: 'text/plain',
      size: 5,
      relativePath: 'attachments/prompt-1/att-1-hello.txt',
    })
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledWith({} as any, 'attachments/prompt-1/att-1-hello.txt', file)
  })

  it('deletes every attachment file on a prompt', async () => {
    await deletePromptAttachmentFiles({} as any, createPrompt({
      attachments: [
        { id: 'a', name: 'a.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/a-a.txt', createdAt: 'now' },
        { id: 'b', name: 'b.txt', type: 'text/plain', size: 1, relativePath: 'attachments/prompt-1/b-b.txt', createdAt: 'now' },
      ],
    }))

    expect(fileSystem.removeAttachmentFileFromRoot).toHaveBeenCalledTimes(2)
  })

  it('duplicates files and rewrites metadata for a new prompt id', async () => {
    vi.mocked(fileSystem.getFileFromAttachmentRoot).mockResolvedValue(new File(['data'], 'source.txt', { type: 'text/plain' }))
    vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('copy-1')

    const attachments = await duplicatePromptAttachmentFiles({} as any, createPrompt({
      attachments: [
        { id: 'source', name: 'source.txt', type: 'text/plain', size: 4, relativePath: 'attachments/prompt-1/source-source.txt', createdAt: 'now' },
      ],
    }), 'prompt-2')

    expect(attachments[0].id).toBe('copy-1')
    expect(attachments[0].relativePath).toBe('attachments/prompt-2/copy-1-source.txt')
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledWith({} as any, 'attachments/prompt-2/copy-1-source.txt', expect.any(File))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm vitest run tests/utils/promptAttachmentOperations.test.ts
```

Expected: FAIL because `promptAttachmentOperations.ts` does not exist.

- [ ] **Step 3: Add prompt-level operations**

Create `utils/attachments/promptAttachmentOperations.ts`:

```ts
import type { PromptAttachment, PromptItem } from '@/utils/types'
import {
  copyFileToAttachmentRoot,
  getFileFromAttachmentRoot,
  removeAttachmentFileFromRoot,
} from './fileSystem'
import { buildAttachmentRelativePath } from './metadata'

export const createAttachmentFromFile = async (
  rootHandle: FileSystemDirectoryHandle,
  promptId: string,
  file: File
): Promise<PromptAttachment> => {
  const attachmentId = crypto.randomUUID()
  const relativePath = buildAttachmentRelativePath(promptId, attachmentId, file.name)
  await copyFileToAttachmentRoot(rootHandle, relativePath, file)

  return {
    id: attachmentId,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    relativePath,
    createdAt: new Date().toISOString(),
  }
}

export const deletePromptAttachmentFiles = async (
  rootHandle: FileSystemDirectoryHandle,
  prompt: Pick<PromptItem, 'attachments'>
): Promise<void> => {
  for (const attachment of prompt.attachments || []) {
    await removeAttachmentFileFromRoot(rootHandle, attachment.relativePath)
  }
}

export const duplicatePromptAttachmentFiles = async (
  rootHandle: FileSystemDirectoryHandle,
  sourcePrompt: Pick<PromptItem, 'attachments'>,
  targetPromptId: string
): Promise<PromptAttachment[]> => {
  const duplicated: PromptAttachment[] = []

  for (const attachment of sourcePrompt.attachments || []) {
    const nextId = crypto.randomUUID()
    const file = await getFileFromAttachmentRoot(rootHandle, attachment.relativePath)
    const relativePath = buildAttachmentRelativePath(targetPromptId, nextId, attachment.name)
    await copyFileToAttachmentRoot(rootHandle, relativePath, file)
    duplicated.push({
      ...attachment,
      id: nextId,
      relativePath,
      createdAt: new Date().toISOString(),
    })
  }

  return duplicated
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm vitest run tests/utils/promptAttachmentOperations.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/attachments/promptAttachmentOperations.ts tests/utils/promptAttachmentOperations.test.ts
git commit -m "feat: add prompt attachment file operations"
```

---

### Task 5: Prompt Form Add And Remove Attachments

**Files:**
- Create: `entrypoints/options/components/PromptAttachmentEditor.tsx`
- Modify: `entrypoints/options/components/PromptForm.tsx`
- Modify: `entrypoints/options/components/PromptManager.tsx`
- Modify: `public/_locales/en/messages.json`
- Modify: `public/_locales/zh/messages.json`
- Test: `tests/options/PromptAttachmentEditor.test.tsx`

- [ ] **Step 1: Write the failing component test**

Add `tests/options/PromptAttachmentEditor.test.tsx`:

```tsx
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PromptAttachment } from '@/utils/types'
import PromptAttachmentEditor from '@/entrypoints/options/components/PromptAttachmentEditor'

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentRootHandle: vi.fn().mockResolvedValue({ name: 'root' }),
  verifyReadWritePermission: vi.fn().mockResolvedValue(true),
  removeAttachmentFileFromRoot: vi.fn(),
}))

vi.mock('@/utils/attachments/promptAttachmentOperations', () => ({
  createAttachmentFromFile: vi.fn().mockResolvedValue({
    id: 'att-1',
    name: 'hello.txt',
    type: 'text/plain',
    size: 5,
    relativePath: 'attachments/prompt-1/att-1-hello.txt',
    createdAt: '2024-01-01T00:00:00.000Z',
  }),
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

const createAttachment = (overrides: Partial<PromptAttachment> = {}): PromptAttachment => ({
  id: 'att-existing',
  name: 'existing.pdf',
  type: 'application/pdf',
  size: 2048,
  relativePath: 'attachments/prompt-1/att-existing-existing.pdf',
  createdAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

describe('PromptAttachmentEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds selected files and reports the updated attachment list', async () => {
    const onChange = vi.fn()
    render(<PromptAttachmentEditor promptId="prompt-1" attachments={[]} onChange={onChange} />)

    const input = screen.getByLabelText('addAttachment')
    await userEvent.upload(input, new File(['hello'], 'hello.txt', { type: 'text/plain' }))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'hello.txt' })])
    })
  })

  it('removes an attachment and reports the updated list', async () => {
    const onChange = vi.fn()
    render(<PromptAttachmentEditor promptId="prompt-1" attachments={[createAttachment()]} onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'removeAttachment' }))

    expect(onChange).toHaveBeenCalledWith([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm vitest run tests/options/PromptAttachmentEditor.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Add i18n keys**

Add English keys:

```json
"attachmentsLabel": { "message": "Attachments" },
"attachmentsOptional": { "message": "Optional" },
"addAttachment": { "message": "Add attachment" },
"removeAttachment": { "message": "Remove attachment" },
"attachmentPermissionLost": { "message": "Attachment folder permission is missing. Reauthorize the folder and try again." },
"attachmentAddFailed": { "message": "Failed to add attachment." },
"attachmentRemoveFailed": { "message": "Failed to remove attachment." }
```

Add Chinese keys:

```json
"attachmentsLabel": { "message": "附件" },
"attachmentsOptional": { "message": "可选" },
"addAttachment": { "message": "添加附件" },
"removeAttachment": { "message": "移除附件" },
"attachmentPermissionLost": { "message": "附件目录权限已失效，请重新授权后再试。" },
"attachmentAddFailed": { "message": "添加附件失败。" },
"attachmentRemoveFailed": { "message": "移除附件失败。" }
```

- [ ] **Step 4: Add the editor component**

Create `entrypoints/options/components/PromptAttachmentEditor.tsx`:

```tsx
import { useRef, useState } from 'react'
import type { PromptAttachment } from '@/utils/types'
import {
  getAttachmentRootHandle,
  removeAttachmentFileFromRoot,
  verifyReadWritePermission,
} from '@/utils/attachments/fileSystem'
import { formatFileSize } from '@/utils/attachments/metadata'
import { createAttachmentFromFile } from '@/utils/attachments/promptAttachmentOperations'
import { t } from '@/utils/i18n'

interface PromptAttachmentEditorProps {
  promptId: string
  attachments: PromptAttachment[]
  onChange: (attachments: PromptAttachment[]) => void
}

const PromptAttachmentEditor = ({ promptId, attachments, onChange }: PromptAttachmentEditorProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const getAuthorizedRoot = async () => {
    const root = await getAttachmentRootHandle()
    if (!root || !(await verifyReadWritePermission(root))) {
      throw new Error(t('attachmentPermissionLost'))
    }
    return root
  }

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (!files.length) return

    try {
      setBusy(true)
      setError(null)
      const root = await getAuthorizedRoot()
      const created: PromptAttachment[] = []
      for (const file of files) {
        created.push(await createAttachmentFromFile(root, promptId, file))
      }
      onChange([...attachments, ...created])
    } catch (err) {
      console.error('Failed to add attachment:', err)
      setError(err instanceof Error ? err.message : t('attachmentAddFailed'))
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async (attachment: PromptAttachment) => {
    try {
      setBusy(true)
      setError(null)
      const root = await getAuthorizedRoot()
      await removeAttachmentFileFromRoot(root, attachment.relativePath)
      onChange(attachments.filter((item) => item.id !== attachment.id))
    } catch (err) {
      console.error('Failed to remove attachment:', err)
      setError(err instanceof Error ? err.message : t('attachmentRemoveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {t('attachmentsLabel')} <span className="text-gray-400 font-normal">({t('attachmentsOptional')})</span>
        </label>
        <label className="inline-flex items-center px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer">
          {t('addAttachment')}
          <input
            ref={inputRef}
            aria-label={t('addAttachment')}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
            disabled={busy}
          />
        </label>
      </div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-800">{attachment.name}</p>
                <p className="text-xs text-gray-500">{attachment.type || 'application/octet-stream'} · {formatFileSize(attachment.size)}</p>
              </div>
              <button
                type="button"
                aria-label={t('removeAttachment')}
                onClick={() => handleRemove(attachment)}
                disabled={busy}
                className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {t('removeAttachment')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PromptAttachmentEditor
```

- [ ] **Step 5: Wire the editor into `PromptForm`**

In `entrypoints/options/components/PromptForm.tsx`:

```tsx
import type { PromptAttachment, PromptItem, Category } from '@/utils/types'
import PromptAttachmentEditor from './PromptAttachmentEditor'
```

Add state:

```tsx
const [attachments, setAttachments] = useState<PromptAttachment[]>([])
```

When initializing from `initialData`, set:

```tsx
setAttachments(initialData.attachments || [])
```

When initializing an empty form:

```tsx
setAttachments([])
```

Include in `promptData`:

```tsx
attachments,
```

Render the editor after notes and before prompt source URL:

```tsx
<PromptAttachmentEditor
  promptId={initialData?.id || ''}
  attachments={attachments}
  onChange={setAttachments}
/>
```

- [ ] **Step 6: Preallocate new prompt IDs in `PromptManager`**

In `entrypoints/options/components/PromptManager.tsx`, add:

```ts
const [draftPromptId, setDraftPromptId] = useState<string>(() => crypto.randomUUID());
```

In `openAddModal`:

```ts
setDraftPromptId(crypto.randomUUID());
setEditingPrompt(null);
setIsModalOpen(true);
```

Change `addPrompt` to use an existing submitted ID when present:

```ts
const addPrompt = async (prompt: Omit<PromptItem, "id"> | PromptItem) => {
  const newPrompt: PromptItem = {
    ...prompt,
    id: "id" in prompt && prompt.id ? prompt.id : crypto.randomUUID(),
    enabled: prompt.enabled !== undefined ? prompt.enabled : true,
    lastModified: prompt.lastModified || new Date().toISOString(),
  };
  await savePrompts([newPrompt, ...prompts]);
};
```

Change `handlePromptSubmit` so a new draft ID is added, not treated as an update:

```ts
if ("id" in prompt && prompt?.id && prompts.some((item) => item.id === prompt.id)) {
  await updatePrompt(prompt as PromptItem);
} else {
  await addPrompt(prompt);
}
```

For new prompt `initialData`, pass `id: draftPromptId`.

- [ ] **Step 7: Run tests and compile**

Run:

```bash
pnpm vitest run tests/options/PromptAttachmentEditor.test.tsx
pnpm compile
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add entrypoints/options/components/PromptAttachmentEditor.tsx entrypoints/options/components/PromptForm.tsx entrypoints/options/components/PromptManager.tsx public/_locales/en/messages.json public/_locales/zh/messages.json tests/options/PromptAttachmentEditor.test.tsx
git commit -m "feat: add attachments to prompt form"
```

---

### Task 6: Delete And Duplicate Prompt Attachment Files

**Files:**
- Modify: `entrypoints/options/components/PromptManager.tsx`
- Test: `tests/options/PromptManagerAttachments.test.tsx`

- [ ] **Step 1: Write the focused failing test**

Add `tests/options/PromptManagerAttachments.test.tsx` to exercise exported helpers from `PromptManager`. The production step below adds these exact helpers at module scope:

```ts
export const buildPromptDuplicate = async (
  root: FileSystemDirectoryHandle,
  prompt: PromptItem,
  copyLabel: string
): Promise<PromptItem>

export const deletePromptWithAttachments = async (
  root: FileSystemDirectoryHandle,
  prompts: PromptItem[],
  id: string
): Promise<PromptItem[]>
```

Test content:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { PromptItem } from '@/utils/types'
import {
  buildPromptDuplicate,
  deletePromptWithAttachments,
} from '@/entrypoints/options/components/PromptManager'

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentRootHandle: vi.fn().mockResolvedValue({ name: 'root' }),
  verifyReadWritePermission: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/utils/attachments/promptAttachmentOperations', () => ({
  deletePromptAttachmentFiles: vi.fn().mockResolvedValue(undefined),
  duplicatePromptAttachmentFiles: vi.fn().mockResolvedValue([
    { id: 'copy-att', name: 'a.txt', type: 'text/plain', size: 1, relativePath: 'attachments/new/copy-att-a.txt', createdAt: 'now' },
  ]),
}))

const ops = await import('@/utils/attachments/promptAttachmentOperations')

const prompt: PromptItem = {
  id: 'old',
  title: 'Prompt',
  content: 'Content',
  tags: [],
  enabled: true,
  categoryId: 'default',
  attachments: [{ id: 'att', name: 'a.txt', type: 'text/plain', size: 1, relativePath: 'attachments/old/att-a.txt', createdAt: 'now' }],
}

describe('PromptManager attachment lifecycle helpers', () => {
  it('deletes files before removing a prompt from the list', async () => {
    const next = await deletePromptWithAttachments({} as any, [prompt], 'old')

    expect(ops.deletePromptAttachmentFiles).toHaveBeenCalledWith({} as any, prompt)
    expect(next).toEqual([])
  })

  it('duplicates attachment files for duplicated prompts', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('new')

    const duplicate = await buildPromptDuplicate({} as any, prompt, 'Copy')

    expect(duplicate.id).toBe('new')
    expect(duplicate.title).toBe('Prompt (Copy)')
    expect(duplicate.attachments).toHaveLength(1)
    expect(ops.duplicatePromptAttachmentFiles).toHaveBeenCalledWith({} as any, prompt, 'new')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm vitest run tests/options/PromptManagerAttachments.test.tsx
```

Expected: FAIL because the exported helpers do not exist.

- [ ] **Step 3: Add lifecycle helpers and use them**

In `entrypoints/options/components/PromptManager.tsx`, add imports:

```ts
import { getAttachmentRootHandle, verifyReadWritePermission } from "@/utils/attachments/fileSystem";
import { deletePromptAttachmentFiles, duplicatePromptAttachmentFiles } from "@/utils/attachments/promptAttachmentOperations";
```

Add helpers:

```ts
const getAuthorizedAttachmentRoot = async (): Promise<FileSystemDirectoryHandle> => {
  const root = await getAttachmentRootHandle();
  if (!root || !(await verifyReadWritePermission(root))) {
    throw new Error(t('attachmentPermissionLost'));
  }
  return root;
};

export const deletePromptWithAttachments = async (
  root: FileSystemDirectoryHandle,
  prompts: PromptItem[],
  id: string
): Promise<PromptItem[]> => {
  const prompt = prompts.find((item) => item.id === id);
  if (!prompt) return prompts;
  await deletePromptAttachmentFiles(root, prompt);
  return prompts.filter((item) => item.id !== id);
};

export const buildPromptDuplicate = async (
  root: FileSystemDirectoryHandle,
  prompt: PromptItem,
  copyLabel: string
): Promise<PromptItem> => {
  const id = crypto.randomUUID();
  return {
    ...prompt,
    id,
    title: `${prompt.title} (${copyLabel})`,
    lastModified: new Date().toISOString(),
    pinned: false,
    attachments: await duplicatePromptAttachmentFiles(root, prompt, id),
  };
};
```

Update confirmed delete:

```ts
const root = await getAuthorizedAttachmentRoot();
const newPrompts = await deletePromptWithAttachments(root, prompts, promptToDelete);
await savePrompts(newPrompts);
```

Update duplicate:

```ts
const root = await getAuthorizedAttachmentRoot();
const newPrompt = await buildPromptDuplicate(root, prompt, t('copyLabel'));
await savePrompts([newPrompt, ...prompts]);
```

- [ ] **Step 4: Run the test and compile**

Run:

```bash
pnpm vitest run tests/options/PromptManagerAttachments.test.tsx
pnpm compile
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add entrypoints/options/components/PromptManager.tsx tests/options/PromptManagerAttachments.test.tsx
git commit -m "feat: manage attachment files with prompt lifecycle"
```

---

### Task 7: Attachment Display In Options And Prompt Selector

**Files:**
- Create: `entrypoints/options/components/PromptAttachmentPreview.tsx`
- Modify: `entrypoints/options/components/SortablePromptCard.tsx`
- Create: `entrypoints/content/components/PromptAttachmentPreview.tsx`
- Modify: `entrypoints/content/components/PromptSelector.tsx`
- Modify: `entrypoints/content/utils/styles.ts`
- Modify: `utils/browser/messageHandler.ts`
- Test: `tests/options/PromptAttachmentPreview.test.tsx`
- Test: `tests/utils/attachmentPreviewMessage.test.ts`

- [ ] **Step 1: Write the options preview failing test**

Add `tests/options/PromptAttachmentPreview.test.tsx`:

```tsx
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PromptAttachmentPreview from '@/entrypoints/options/components/PromptAttachmentPreview'

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentRootHandle: vi.fn().mockResolvedValue({ name: 'root' }),
  getFileFromAttachmentRoot: vi.fn().mockResolvedValue(new File(['image'], 'image.png', { type: 'image/png' })),
  verifyReadWritePermission: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

describe('PromptAttachmentPreview', () => {
  it('renders image attachments as images', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    render(<PromptAttachmentPreview attachments={[{
      id: 'img',
      name: 'image.png',
      type: 'image/png',
      size: 5,
      relativePath: 'attachments/prompt/img-image.png',
      createdAt: 'now',
    }]} />)

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled())
    expect(screen.getByAltText('image.png')).toHaveAttribute('src', 'blob:preview')
  })

  it('renders non-image attachments as file metadata', () => {
    render(<PromptAttachmentPreview attachments={[{
      id: 'pdf',
      name: 'doc.pdf',
      type: 'application/pdf',
      size: 2048,
      relativePath: 'attachments/prompt/pdf-doc.pdf',
      createdAt: 'now',
    }]} />)

    expect(screen.getByText('doc.pdf')).toBeInTheDocument()
    expect(screen.getByText(/2 KB/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the options preview test to verify it fails**

Run:

```bash
pnpm vitest run tests/options/PromptAttachmentPreview.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Add the options preview component**

Create `entrypoints/options/components/PromptAttachmentPreview.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { PromptAttachment } from '@/utils/types'
import {
  getAttachmentRootHandle,
  getFileFromAttachmentRoot,
  verifyReadWritePermission,
} from '@/utils/attachments/fileSystem'
import { formatFileSize, isImageAttachment } from '@/utils/attachments/metadata'
import { t } from '@/utils/i18n'

interface PromptAttachmentPreviewProps {
  attachments?: PromptAttachment[]
}

const AttachmentImage = ({ attachment }: { attachment: PromptAttachment }) => {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false

    const load = async () => {
      try {
        const root = await getAttachmentRootHandle()
        if (!root || !(await verifyReadWritePermission(root))) throw new Error('permission')
        const file = await getFileFromAttachmentRoot(root, attachment.relativePath)
        objectUrl = URL.createObjectURL(file)
        if (!cancelled) setUrl(objectUrl)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    load()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.relativePath])

  if (url && !error) {
    return <img src={url} alt={attachment.name} className="w-20 h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-600" />
  }

  return (
    <div className="text-xs text-gray-500 dark:text-gray-400">
      <div className="font-medium truncate">{attachment.name}</div>
      <div>{formatFileSize(attachment.size)} · {t('attachmentPermissionLost')}</div>
    </div>
  )
}

const PromptAttachmentPreview = ({ attachments = [] }: PromptAttachmentPreviewProps) => {
  if (!attachments.length) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-2">
          {isImageAttachment(attachment) ? (
            <AttachmentImage attachment={attachment} />
          ) : (
            <div className="max-w-40 text-xs text-gray-600 dark:text-gray-300">
              <div className="truncate font-medium">{attachment.name}</div>
              <div className="text-gray-500 dark:text-gray-400">{formatFileSize(attachment.size)}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default PromptAttachmentPreview
```

- [ ] **Step 4: Render attachments in `SortablePromptCard`**

Import and render below content preview and before notes:

```tsx
import PromptAttachmentPreview from './PromptAttachmentPreview'
```

```tsx
<PromptAttachmentPreview attachments={prompt.attachments} />
```

In compact layout, render a small count next to content:

```tsx
{(prompt.attachments?.length || 0) > 0 && (
  <span className="text-xs text-gray-400 flex-shrink-0">{prompt.attachments!.length} {t('attachmentsLabel')}</span>
)}
```

- [ ] **Step 5: Write the content preview message failing test**

Add `tests/utils/attachmentPreviewMessage.test.ts` for a small helper exported from `utils/browser/messageHandler.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { buildAttachmentPreviewResponse } from '@/utils/browser/messageHandler'

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentRootHandle: vi.fn().mockResolvedValue({ name: 'root' }),
  getFileFromAttachmentRoot: vi.fn().mockResolvedValue(new File(['abc'], 'image.png', { type: 'image/png' })),
  verifyReadWritePermission: vi.fn().mockResolvedValue(true),
}))

describe('buildAttachmentPreviewResponse', () => {
  it('returns array buffer data for image attachments', async () => {
    const response = await buildAttachmentPreviewResponse({
      id: 'img',
      name: 'image.png',
      type: 'image/png',
      size: 3,
      relativePath: 'attachments/prompt/img-image.png',
      createdAt: 'now',
    })

    expect(response.success).toBe(true)
    expect(response.contentType).toBe('image/png')
    expect(response.buffer).toBeInstanceOf(ArrayBuffer)
  })
})
```

- [ ] **Step 6: Implement the content preview message helper**

In `utils/browser/messageHandler.ts`, add:

```ts
import type { PromptAttachment } from "@/utils/types"
import { getAttachmentRootHandle, getFileFromAttachmentRoot, verifyReadWritePermission } from "@/utils/attachments/fileSystem"
```

Export helper:

```ts
export const buildAttachmentPreviewResponse = async (attachment: PromptAttachment) => {
  const root = await getAttachmentRootHandle()
  if (!root || !(await verifyReadWritePermission(root))) {
    return { success: false, error: 'permission' }
  }
  const file = await getFileFromAttachmentRoot(root, attachment.relativePath)
  return {
    success: true,
    contentType: file.type || attachment.type || 'application/octet-stream',
    buffer: await file.arrayBuffer(),
  }
}
```

Add handler before Notion messages:

```ts
if (message.action === 'getAttachmentPreview' && message.attachment) {
  const response = await buildAttachmentPreviewResponse(message.attachment)
  return response
}
```

- [ ] **Step 7: Add content selector preview component and styles**

Create `entrypoints/content/components/PromptAttachmentPreview.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { browser } from '#imports'
import type { PromptAttachment } from '@/utils/types'
import { formatFileSize, isImageAttachment } from '@/utils/attachments/metadata'

const PromptAttachmentPreview = ({ attachments = [] }: { attachments?: PromptAttachment[] }) => {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    const objectUrls: string[] = []

    const loadImages = async () => {
      const next: Record<string, string> = {}
      for (const attachment of attachments) {
        if (!isImageAttachment(attachment)) continue
        const response = await browser.runtime.sendMessage({ action: 'getAttachmentPreview', attachment })
        if (response?.success && response.buffer) {
          const url = URL.createObjectURL(new Blob([response.buffer], { type: response.contentType || attachment.type }))
          objectUrls.push(url)
          next[attachment.id] = url
        }
      }
      if (active) setImageUrls(next)
    }

    loadImages().catch((error) => console.warn('Attachment preview failed:', error))

    return () => {
      active = false
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [attachments])

  if (!attachments.length) return null

  return (
    <div className="qp-attachments">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="qp-attachment">
          {imageUrls[attachment.id] ? (
            <img src={imageUrls[attachment.id]} alt={attachment.name} className="qp-attachment-image" />
          ) : (
            <div className="qp-attachment-file">
              <span className="qp-attachment-name">{attachment.name}</span>
              <span className="qp-attachment-size">{formatFileSize(attachment.size)}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default PromptAttachmentPreview
```

In `PromptSelector.tsx`, import it and render after `.qp-prompt-meta`:

```tsx
<PromptAttachmentPreview attachments={prompt.attachments} />
```

In `entrypoints/content/utils/styles.ts`, add CSS classes:

```css
.qp-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.qp-attachment { max-width: 120px; }
.qp-attachment-image { width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid var(--qp-border-color); }
.qp-attachment-file { display: flex; gap: 4px; align-items: center; max-width: 120px; font-size: 11px; color: var(--qp-text-secondary); }
.qp-attachment-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qp-attachment-size { flex-shrink: 0; color: var(--qp-text-muted); }
```

- [ ] **Step 8: Run tests and compile**

Run:

```bash
pnpm vitest run tests/options/PromptAttachmentPreview.test.tsx tests/utils/attachmentPreviewMessage.test.ts
pnpm compile
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add entrypoints/options/components/PromptAttachmentPreview.tsx entrypoints/options/components/SortablePromptCard.tsx entrypoints/content/components/PromptAttachmentPreview.tsx entrypoints/content/components/PromptSelector.tsx entrypoints/content/utils/styles.ts utils/browser/messageHandler.ts tests/options/PromptAttachmentPreview.test.tsx tests/utils/attachmentPreviewMessage.test.ts
git commit -m "feat: display prompt attachments"
```

---

### Task 8: WebDAV Core Helpers

**Files:**
- Create: `utils/sync/webdavSync.ts`
- Test: `tests/utils/webdavSync.test.ts`

- [ ] **Step 1: Write the failing test**

Add `tests/utils/webdavSync.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { PromptItem, Category } from '@/utils/types'
import {
  deserializeFromWebDavContent,
  joinWebDavPath,
  normalizeWebDavBaseUrl,
  parseWebDavMultiStatus,
  serializeToWebDavContent,
} from '@/utils/sync/webdavSync'

const prompt: PromptItem = {
  id: 'p1',
  title: 'Prompt',
  content: 'Content',
  tags: [],
  enabled: true,
  categoryId: 'default',
  attachments: [{ id: 'a', name: 'a.txt', type: 'text/plain', size: 1, relativePath: 'attachments/p1/a-a.txt', createdAt: 'now' }],
}

const category: Category = {
  id: 'default',
  name: 'Default',
  enabled: true,
  createdAt: 'now',
  updatedAt: 'now',
}

describe('webdav sync helpers', () => {
  it('normalizes base URLs and joins paths', () => {
    expect(normalizeWebDavBaseUrl('https://dav.example.com/root/')).toBe('https://dav.example.com/root')
    expect(joinWebDavPath('/quick-prompt/', '/attachments/p1/a.txt')).toBe('quick-prompt/attachments/p1/a.txt')
  })

  it('serializes and deserializes backup content', () => {
    const content = serializeToWebDavContent([prompt], [category])
    const parsed = deserializeFromWebDavContent(content)

    expect(parsed.prompts[0].attachments?.[0].relativePath).toBe('attachments/p1/a-a.txt')
    expect(parsed.categories[0].id).toBe('default')
  })

  it('parses WebDAV multistatus hrefs', () => {
    const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/remote/attachments/p1/a.txt</d:href></d:response><d:response><d:href>/remote/attachments/p1/b.txt</d:href></d:response></d:multistatus>`

    expect(parseWebDavMultiStatus(xml)).toEqual(['/remote/attachments/p1/a.txt', '/remote/attachments/p1/b.txt'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm vitest run tests/utils/webdavSync.test.ts
```

Expected: FAIL because `webdavSync.ts` does not exist.

- [ ] **Step 3: Add WebDAV core helpers**

Create `utils/sync/webdavSync.ts`:

```ts
import type { Category, PromptItem } from '@/utils/types'

export const WEBDAV_FILENAME = 'quick-prompt-backup.json'
export const WEBDAV_CURRENT_VERSION = '1.0'

export interface WebDavConfig {
  serverUrl: string
  username: string
  password: string
  remoteDir: string
  autoSync: boolean
}

export interface WebDavExportData {
  version: string
  exportedAt: string
  prompts: PromptItem[]
  categories: Category[]
}

export const WEBDAV_STORAGE_KEYS = {
  SERVER_URL: 'webdavServerUrl',
  USERNAME: 'webdavUsername',
  PASSWORD: 'webdavPassword',
  REMOTE_DIR: 'webdavRemoteDir',
  AUTO_SYNC: 'webdavAutoSync',
  SYNC_STATUS: 'webdav_sync_status',
} as const

export const normalizeWebDavBaseUrl = (url: string): string => url.trim().replace(/\/+$/, '')

export const joinWebDavPath = (...parts: string[]): string => {
  return parts
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/')
}

export const buildWebDavUrl = (serverUrl: string, ...parts: string[]): string => {
  return `${normalizeWebDavBaseUrl(serverUrl)}/${joinWebDavPath(...parts)}`
}

export const getWebDavHeaders = (username: string, password: string, contentType?: string): HeadersInit => {
  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(`${username}:${password}`)}`,
  }
  if (contentType) headers['Content-Type'] = contentType
  return headers
}

export const serializeToWebDavContent = (prompts: PromptItem[], categories: Category[]): string => {
  const data: WebDavExportData = {
    version: WEBDAV_CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    prompts,
    categories,
  }
  return JSON.stringify(data, null, 2)
}

export const deserializeFromWebDavContent = (content: string): WebDavExportData => {
  const parsed = JSON.parse(content)
  if (!Array.isArray(parsed.prompts)) throw new Error('WebDAV backup is missing prompts')
  return {
    version: parsed.version || WEBDAV_CURRENT_VERSION,
    exportedAt: parsed.exportedAt || new Date().toISOString(),
    prompts: parsed.prompts,
    categories: Array.isArray(parsed.categories) ? parsed.categories : [],
  }
}

export const parseWebDavMultiStatus = (xml: string): string[] => {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(document.getElementsByTagNameNS('DAV:', 'href')).map((node) => node.textContent || '').filter(Boolean)
}

export const ensureWebDavDirectory = async (config: WebDavConfig, path: string): Promise<void> => {
  const segments = joinWebDavPath(config.remoteDir, path).split('/').filter(Boolean)
  let current = ''
  for (const segment of segments) {
    current = joinWebDavPath(current, segment)
    const response = await fetch(buildWebDavUrl(config.serverUrl, current), {
      method: 'MKCOL',
      headers: getWebDavHeaders(config.username, config.password),
    })
    if (!response.ok && response.status !== 405) {
      throw new Error(`Failed to create WebDAV directory ${current}: ${response.status}`)
    }
  }
}

export const putWebDavFile = async (config: WebDavConfig, relativePath: string, body: BodyInit, contentType: string): Promise<void> => {
  const response = await fetch(buildWebDavUrl(config.serverUrl, config.remoteDir, relativePath), {
    method: 'PUT',
    headers: getWebDavHeaders(config.username, config.password, contentType),
    body,
  })
  if (!response.ok) throw new Error(`Failed to upload ${relativePath}: ${response.status}`)
}

export const getWebDavTextFile = async (config: WebDavConfig, relativePath: string): Promise<string> => {
  const response = await fetch(buildWebDavUrl(config.serverUrl, config.remoteDir, relativePath), {
    method: 'GET',
    headers: getWebDavHeaders(config.username, config.password),
  })
  if (!response.ok) throw new Error(`Failed to download ${relativePath}: ${response.status}`)
  return response.text()
}

export const getWebDavBlobFile = async (config: WebDavConfig, relativePath: string): Promise<Blob> => {
  const response = await fetch(buildWebDavUrl(config.serverUrl, config.remoteDir, relativePath), {
    method: 'GET',
    headers: getWebDavHeaders(config.username, config.password),
  })
  if (!response.ok) throw new Error(`Failed to download ${relativePath}: ${response.status}`)
  return response.blob()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm vitest run tests/utils/webdavSync.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/sync/webdavSync.ts tests/utils/webdavSync.test.ts
git commit -m "feat: add webdav sync helpers"
```

---

### Task 9: WebDAV Backup Upload And Download Orchestration

**Files:**
- Create: `utils/sync/webdavBackup.ts`
- Test: `tests/utils/webdavBackup.test.ts`

- [ ] **Step 1: Write the failing orchestration test**

Add `tests/utils/webdavBackup.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category, PromptItem } from '@/utils/types'
import {
  downloadWebDavBackup,
  uploadWebDavBackup,
} from '@/utils/sync/webdavBackup'

vi.mock('@/utils/attachments/fileSystem', () => ({
  copyFileToAttachmentRoot: vi.fn(),
  getFileFromAttachmentRoot: vi.fn().mockResolvedValue(new File(['data'], 'a.txt', { type: 'text/plain' })),
}))

vi.mock('@/utils/sync/webdavSync', async () => {
  const actual = await vi.importActual<any>('@/utils/sync/webdavSync')
  return {
    ...actual,
    ensureWebDavDirectory: vi.fn().mockResolvedValue(undefined),
    putWebDavFile: vi.fn().mockResolvedValue(undefined),
    getWebDavTextFile: vi.fn().mockResolvedValue(JSON.stringify({
      version: '1.0',
      exportedAt: 'now',
      prompts: [{
        id: 'remote',
        title: 'Remote',
        content: 'Content',
        tags: [],
        enabled: true,
        categoryId: 'default',
        attachments: [{ id: 'a', name: 'a.txt', type: 'text/plain', size: 4, relativePath: 'attachments/remote/a-a.txt', createdAt: 'now' }],
      }],
      categories: [{ id: 'default', name: 'Default', enabled: true, createdAt: 'now', updatedAt: 'now' }],
    })),
    getWebDavBlobFile: vi.fn().mockResolvedValue(new Blob(['data'], { type: 'text/plain' })),
  }
})

const webdav = await import('@/utils/sync/webdavSync')
const fs = await import('@/utils/attachments/fileSystem')

const config = {
  serverUrl: 'https://dav.example.com',
  username: 'user',
  password: 'pass',
  remoteDir: 'quick-prompt',
  autoSync: false,
}

const prompt: PromptItem = {
  id: 'p1',
  title: 'Prompt',
  content: 'Content',
  tags: [],
  enabled: true,
  categoryId: 'default',
  attachments: [{ id: 'a', name: 'a.txt', type: 'text/plain', size: 4, relativePath: 'attachments/p1/a-a.txt', createdAt: 'now' }],
}

const category: Category = { id: 'default', name: 'Default', enabled: true, createdAt: 'now', updatedAt: 'now' }

describe('webdav backup orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uploads the manifest and attachment files', async () => {
    const result = await uploadWebDavBackup(config, {} as any, [prompt], [category])

    expect(result.success).toBe(true)
    expect(webdav.putWebDavFile).toHaveBeenCalledWith(config, 'quick-prompt-backup.json', expect.any(String), 'application/json')
    expect(webdav.putWebDavFile).toHaveBeenCalledWith(config, 'attachments/p1/a-a.txt', expect.any(File), 'text/plain')
  })

  it('downloads attachments before returning replace data', async () => {
    const result = await downloadWebDavBackup(config, {} as any, [], [], 'replace')

    expect(result.success).toBe(true)
    expect(result.prompts).toHaveLength(1)
    expect(fs.copyFileToAttachmentRoot).toHaveBeenCalledWith({} as any, 'attachments/remote/a-a.txt', expect.any(File))
  })

  it('append mode keeps existing prompts and downloads only new prompt attachments', async () => {
    const existing = { ...prompt, id: 'local' }
    const result = await downloadWebDavBackup(config, {} as any, [existing], [category], 'append')

    expect(result.success).toBe(true)
    expect(result.prompts?.map((item) => item.id)).toEqual(['local', 'remote'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm vitest run tests/utils/webdavBackup.test.ts
```

Expected: FAIL because `webdavBackup.ts` does not exist.

- [ ] **Step 3: Add backup orchestration**

Create `utils/sync/webdavBackup.ts`:

```ts
import type { Category, PromptAttachment, PromptItem } from '@/utils/types'
import { copyFileToAttachmentRoot, getFileFromAttachmentRoot } from '@/utils/attachments/fileSystem'
import {
  deserializeFromWebDavContent,
  ensureWebDavDirectory,
  getWebDavBlobFile,
  getWebDavTextFile,
  putWebDavFile,
  serializeToWebDavContent,
  WEBDAV_FILENAME,
  type WebDavConfig,
} from './webdavSync'

export interface WebDavBackupResult {
  success: boolean
  prompts?: PromptItem[]
  categories?: Category[]
  uploadedFiles?: number
  downloadedFiles?: number
  errors?: string[]
}

const getPromptAttachments = (prompts: PromptItem[]): PromptAttachment[] => {
  return prompts.flatMap((prompt) => prompt.attachments || [])
}

export const uploadWebDavBackup = async (
  config: WebDavConfig,
  rootHandle: FileSystemDirectoryHandle,
  prompts: PromptItem[],
  categories: Category[]
): Promise<WebDavBackupResult> => {
  const errors: string[] = []
  let uploadedFiles = 0

  try {
    await ensureWebDavDirectory(config, '')
    await ensureWebDavDirectory(config, 'attachments')
    await putWebDavFile(config, WEBDAV_FILENAME, serializeToWebDavContent(prompts, categories), 'application/json')
    uploadedFiles++

    for (const attachment of getPromptAttachments(prompts)) {
      try {
        const promptDirectory = attachment.relativePath.split('/').slice(0, -1).join('/')
        await ensureWebDavDirectory(config, promptDirectory)
        const file = await getFileFromAttachmentRoot(rootHandle, attachment.relativePath)
        await putWebDavFile(config, attachment.relativePath, file, file.type || attachment.type || 'application/octet-stream')
        uploadedFiles++
      } catch (error) {
        errors.push(`${attachment.relativePath}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { success: errors.length === 0, uploadedFiles, errors }
  } catch (error) {
    return { success: false, uploadedFiles, errors: [error instanceof Error ? error.message : String(error), ...errors] }
  }
}

const downloadAttachments = async (
  config: WebDavConfig,
  rootHandle: FileSystemDirectoryHandle,
  prompts: PromptItem[]
): Promise<number> => {
  let downloaded = 0
  for (const attachment of getPromptAttachments(prompts)) {
    const blob = await getWebDavBlobFile(config, attachment.relativePath)
    const file = new File([blob], attachment.name, { type: attachment.type || blob.type })
    await copyFileToAttachmentRoot(rootHandle, attachment.relativePath, file)
    downloaded++
  }
  return downloaded
}

export const downloadWebDavBackup = async (
  config: WebDavConfig,
  rootHandle: FileSystemDirectoryHandle,
  localPrompts: PromptItem[],
  localCategories: Category[],
  mode: 'append' | 'replace'
): Promise<WebDavBackupResult> => {
  try {
    const content = await getWebDavTextFile(config, WEBDAV_FILENAME)
    const data = deserializeFromWebDavContent(content)

    if (mode === 'replace') {
      const downloadedFiles = await downloadAttachments(config, rootHandle, data.prompts)
      return { success: true, prompts: data.prompts, categories: data.categories, downloadedFiles }
    }

    const existingPromptIds = new Set(localPrompts.map((prompt) => prompt.id))
    const newPrompts = data.prompts.filter((prompt) => !existingPromptIds.has(prompt.id))
    const existingCategoryIds = new Set(localCategories.map((category) => category.id))
    const newCategories = data.categories.filter((category) => !existingCategoryIds.has(category.id))
    const downloadedFiles = await downloadAttachments(config, rootHandle, newPrompts)

    return {
      success: true,
      prompts: [...localPrompts, ...newPrompts],
      categories: [...localCategories, ...newCategories],
      downloadedFiles,
    }
  } catch (error) {
    return { success: false, errors: [error instanceof Error ? error.message : String(error)] }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm vitest run tests/utils/webdavBackup.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/sync/webdavBackup.ts tests/utils/webdavBackup.test.ts
git commit -m "feat: add webdav backup orchestration"
```

---

### Task 10: WebDAV Integration Page And Navigation

**Files:**
- Create: `entrypoints/options/components/WebDavIntegration.tsx`
- Create: `entrypoints/options/components/WebDavIntegrationPage.tsx`
- Modify: `entrypoints/options/App.tsx`
- Modify: `entrypoints/options/components/Sidebar.tsx`
- Modify: `public/_locales/en/messages.json`
- Modify: `public/_locales/zh/messages.json`
- Test: `tests/options/WebDavIntegration.test.tsx`

- [ ] **Step 1: Write the failing UI test**

Add `tests/options/WebDavIntegration.test.tsx`:

```tsx
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WebDavIntegration from '@/entrypoints/options/components/WebDavIntegration'

const storageSyncSet = vi.fn()
const storageSyncGet = vi.fn().mockResolvedValue({})
const storageLocalGet = vi.fn().mockResolvedValue({ userPrompts: [], userCategories: [] })

vi.stubGlobal('browser', {
  storage: {
    sync: { get: storageSyncGet, set: storageSyncSet },
    local: { get: storageLocalGet, set: vi.fn() },
  },
})

vi.mock('#imports', () => ({
  browser: globalThis.browser,
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

describe('WebDavIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves webdav settings', async () => {
    render(<WebDavIntegration />)

    await userEvent.type(await screen.findByLabelText('webdavServerUrl'), 'https://dav.example.com')
    await userEvent.type(screen.getByLabelText('webdavUsername'), 'user')
    await userEvent.type(screen.getByLabelText('webdavPassword'), 'pass')
    await userEvent.type(screen.getByLabelText('webdavRemoteDir'), 'quick-prompt')
    await userEvent.click(screen.getByRole('button', { name: 'saveWebdavSettings' }))

    await waitFor(() => expect(storageSyncSet).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm vitest run tests/options/WebDavIntegration.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Add i18n keys**

Add English keys:

```json
"webdavSync": { "message": "WebDAV Sync" },
"webdavSyncDescription": { "message": "Upload and download prompts and attachments with a WebDAV server." },
"webdavServerUrl": { "message": "Server URL" },
"webdavUsername": { "message": "Username" },
"webdavPassword": { "message": "Password" },
"webdavRemoteDir": { "message": "Remote directory" },
"webdavAutoSync": { "message": "Automatic upload" },
"saveWebdavSettings": { "message": "Save WebDAV settings" },
"uploadToWebdav": { "message": "Upload to WebDAV" },
"downloadFromWebdavAppend": { "message": "Append from WebDAV" },
"downloadFromWebdavReplace": { "message": "Overwrite from WebDAV" },
"webdavSettingsSaved": { "message": "WebDAV settings saved." },
"webdavSyncSuccess": { "message": "WebDAV sync succeeded." },
"webdavSyncFailed": { "message": "WebDAV sync failed." }
```

Add Chinese keys:

```json
"webdavSync": { "message": "WebDAV 同步" },
"webdavSyncDescription": { "message": "通过 WebDAV 服务器上传和下载提示词及附件。" },
"webdavServerUrl": { "message": "服务器 URL" },
"webdavUsername": { "message": "用户名" },
"webdavPassword": { "message": "密码" },
"webdavRemoteDir": { "message": "远端目录" },
"webdavAutoSync": { "message": "自动上传" },
"saveWebdavSettings": { "message": "保存 WebDAV 设置" },
"uploadToWebdav": { "message": "上传到 WebDAV" },
"downloadFromWebdavAppend": { "message": "从 WebDAV 追加" },
"downloadFromWebdavReplace": { "message": "从 WebDAV 覆盖" },
"webdavSettingsSaved": { "message": "WebDAV 设置已保存。" },
"webdavSyncSuccess": { "message": "WebDAV 同步成功。" },
"webdavSyncFailed": { "message": "WebDAV 同步失败。" }
```

- [ ] **Step 4: Add `WebDavIntegration.tsx`**

Create `entrypoints/options/components/WebDavIntegration.tsx` with this implementation:

```tsx
import React, { useEffect, useState } from 'react'
import { browser } from '#imports'
import { BROWSER_STORAGE_KEY, CATEGORIES_STORAGE_KEY } from '@/utils/constants'
import type { Category, PromptItem } from '@/utils/types'
import { getAttachmentRootHandle, verifyReadWritePermission } from '@/utils/attachments/fileSystem'
import { downloadWebDavBackup, uploadWebDavBackup } from '@/utils/sync/webdavBackup'
import { WEBDAV_STORAGE_KEYS, type WebDavConfig } from '@/utils/sync/webdavSync'
import { t } from '@/utils/i18n'

const WebDavIntegration: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remoteDir, setRemoteDir] = useState('quick-prompt')
  const [autoSync, setAutoSync] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    browser.storage.sync.get([
      WEBDAV_STORAGE_KEYS.SERVER_URL,
      WEBDAV_STORAGE_KEYS.USERNAME,
      WEBDAV_STORAGE_KEYS.PASSWORD,
      WEBDAV_STORAGE_KEYS.REMOTE_DIR,
      WEBDAV_STORAGE_KEYS.AUTO_SYNC,
    ]).then((result) => {
      setServerUrl(result[WEBDAV_STORAGE_KEYS.SERVER_URL] || '')
      setUsername(result[WEBDAV_STORAGE_KEYS.USERNAME] || '')
      setPassword(result[WEBDAV_STORAGE_KEYS.PASSWORD] || '')
      setRemoteDir(result[WEBDAV_STORAGE_KEYS.REMOTE_DIR] || 'quick-prompt')
      setAutoSync(result[WEBDAV_STORAGE_KEYS.AUTO_SYNC] ?? false)
    })
  }, [])

  const getConfig = (): WebDavConfig => ({ serverUrl, username, password, remoteDir, autoSync })

  const saveSettings = async () => {
    await browser.storage.sync.set({
      [WEBDAV_STORAGE_KEYS.SERVER_URL]: serverUrl,
      [WEBDAV_STORAGE_KEYS.USERNAME]: username,
      [WEBDAV_STORAGE_KEYS.PASSWORD]: password,
      [WEBDAV_STORAGE_KEYS.REMOTE_DIR]: remoteDir,
      [WEBDAV_STORAGE_KEYS.AUTO_SYNC]: autoSync,
    })
    setMessage(t('webdavSettingsSaved'))
  }

  const getAuthorizedRoot = async () => {
    const root = await getAttachmentRootHandle()
    if (!root || !(await verifyReadWritePermission(root))) throw new Error(t('attachmentPermissionLost'))
    return root
  }

  const getLocalData = async () => {
    const result = await browser.storage.local.get([BROWSER_STORAGE_KEY, CATEGORIES_STORAGE_KEY])
    return {
      prompts: (result[BROWSER_STORAGE_KEY] as PromptItem[]) || [],
      categories: (result[CATEGORIES_STORAGE_KEY] as Category[]) || [],
    }
  }

  const upload = async () => {
    setIsSyncing(true)
    try {
      const root = await getAuthorizedRoot()
      const { prompts, categories } = await getLocalData()
      const result = await uploadWebDavBackup(getConfig(), root, prompts, categories)
      setMessage(result.success ? t('webdavSyncSuccess') : `${t('webdavSyncFailed')}: ${(result.errors || []).join('; ')}`)
    } finally {
      setIsSyncing(false)
    }
  }

  const download = async (mode: 'append' | 'replace') => {
    setIsSyncing(true)
    try {
      const root = await getAuthorizedRoot()
      const { prompts, categories } = await getLocalData()
      const result = await downloadWebDavBackup(getConfig(), root, prompts, categories, mode)
      if (!result.success) {
        setMessage(`${t('webdavSyncFailed')}: ${(result.errors || []).join('; ')}`)
        return
      }
      await browser.storage.local.set({
        [BROWSER_STORAGE_KEY]: result.prompts,
        [CATEGORIES_STORAGE_KEY]: result.categories,
      })
      setMessage(t('webdavSyncSuccess'))
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
        <input aria-label={t('webdavServerUrl')} value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
        <input aria-label={t('webdavUsername')} value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
        <input aria-label={t('webdavPassword')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
        <input aria-label={t('webdavRemoteDir')} value={remoteDir} onChange={(e) => setRemoteDir(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
          {t('webdavAutoSync')}
        </label>
        <button onClick={saveSettings} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{t('saveWebdavSettings')}</button>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 flex flex-wrap gap-3">
        <button disabled={isSyncing} onClick={upload} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{t('uploadToWebdav')}</button>
        <button disabled={isSyncing} onClick={() => download('append')} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg">{t('downloadFromWebdavAppend')}</button>
        <button disabled={isSyncing} onClick={() => download('replace')} className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg">{t('downloadFromWebdavReplace')}</button>
      </div>
    </div>
  )
}

export default WebDavIntegration
```

- [ ] **Step 5: Add page, route, and sidebar link**

Create `entrypoints/options/components/WebDavIntegrationPage.tsx`:

```tsx
import React from 'react'
import WebDavIntegration from './WebDavIntegration'
import { t } from '@/utils/i18n'

const WebDavIntegrationPage: React.FC = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('webdavSync')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('webdavSyncDescription')}</p>
      </div>
      <WebDavIntegration />
    </div>
  </div>
)

export default WebDavIntegrationPage
```

Add route in `App.tsx`:

```tsx
import WebDavIntegrationPage from "./components/WebDavIntegrationPage";
```

```tsx
<Route path="/integrations/webdav" element={<WebDavIntegrationPage />} />
```

Add this sidebar `NavLink` next to the Gist and Notion links:

```tsx
<NavLink
  to="/integrations/webdav"
  onClick={closeSidebar}
  className={({ isActive }) =>
    `group flex items-center ${isCollapsed && !isMobile ? 'justify-center px-2' : 'px-2.5'} py-1.5 text-xs rounded-lg transition-all duration-200 ${
      isActive
        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200"
    }`
  }
  title={isCollapsed && !isMobile ? t('webdavSync') : undefined}
>
  <svg
    className={`flex-shrink-0 w-4 h-4 ${isCollapsed && !isMobile ? '' : 'mr-2'}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h10a4 4 0 100-8h-1.26A8 8 0 103 15z" />
  </svg>
  {(!isCollapsed || isMobile) && t('webdavSync')}
</NavLink>
```

- [ ] **Step 6: Run test and compile**

Run:

```bash
pnpm vitest run tests/options/WebDavIntegration.test.tsx
pnpm compile
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add entrypoints/options/components/WebDavIntegration.tsx entrypoints/options/components/WebDavIntegrationPage.tsx entrypoints/options/App.tsx entrypoints/options/components/Sidebar.tsx public/_locales/en/messages.json public/_locales/zh/messages.json tests/options/WebDavIntegration.test.tsx
git commit -m "feat: add webdav sync settings page"
```

---

### Task 11: WebDAV Automatic Upload

**Files:**
- Modify: `utils/browser/storageManager.ts`
- Test: `tests/utils/storageManagerWebDav.test.ts`

- [ ] **Step 1: Write the failing test**

Add `tests/utils/storageManagerWebDav.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/sync/webdavBackup', () => ({
  uploadWebDavBackup: vi.fn().mockResolvedValue({ success: true, uploadedFiles: 1 }),
}))

vi.mock('@/utils/attachments/fileSystem', () => ({
  getAttachmentRootHandle: vi.fn().mockResolvedValue({ name: 'root' }),
  verifyReadWritePermission: vi.fn().mockResolvedValue(true),
}))

const upload = await import('@/utils/sync/webdavBackup')

describe('storageManager WebDAV auto sync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal('browser', {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({
            webdavAutoSync: true,
            webdavServerUrl: 'https://dav.example.com',
            webdavUsername: 'user',
            webdavPassword: 'pass',
            webdavRemoteDir: 'quick-prompt',
          }),
        },
        local: {
          get: vi.fn().mockResolvedValue({
            userPrompts: [],
            userCategories: [],
          }),
          set: vi.fn(),
        },
        onChanged: {
          addListener: vi.fn(),
        },
      },
    })
  })

  it('uploads to WebDAV after the debounce interval when auto sync is enabled', async () => {
    const { handleWebDavAutoSyncForTest } = await import('@/utils/browser/storageManager')

    handleWebDavAutoSyncForTest()
    await vi.advanceTimersByTimeAsync(3100)

    expect(upload.uploadWebDavBackup).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm vitest run tests/utils/storageManagerWebDav.test.ts
```

Expected: FAIL because `handleWebDavAutoSyncForTest` does not exist.

- [ ] **Step 3: Implement debounced WebDAV auto sync**

In `utils/browser/storageManager.ts`, import:

```ts
import { getAttachmentRootHandle, verifyReadWritePermission } from "@/utils/attachments/fileSystem"
import { uploadWebDavBackup } from "@/utils/sync/webdavBackup"
import { WEBDAV_STORAGE_KEYS, type WebDavConfig } from "@/utils/sync/webdavSync"
```

Add module timer:

```ts
let webDavSyncTimer: ReturnType<typeof setTimeout> | null = null
```

In the existing local storage changed branch, after `handleGistAutoSync()`:

```ts
handleWebDavAutoSync()
```

Add the helper:

```ts
const handleWebDavAutoSync = () => {
  if (webDavSyncTimer) clearTimeout(webDavSyncTimer)
  webDavSyncTimer = setTimeout(async () => {
    try {
      const settings = await browser.storage.sync.get([
        WEBDAV_STORAGE_KEYS.AUTO_SYNC,
        WEBDAV_STORAGE_KEYS.SERVER_URL,
        WEBDAV_STORAGE_KEYS.USERNAME,
        WEBDAV_STORAGE_KEYS.PASSWORD,
        WEBDAV_STORAGE_KEYS.REMOTE_DIR,
      ])

      if (!settings[WEBDAV_STORAGE_KEYS.AUTO_SYNC]) return

      const config: WebDavConfig = {
        serverUrl: settings[WEBDAV_STORAGE_KEYS.SERVER_URL],
        username: settings[WEBDAV_STORAGE_KEYS.USERNAME],
        password: settings[WEBDAV_STORAGE_KEYS.PASSWORD],
        remoteDir: settings[WEBDAV_STORAGE_KEYS.REMOTE_DIR] || 'quick-prompt',
        autoSync: true,
      }

      if (!config.serverUrl || !config.username || !config.password) return

      const root = await getAttachmentRootHandle()
      if (!root || !(await verifyReadWritePermission(root))) return

      const promptsResult = await browser.storage.local.get(BROWSER_STORAGE_KEY)
      const categoriesResult = await browser.storage.local.get(CATEGORIES_STORAGE_KEY)
      const prompts = (promptsResult[BROWSER_STORAGE_KEY] as PromptItem[]) || []
      const categories = (categoriesResult[CATEGORIES_STORAGE_KEY] as Category[]) || []
      const result = await uploadWebDavBackup(config, root, prompts, categories)

      await browser.storage.local.set({
        [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: {
          status: result.success ? 'success' : 'error',
          completedTime: Date.now(),
          error: result.errors?.join('\n'),
        },
      })
    } catch (error: any) {
      await browser.storage.local.set({
        [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: {
          status: 'error',
          completedTime: Date.now(),
          error: error?.message || 'WebDAV auto sync failed',
        },
      })
    }
  }, 3000)
}

export const handleWebDavAutoSyncForTest = handleWebDavAutoSync
```

- [ ] **Step 4: Run the test and compile**

Run:

```bash
pnpm vitest run tests/utils/storageManagerWebDav.test.ts
pnpm compile
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/browser/storageManager.ts tests/utils/storageManagerWebDav.test.ts
git commit -m "feat: add webdav automatic upload"
```

---

### Task 12: Import, Export, And Existing Sync Compatibility

**Files:**
- Modify: `utils/promptUtils.ts`
- Test: `tests/utils/promptUtils.test.ts`
- Test: `tests/utils/gistSync.test.ts`

- [ ] **Step 1: Add failing tests for attachment preservation**

In `tests/utils/promptUtils.test.ts`, add:

```ts
it('应该保留有效的附件元数据', () => {
  const prompt = createPrompt({
    attachments: [{
      id: 'att',
      name: 'file.txt',
      type: 'text/plain',
      size: 1,
      relativePath: 'attachments/test-id/att-file.txt',
      createdAt: '2024-01-01T00:00:00.000Z',
    }],
  })

  expect(normalizePromptItem(prompt).attachments).toHaveLength(1)
})

it('应该为缺少附件字段的提示词补充空附件数组', () => {
  expect(normalizePromptItem(createPrompt()).attachments).toEqual([])
})
```

In `tests/utils/gistSync.test.ts`, add:

```ts
it('应该序列化附件元数据但不内联附件内容', () => {
  const prompts = [createPrompt({
    attachments: [{
      id: 'att',
      name: 'file.txt',
      type: 'text/plain',
      size: 1,
      relativePath: 'attachments/test-id/att-file.txt',
      createdAt: '2024-01-01T00:00:00.000Z',
    }],
  })]

  const result = serializeToGistContent(prompts, [])
  const parsed = JSON.parse(result)

  expect(parsed.prompts[0].attachments[0].relativePath).toBe('attachments/test-id/att-file.txt')
  expect(result).not.toContain('data:')
})
```

- [ ] **Step 2: Run the tests to verify behavior**

Run:

```bash
pnpm vitest run tests/utils/promptUtils.test.ts tests/utils/gistSync.test.ts
```

Expected: the `normalizePromptItem(createPrompt()).attachments` assertion fails until normalization explicitly defaults missing `attachments` to an empty array.

- [ ] **Step 3: Normalize attachments**

In `utils/promptUtils.ts`, import `normalizePromptAttachments` and update `normalizePromptItem`:

```ts
const normalized = normalizePromptAttachments({
  ...prompt,
  categoryId: prompt.categoryId || DEFAULT_CATEGORY_ID,
  enabled: prompt.enabled !== undefined ? prompt.enabled : true,
  lastModified: prompt.lastModified || new Date().toISOString(),
  notes: prompt.notes || '',
})

return normalized
```

No Gist binary upload is added. Existing Gist sync naturally includes metadata in JSON and excludes bytes because bytes only live in the local attachment directory.

- [ ] **Step 4: Run the tests**

Run:

```bash
pnpm vitest run tests/utils/promptUtils.test.ts tests/utils/gistSync.test.ts
pnpm compile
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/promptUtils.ts tests/utils/promptUtils.test.ts tests/utils/gistSync.test.ts
git commit -m "feat: preserve attachment metadata in imports"
```

---

### Task 13: Final Verification

**Files:**
- Modify only the files touched by any defect found during verification.

- [ ] **Step 1: Run the full automated suite**

Run:

```bash
pnpm test:run
pnpm compile
pnpm build
```

Expected: all commands PASS.

- [ ] **Step 2: Manual Chrome verification**

Run:

```bash
pnpm dev
```

Then load `.output/chrome-mv3/` in `chrome://extensions` and verify:

- Options page first open shows attachment directory authorization before the management UI.
- Choosing a directory with persistent `readwrite` permission enters the normal management UI.
- Reopening options reuses the saved handle when Chrome still grants permission.
- Revoking permission causes metadata to remain visible and image previews to degrade with a reauthorization message.
- Creating a prompt with a text file and an image copies both files under an actual `attachments/<created prompt id>/` directory.
- Editing the prompt can add and remove attachments.
- Deleting the prompt deletes its attachment files.
- Duplicating the prompt duplicates attachment files under the new prompt ID.
- Prompt cards show image thumbnails and non-image file name/size.
- `/p` selector shows attachment previews or metadata fallback and still inserts prompt content only.
- WebDAV upload creates `quick-prompt-backup.json` and files below an actual `attachments/<created prompt id>/` directory.
- WebDAV append downloads only new prompts and their attachments.
- WebDAV overwrite restores prompts, categories, and attachments.
- WebDAV automatic upload runs after prompt changes when enabled and does not run when disabled.

- [ ] **Step 3: Commit verification fixes**

If verification required fixes, confirm `git status --short` contains only verification fixes, then stage tracked fixes:

```bash
git add -u
git commit -m "fix: stabilize prompt attachment webdav integration"
```

If no fixes were required, do not create an empty commit.

## Sources

- Chrome for Developers: File System Access persistent permissions and storing handles in IndexedDB.
- Chrome for Developers: File System Access read/write, directory handles, and permission checks.
- MDN: `FileSystemFileHandle` availability in Web Workers.
