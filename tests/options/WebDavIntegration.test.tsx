import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { browser } from "#imports";
import { CATEGORIES_STORAGE_KEY } from "@/utils/constants";
import { PROMPT_STORAGE_INDEX_KEY, PROMPT_STORAGE_ITEM_PREFIX } from "@/utils/promptStore";
import { WEBDAV_STORAGE_KEYS } from "@/utils/sync/webdavSync";
import type { Category, PromptItem } from "@/utils/types";

vi.mock("#imports", () => ({
  browser: {
    storage: {
      sync: {
        get: vi.fn(),
        set: vi.fn(),
      },
      local: {
        get: vi.fn(),
        set: vi.fn(),
      },
    },
  },
}));

vi.mock("@/utils/i18n", () => ({ t: (key: string) => key }));

vi.mock("@/utils/sync/webdavSync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/sync/webdavSync")>();
  return {
    ...actual,
    testWebDavConnection: vi.fn(),
  };
});

vi.mock("@/utils/attachments/fileSystem", () => ({
  getAttachmentRootHandle: vi.fn(),
  pickAndStoreAttachmentRoot: vi.fn(),
  verifyReadWritePermission: vi.fn(),
}));

vi.mock("@/utils/sync/webdavBackup", () => ({
  uploadWebDavBackup: vi.fn(),
  downloadWebDavBackup: vi.fn(),
}));

const fs = await import("@/utils/attachments/fileSystem");
const webdavSync = await import("@/utils/sync/webdavSync");
const webdavBackup = await import("@/utils/sync/webdavBackup");
const { default: WebDavIntegration } = await import("@/entrypoints/options/components/WebDavIntegration");

const prompt: PromptItem = {
  id: "prompt-1",
  title: "Prompt 1",
  content: "Content",
  tags: [],
  enabled: true,
  categoryId: "cat-1",
  notes: "",
  createdAt: "2025-01-01T00:00:00.000Z",
  lastModified: "2025-01-01T00:00:00.000Z",
  attachments: [],
};

const category: Category = {
  id: "cat-1",
  name: "Category 1",
  enabled: true,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const remotePrompt: PromptItem = {
  ...prompt,
  id: "prompt-remote",
  title: "Remote Prompt",
};

const remoteCategory: Category = {
  ...category,
  id: "cat-remote",
  name: "Remote Category",
};

const rootHandle = { name: "Quick Prompt" } as FileSystemDirectoryHandle;
const restoredRootHandle = { name: "Restored Quick Prompt" } as FileSystemDirectoryHandle;
const mockBrowser = browser as any;
const promptIndex = {
  version: 2,
  ids: ["prompt-1"],
  updatedAt: "2025-01-01T00:00:00.000Z",
};
const promptItemKey = `${PROMPT_STORAGE_ITEM_PREFIX}prompt-1`;

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

describe("WebDavIntegration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(mockBrowser.storage.sync.get).mockResolvedValue({});
    vi.mocked(mockBrowser.storage.sync.set).mockResolvedValue(undefined);
    vi.mocked(mockBrowser.storage.local.get).mockImplementation(async (key: string | string[]) => {
      if (Array.isArray(key)) {
        return Object.fromEntries(key.map((item) => [
          item,
          item === promptItemKey ? prompt : undefined,
        ]));
      }

      if (key === PROMPT_STORAGE_INDEX_KEY) return { [PROMPT_STORAGE_INDEX_KEY]: promptIndex };
      if (key === promptItemKey) return { [promptItemKey]: prompt };
      if (key === CATEGORIES_STORAGE_KEY) return { [CATEGORIES_STORAGE_KEY]: [category] };
      return {};
    });
    vi.mocked(mockBrowser.storage.local.set).mockResolvedValue(undefined);
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue(rootHandle);
    vi.mocked(fs.pickAndStoreAttachmentRoot).mockResolvedValue(restoredRootHandle);
    vi.mocked(fs.verifyReadWritePermission).mockResolvedValue(true);
    vi.mocked(webdavSync.testWebDavConnection).mockResolvedValue(undefined);
    vi.mocked(webdavBackup.uploadWebDavBackup).mockResolvedValue({
      success: true,
      uploadedFiles: ["quick-prompt-backup.json"],
      deletedFiles: [],
      errors: [],
    });
    vi.mocked(webdavBackup.downloadWebDavBackup).mockResolvedValue({
      success: true,
      prompts: [prompt, remotePrompt],
      categories: [category, remoteCategory],
      downloadedFiles: [],
      errors: [],
    });
  });

  it("tests the WebDAV connection with the current settings", async () => {
    render(<WebDavIntegration />);

    await screen.findByLabelText("webdavServerUrl");
    fireEvent.change(screen.getByLabelText("webdavServerUrl"), {
      target: { value: "https://dav.example.com" },
    });
    fireEvent.change(screen.getByLabelText("webdavUsername"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("webdavPassword"), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText("webdavRemoteDirectory"), {
      target: { value: "backups" },
    });

    fireEvent.click(screen.getByRole("button", { name: "testWebdavConnection" }));

    await waitFor(() => {
      expect(webdavSync.testWebDavConnection).toHaveBeenCalledWith({
        serverUrl: "https://dav.example.com",
        username: "alice",
        password: "secret",
        remoteDir: "backups",
        autoSync: false,
      });
      expect(screen.getByText("webdavConnectionSuccess")).toBeInTheDocument();
    });
  });

  it("persists all settings and the automatic upload toggle", async () => {
    render(<WebDavIntegration />);

    await screen.findByLabelText("webdavServerUrl");
    fireEvent.change(screen.getByLabelText("webdavServerUrl"), {
      target: { value: "https://dav.example.com" },
    });
    fireEvent.change(screen.getByLabelText("webdavUsername"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("webdavPassword"), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText("webdavRemoteDirectory"), {
      target: { value: "backups" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "webdavAutoUpload" }));
    fireEvent.click(screen.getByRole("button", { name: "saveWebdavSettings" }));

    await waitFor(() => {
      expect(browser.storage.sync.set).toHaveBeenCalledWith({
        [WEBDAV_STORAGE_KEYS.SERVER_URL]: "https://dav.example.com",
        [WEBDAV_STORAGE_KEYS.USERNAME]: "alice",
        [WEBDAV_STORAGE_KEYS.PASSWORD]: "secret",
        [WEBDAV_STORAGE_KEYS.REMOTE_DIR]: "backups",
        [WEBDAV_STORAGE_KEYS.AUTO_SYNC]: true,
      });
    });
  });

  it("uploads local prompts and categories with an authorized attachment root", async () => {
    render(<WebDavIntegration />);

    await screen.findByLabelText("webdavServerUrl");
    fireEvent.change(screen.getByLabelText("webdavServerUrl"), {
      target: { value: "https://dav.example.com" },
    });
    fireEvent.change(screen.getByLabelText("webdavUsername"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("webdavPassword"), {
      target: { value: "secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "uploadWebdavBackup" }));

    await waitFor(() => {
      expect(fs.getAttachmentRootHandle).toHaveBeenCalled();
      expect(fs.verifyReadWritePermission).toHaveBeenCalledWith(rootHandle);
      expect(webdavBackup.uploadWebDavBackup).toHaveBeenCalledWith(
        {
          serverUrl: "https://dav.example.com",
          username: "alice",
          password: "secret",
          remoteDir: "quick-prompt",
          autoSync: false,
        },
        rootHandle,
        [prompt],
        [category]
      );
    });
  });

  it("writes downloaded prompts and categories only when append succeeds", async () => {
    render(<WebDavIntegration />);

    await screen.findByLabelText("webdavServerUrl");
    fireEvent.change(screen.getByLabelText("webdavServerUrl"), {
      target: { value: "https://dav.example.com" },
    });
    fireEvent.change(screen.getByLabelText("webdavUsername"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("webdavPassword"), {
      target: { value: "secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "appendWebdavBackup" }));

    await waitFor(() => {
      expect(webdavBackup.downloadWebDavBackup).toHaveBeenCalledWith(
        expect.objectContaining({ serverUrl: "https://dav.example.com" }),
        rootHandle,
        [prompt],
        [category],
        "append"
      );
      expect(browser.storage.local.set).toHaveBeenCalledWith({
        [CATEGORIES_STORAGE_KEY]: [category, remoteCategory],
      });
      expect(browser.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          "userPrompts:index": expect.objectContaining({
            ids: ["prompt-1", "prompt-remote"],
          }),
          "userPrompts:item:prompt-remote": remotePrompt,
        })
      );
    });
  });

  it("does not write local prompt or category data when download fails", async () => {
    vi.mocked(webdavBackup.downloadWebDavBackup).mockResolvedValueOnce({
      success: false,
      prompts: [remotePrompt],
      categories: [remoteCategory],
      downloadedFiles: [],
      errors: ["HTTP 401"],
    });

    render(<WebDavIntegration />);

    await screen.findByLabelText("webdavServerUrl");
    fireEvent.change(screen.getByLabelText("webdavServerUrl"), {
      target: { value: "https://dav.example.com" },
    });
    fireEvent.change(screen.getByLabelText("webdavUsername"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("webdavPassword"), {
      target: { value: "secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "replaceWebdavBackup" }));

    await waitFor(() => {
      expect(webdavBackup.downloadWebDavBackup).toHaveBeenCalledWith(
        expect.any(Object),
        rootHandle,
        [prompt],
        [category],
        "replace"
      );
    });
    expect(browser.storage.local.set).not.toHaveBeenCalled();
  });

  it("blocks manual upload and download when the server URL is invalid", async () => {
    render(<WebDavIntegration />);

    await screen.findByLabelText("webdavServerUrl");
    fireEvent.change(screen.getByLabelText("webdavServerUrl"), {
      target: { value: "ftp://dav.example.com" },
    });
    fireEvent.change(screen.getByLabelText("webdavUsername"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("webdavPassword"), {
      target: { value: "secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "uploadWebdavBackup" }));
    fireEvent.click(screen.getByRole("button", { name: "appendWebdavBackup" }));

    await waitFor(() => {
      expect(screen.getByText("webdavInvalidServerUrl")).toBeInTheDocument();
    });
    expect(webdavBackup.uploadWebDavBackup).not.toHaveBeenCalled();
    expect(webdavBackup.downloadWebDavBackup).not.toHaveBeenCalled();
  });

  it("blocks save when the remote directory uses path traversal", async () => {
    render(<WebDavIntegration />);

    await screen.findByLabelText("webdavServerUrl");
    fireEvent.change(screen.getByLabelText("webdavServerUrl"), {
      target: { value: "https://dav.example.com" },
    });
    fireEvent.change(screen.getByLabelText("webdavUsername"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("webdavPassword"), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText("webdavRemoteDirectory"), {
      target: { value: "../backup" },
    });

    fireEvent.click(screen.getByRole("button", { name: "saveWebdavSettings" }));

    await waitFor(() => {
      expect(screen.getByText("webdavInvalidRemoteDirectory")).toBeInTheDocument();
    });
    expect(browser.storage.sync.set).not.toHaveBeenCalled();
  });

  it("blocks manual upload when the remote directory is empty", async () => {
    render(<WebDavIntegration />);

    await screen.findByLabelText("webdavServerUrl");
    fireEvent.change(screen.getByLabelText("webdavServerUrl"), {
      target: { value: "https://dav.example.com" },
    });
    fireEvent.change(screen.getByLabelText("webdavUsername"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("webdavPassword"), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText("webdavRemoteDirectory"), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: "uploadWebdavBackup" }));

    await waitFor(() => {
      expect(screen.getByText("webdavInvalidRemoteDirectory")).toBeInTheDocument();
    });
    expect(webdavBackup.uploadWebDavBackup).not.toHaveBeenCalled();
  });


  it("disables the save button while settings are saving", async () => {
    const saveDeferred = createDeferred<void>();
    vi.mocked(mockBrowser.storage.sync.set).mockReturnValueOnce(saveDeferred.promise);

    render(<WebDavIntegration />);

    await screen.findByLabelText("webdavServerUrl");
    fireEvent.change(screen.getByLabelText("webdavServerUrl"), {
      target: { value: "https://dav.example.com" },
    });
    fireEvent.change(screen.getByLabelText("webdavUsername"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("webdavPassword"), {
      target: { value: "secret" },
    });

    const saveButton = screen.getByRole("button", { name: "saveWebdavSettings" });
    fireEvent.click(saveButton);

    await waitFor(() => expect(saveButton).toBeDisabled());
    saveDeferred.resolve(undefined);
    await waitFor(() => expect(saveButton).not.toBeDisabled());
  });

  it("reverts the auto-upload toggle when persistence fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(mockBrowser.storage.sync.set).mockRejectedValueOnce(new Error("quota"));
    vi.mocked(mockBrowser.storage.sync.get)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ [WEBDAV_STORAGE_KEYS.AUTO_SYNC]: false });

    render(<WebDavIntegration />);

    const toggle = await screen.findByRole("switch", { name: "webdavAutoUpload" });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute("aria-checked", "false");
      expect(screen.getByText("webdavSaveSettingsFailed: quota")).toBeInTheDocument();
    });

    consoleErrorSpy.mockRestore();
  });

  it("shows a reauthorize action after permission loss and stores a new root", async () => {
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue(undefined);

    render(<WebDavIntegration />);

    await screen.findByLabelText("webdavServerUrl");
    fireEvent.change(screen.getByLabelText("webdavServerUrl"), {
      target: { value: "https://dav.example.com" },
    });
    fireEvent.change(screen.getByLabelText("webdavUsername"), {
      target: { value: "alice" },
    });
    fireEvent.change(screen.getByLabelText("webdavPassword"), {
      target: { value: "secret" },
    });

    fireEvent.click(screen.getByRole("button", { name: "uploadWebdavBackup" }));

    const reauthorizeButton = await screen.findByRole("button", {
      name: "reauthorizeAttachmentDirectory",
    });
    fireEvent.click(reauthorizeButton);

    await waitFor(() => {
      expect(fs.pickAndStoreAttachmentRoot).toHaveBeenCalled();
      expect(screen.getByText("attachmentStorageReauthorized")).toBeInTheDocument();
    });
  });
});
