import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { browser } from "#imports";
import { BROWSER_STORAGE_KEY, CATEGORIES_STORAGE_KEY } from "@/utils/constants";
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

vi.mock("@/utils/attachments/fileSystem", () => ({
  getAttachmentRootHandle: vi.fn(),
  verifyReadWritePermission: vi.fn(),
}));

vi.mock("@/utils/sync/webdavBackup", () => ({
  uploadWebDavBackup: vi.fn(),
  downloadWebDavBackup: vi.fn(),
}));

const fs = await import("@/utils/attachments/fileSystem");
const webdavBackup = await import("@/utils/sync/webdavBackup");
const { default: WebDavIntegration } = await import("@/entrypoints/options/components/WebDavIntegration");

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
const mockBrowser = browser as any;

describe("WebDavIntegration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(mockBrowser.storage.sync.get).mockResolvedValue({});
    vi.mocked(mockBrowser.storage.sync.set).mockResolvedValue(undefined);
    vi.mocked(mockBrowser.storage.local.get).mockImplementation(async (key: string) => {
      if (key === BROWSER_STORAGE_KEY) return { [BROWSER_STORAGE_KEY]: [prompt] };
      if (key === CATEGORIES_STORAGE_KEY) return { [CATEGORIES_STORAGE_KEY]: [category] };
      return {};
    });
    vi.mocked(mockBrowser.storage.local.set).mockResolvedValue(undefined);
    vi.mocked(fs.getAttachmentRootHandle).mockResolvedValue(rootHandle);
    vi.mocked(fs.verifyReadWritePermission).mockResolvedValue(true);
    vi.mocked(webdavBackup.uploadWebDavBackup).mockResolvedValue({
      success: true,
      uploadedFiles: ["quick-prompt-backup.json"],
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
        [BROWSER_STORAGE_KEY]: [prompt, remotePrompt],
        [CATEGORIES_STORAGE_KEY]: [category, remoteCategory],
      });
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
});
