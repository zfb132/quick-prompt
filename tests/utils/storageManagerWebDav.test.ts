import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BROWSER_STORAGE_KEY, CATEGORIES_STORAGE_KEY } from "@/utils/constants";
import { WEBDAV_STORAGE_KEYS } from "@/utils/sync/webdavSync";
import type { Category, PromptItem } from "@/utils/types";

vi.mock("@/utils/attachments/fileSystem", () => ({
  getAttachmentRootHandle: vi.fn(),
  verifyReadWritePermission: vi.fn(),
}));

vi.mock("@/utils/sync/webdavBackup", () => ({
  uploadWebDavBackup: vi.fn(),
}));

vi.mock("@/utils/sync/notionSync", () => ({
  syncLocalDataToNotion: vi.fn(),
}));

vi.mock("@/utils/sync/giteeGistSync", () => ({
  updateGiteeGist: vi.fn(),
  createGiteeGist: vi.fn(),
  findQuickPromptGist: vi.fn(),
}));

vi.mock("@/utils/sync/githubGistSync", () => ({
  updateGitHubGist: vi.fn(),
  createGitHubGist: vi.fn(),
  findQuickPromptGist: vi.fn(),
}));

const fileSystem = await import("@/utils/attachments/fileSystem");
const webdavBackup = await import("@/utils/sync/webdavBackup");

const prompt: PromptItem = {
  id: "prompt-1",
  title: "Prompt 1",
  content: "Content",
  tags: [],
  enabled: true,
  categoryId: "cat-1",
};

const category: Category = {
  id: "cat-1",
  name: "Category 1",
  enabled: true,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const rootHandle = { name: "Quick Prompt" } as FileSystemDirectoryHandle;

const configSettings = {
  [WEBDAV_STORAGE_KEYS.AUTO_SYNC]: true,
  [WEBDAV_STORAGE_KEYS.SERVER_URL]: "https://dav.example.com",
  [WEBDAV_STORAGE_KEYS.USERNAME]: "alice",
  [WEBDAV_STORAGE_KEYS.PASSWORD]: "secret",
  [WEBDAV_STORAGE_KEYS.REMOTE_DIR]: "quick-prompt",
};

const flushPromises = async () => {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
};

describe("storageManager WebDAV auto upload", () => {
  let storageChangeListener: ((changes: Record<string, unknown>, areaName: string) => void) | undefined;
  let mockBrowser: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();

    storageChangeListener = undefined;
    mockBrowser = {
      storage: {
        onChanged: {
          addListener: vi.fn((listener) => {
            storageChangeListener = listener;
          }),
        },
        sync: {
          get: vi.fn(async (keys: string | string[]) => {
            if (Array.isArray(keys) && keys.includes(WEBDAV_STORAGE_KEYS.AUTO_SYNC)) {
              return configSettings;
            }

            return {};
          }),
          set: vi.fn(),
        },
        local: {
          get: vi.fn(async (key: string) => {
            if (key === BROWSER_STORAGE_KEY) return { [BROWSER_STORAGE_KEY]: [prompt] };
            if (key === CATEGORIES_STORAGE_KEY) return { [CATEGORIES_STORAGE_KEY]: [category] };
            return {};
          }),
          set: vi.fn(),
        },
      },
    };
    vi.stubGlobal("browser", mockBrowser);
    vi.mocked(fileSystem.getAttachmentRootHandle).mockResolvedValue(rootHandle);
    vi.mocked(fileSystem.verifyReadWritePermission).mockResolvedValue(true);
    vi.mocked(webdavBackup.uploadWebDavBackup).mockResolvedValue({
      success: true,
      uploadedFiles: ["quick-prompt-backup.json"],
      errors: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("runs WebDAV upload after debounce when enabled and config/root are valid", async () => {
    const { setupStorageChangeListeners } = await import("@/utils/browser/storageManager");
    setupStorageChangeListeners();

    storageChangeListener?.({ [BROWSER_STORAGE_KEY]: {} }, "local");
    await vi.advanceTimersByTimeAsync(2999);
    expect(webdavBackup.uploadWebDavBackup).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();

    expect(webdavBackup.uploadWebDavBackup).toHaveBeenCalledWith(
      {
        serverUrl: "https://dav.example.com",
        username: "alice",
        password: "secret",
        remoteDir: "quick-prompt",
        autoSync: true,
      },
      rootHandle,
      [prompt],
      [category]
    );
    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
      [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: expect.objectContaining({
        status: "in_progress",
        startTime: expect.any(Number),
      }),
    });
    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
      [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: expect.objectContaining({
        status: "success",
        success: true,
        completedTime: expect.any(Number),
      }),
    });
    expect(mockBrowser.storage.local.set).not.toHaveBeenCalledWith({
      [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: expect.objectContaining({
        message: expect.any(String),
      }),
    });
  });

  it("runs WebDAV upload when only categories change", async () => {
    const { setupStorageChangeListeners } = await import("@/utils/browser/storageManager");
    setupStorageChangeListeners();

    storageChangeListener?.({ [CATEGORIES_STORAGE_KEY]: {} }, "local");
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(webdavBackup.uploadWebDavBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        serverUrl: "https://dav.example.com",
        remoteDir: "quick-prompt",
      }),
      rootHandle,
      [prompt],
      [category]
    );
  });

  it("does not upload when WebDAV auto sync is disabled", async () => {
    mockBrowser.storage.sync.get.mockResolvedValueOnce({
      ...configSettings,
      [WEBDAV_STORAGE_KEYS.AUTO_SYNC]: false,
    });
    const { handleWebDavAutoSyncForTest } = await import("@/utils/browser/storageManager");

    handleWebDavAutoSyncForTest();
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(webdavBackup.uploadWebDavBackup).not.toHaveBeenCalled();
    expect(mockBrowser.storage.local.set).not.toHaveBeenCalledWith({
      [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: expect.anything(),
    });
  });

  it("does not upload when config is missing or attachment root permission is lost", async () => {
    const { handleWebDavAutoSyncForTest } = await import("@/utils/browser/storageManager");

    mockBrowser.storage.sync.get.mockResolvedValueOnce({
      ...configSettings,
      [WEBDAV_STORAGE_KEYS.PASSWORD]: "",
    });
    handleWebDavAutoSyncForTest();
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();
    expect(webdavBackup.uploadWebDavBackup).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mockBrowser.storage.sync.get.mockResolvedValueOnce(configSettings);
    vi.mocked(fileSystem.getAttachmentRootHandle).mockResolvedValueOnce(rootHandle);
    vi.mocked(fileSystem.verifyReadWritePermission).mockResolvedValueOnce(false);
    handleWebDavAutoSyncForTest();
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(webdavBackup.uploadWebDavBackup).not.toHaveBeenCalled();
  });

  it("does not upload or write status when remoteDir is invalid", async () => {
    mockBrowser.storage.sync.get.mockResolvedValueOnce({
      ...configSettings,
      [WEBDAV_STORAGE_KEYS.REMOTE_DIR]: "../quick-prompt",
    });
    const { handleWebDavAutoSyncForTest } = await import("@/utils/browser/storageManager");

    handleWebDavAutoSyncForTest();
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(webdavBackup.uploadWebDavBackup).not.toHaveBeenCalled();
    expect(mockBrowser.storage.local.set).not.toHaveBeenCalledWith({
      [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: expect.anything(),
    });
  });

  it("does not upload or write status when serverUrl protocol is invalid", async () => {
    mockBrowser.storage.sync.get.mockResolvedValueOnce({
      ...configSettings,
      [WEBDAV_STORAGE_KEYS.SERVER_URL]: "ftp://dav.example.com",
    });
    const { handleWebDavAutoSyncForTest } = await import("@/utils/browser/storageManager");

    handleWebDavAutoSyncForTest();
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(webdavBackup.uploadWebDavBackup).not.toHaveBeenCalled();
    expect(mockBrowser.storage.local.set).not.toHaveBeenCalledWith({
      [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: expect.anything(),
    });
  });

  it("writes an error status when WebDAV upload fails", async () => {
    vi.mocked(webdavBackup.uploadWebDavBackup).mockResolvedValueOnce({
      success: false,
      uploadedFiles: [],
      errors: ["HTTP 401"],
    });
    const { handleWebDavAutoSyncForTest } = await import("@/utils/browser/storageManager");

    handleWebDavAutoSyncForTest();
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
      [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: expect.objectContaining({
        status: "error",
        success: false,
        error: "HTTP 401",
        completedTime: expect.any(Number),
      }),
    });
  });

  it("does not write a hardcoded fallback error when WebDAV upload returns no error details", async () => {
    vi.mocked(webdavBackup.uploadWebDavBackup).mockResolvedValueOnce({
      success: false,
      uploadedFiles: [],
      errors: [],
    });
    const { handleWebDavAutoSyncForTest } = await import("@/utils/browser/storageManager");

    handleWebDavAutoSyncForTest();
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
      [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: expect.objectContaining({
        status: "error",
        success: false,
        completedTime: expect.any(Number),
      }),
    });
    expect(mockBrowser.storage.local.set).not.toHaveBeenCalledWith({
      [WEBDAV_STORAGE_KEYS.SYNC_STATUS]: expect.objectContaining({
        error: expect.any(String),
      }),
    });
  });

  it("queues one latest WebDAV upload while another upload is in progress", async () => {
    const updatedPrompt = { ...prompt, title: "Prompt 1 updated" };
    let storedPrompts = [prompt];
    mockBrowser.storage.local.get.mockImplementation(async (key: string) => {
      if (key === BROWSER_STORAGE_KEY) return { [BROWSER_STORAGE_KEY]: storedPrompts };
      if (key === CATEGORIES_STORAGE_KEY) return { [CATEGORIES_STORAGE_KEY]: [category] };
      return {};
    });

    let resolveFirstUpload!: (result: { success: boolean; uploadedFiles: string[]; errors: string[] }) => void;
    vi.mocked(webdavBackup.uploadWebDavBackup)
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveFirstUpload = resolve;
      }))
      .mockResolvedValueOnce({
        success: true,
        uploadedFiles: ["quick-prompt-backup.json"],
        errors: [],
      });

    const { handleWebDavAutoSyncForTest } = await import("@/utils/browser/storageManager");

    handleWebDavAutoSyncForTest();
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();
    expect(webdavBackup.uploadWebDavBackup).toHaveBeenCalledTimes(1);

    storedPrompts = [updatedPrompt];
    handleWebDavAutoSyncForTest();
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();

    expect(webdavBackup.uploadWebDavBackup).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    resolveFirstUpload({
      success: true,
      uploadedFiles: ["quick-prompt-backup.json"],
      errors: [],
    });
    await flushPromises();

    expect(webdavBackup.uploadWebDavBackup).toHaveBeenCalledTimes(2);
    expect(webdavBackup.uploadWebDavBackup).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      rootHandle,
      [updatedPrompt],
      [category]
    );
  });
});
