# Prompt Attachments And WebDAV Sync Design

## Goal

Add optional attachments to prompts, store attachment files outside extension storage through a user-authorized File System Access API directory, show image attachments inline, show non-image attachments as file metadata, and add WebDAV upload/download with optional automatic upload.

## Scope

This feature applies to the Chrome options/management page, prompt cards, the `/p` prompt selector, local import/export validation, and sync integrations. The options/management page must require a persistent attachment directory authorization before showing the existing prompt management UI. The popup window and content script trigger do not block on initial authorization.

The feature supports all file types and does not impose an application-level file size limit. Browser, disk, WebDAV server, and network limits may still apply.

## Data Model

`PromptItem` gains an optional `attachments` field:

```ts
export interface PromptAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  relativePath: string;
  createdAt: string;
}

export interface PromptItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  enabled: boolean;
  categoryId: string;
  pinned?: boolean;
  notionPageId?: string;
  notes?: string;
  lastModified?: string;
  sortOrder?: number;
  thumbnailUrl?: string;
  attachments?: PromptAttachment[];
}
```

Prompt JSON stores only attachment metadata and relative paths. Attachment binary content is never stored in `browser.storage.local`, `browser.storage.sync`, Gist JSON, or Notion fields.

Local attachment paths use this structure under the user-selected root directory:

```text
attachments/
  <promptId>/
    <attachmentId>-<safe-file-name>
```

The `safe-file-name` segment is sanitized to remove path separators and reserved characters. The saved `relativePath` is the source of truth for resolving the file from the root directory.

## Persistent Directory Authorization

The options/management page starts with an attachment storage gate:

1. Load the saved `FileSystemDirectoryHandle` from IndexedDB.
2. Check `queryPermission({ mode: "readwrite" })`.
3. If permission is not granted, call `requestPermission({ mode: "readwrite" })` from a user gesture.
4. If there is no saved handle, show an authorization screen with a directory picker.
5. Only after `readwrite` permission is granted does the app render the existing options UI.

Directory handles are stored in IndexedDB because File System Access API handles are structured-cloneable but are not suitable for normal JSON storage. A small utility owns handle persistence, permission checks, directory traversal, file writes, file reads, deletion, and object URL lifecycle helpers.

If permission is lost later, prompt metadata remains visible. Image previews are disabled, non-image attachments still show file name and size, and the UI asks the user to reselect the attachment root directory and grant persistent `readwrite` permission again.

## Prompt Attachment Editing

The prompt form gets an attachment section:

- `Add attachment` accepts any file type and allows multiple files.
- Adding a file copies it into the authorized root directory at `attachments/<promptId>/`.
- For new prompts, the app allocates the prompt ID before copying files so attachment paths can use the final prompt ID.
- Editing a prompt allows adding and removing attachments.
- Removing an attachment deletes the corresponding file from the attachment root when permission is available.
- Deleting a prompt deletes all attachment files listed in that prompt and removes the prompt directory if it becomes empty.
- Duplicating a prompt duplicates attachment files into the duplicate prompt directory and rewrites attachment IDs and paths.

Attachment file operations update the prompt `lastModified` timestamp. If a file operation fails, the prompt save should fail with a visible error instead of creating metadata that points to a file that was not copied.

## Attachment Display

Prompt cards and the `/p` prompt selector show attachments without changing prompt copy/insert behavior.

Image attachments are detected by MIME type starting with `image/`. If the authorized file can be read, the UI creates a temporary object URL and renders a thumbnail. Object URLs are revoked when the component unmounts or the attachment changes.

Non-image attachments render file name and formatted size. If the file is missing or permission is unavailable, the UI still renders file name and size from metadata plus a missing-permission or missing-file state.

Clicking a prompt still copies or inserts the prompt content only. Attachments are displayed as context and synced as files; they are not inserted into target pages by the `/p` selector.

## WebDAV Sync

WebDAV is a first-class sync integration alongside Gist and Notion. It gets a dedicated `/integrations/webdav` options page, a route in the options app, and a sidebar link in the existing integrations area.

Configuration fields:

- Server URL
- Username
- Password
- Remote directory
- Automatic upload enabled

Manual actions:

- Upload local data and attachments to WebDAV
- Download from WebDAV and append to local data
- Download from WebDAV and overwrite local data

Remote layout:

```text
<remoteDir>/
  quick-prompt-backup.json
  attachments/
    <promptId>/
      <attachmentId>-<safe-file-name>
```

`quick-prompt-backup.json` contains version, export timestamp, prompts, and categories. Prompt attachment metadata is included in each prompt. Attachment binaries are uploaded as separate WebDAV files at their relative paths.

Automatic WebDAV upload listens for local prompt/category changes and attachment mutations. It uses debounce behavior similar to Gist auto-sync. When disabled, WebDAV only uploads through the manual button.

## Download And Merge Behavior

Download requires a valid local attachment root directory with `readwrite` permission before changing local data. If permission is missing, the user must reauthorize first.

Overwrite mode:

1. Fetch and validate `quick-prompt-backup.json`.
2. Download every remote attachment referenced by the backup into the local attachment root.
3. Replace local prompts and categories.
4. Leave unrelated local attachment files alone unless they belong to prompts being overwritten and are safe to delete by metadata.

Append mode:

1. Fetch and validate `quick-prompt-backup.json`.
2. Add prompts whose IDs are not present locally.
3. Add categories whose IDs are not present locally.
4. Download attachments only for newly added prompts.
5. Leave existing local prompts and their attachments unchanged.

If any required attachment download fails, the download action fails and does not replace or append prompt data. This avoids creating metadata that points to missing files.

## Error Handling

Directory authorization failures show a focused reauthorization prompt and keep existing prompt metadata intact.

Local file copy/delete failures are surfaced in the form or delete flow. The app does not silently drop files or create broken attachment metadata.

WebDAV server, authentication, and network failures show clear errors and do not mutate local prompt data. Single-file upload or download failures mark the sync as failed and include the failed remote path in the message.

Automatic WebDAV sync does not open blocking dialogs. It records the latest status in extension storage and the WebDAV integration page shows that status when opened. Manual sync actions show success or failure messages in the page.

## Testing

Unit tests cover attachment metadata normalization, file-name sanitization, relative path generation, WebDAV path joining, WebDAV XML parsing, and backup serialization/deserialization.

Component tests cover the authorization gate, prompt form attachment add/remove states, image attachment preview fallback, and non-image metadata display.

Manual verification covers:

- First options page open requires directory authorization.
- Reopening the options page reuses saved persistent permission when the browser grants it.
- Permission loss shows metadata and asks for reauthorization.
- Adding, editing, deleting, and duplicating prompts manages attachment files correctly.
- WebDAV manual upload creates the expected remote layout.
- WebDAV append and overwrite restore prompt data and attachment files.
- Automatic WebDAV upload runs after local changes when enabled and does nothing when disabled.
