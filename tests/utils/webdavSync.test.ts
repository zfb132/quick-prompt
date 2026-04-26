import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category, PromptItem } from "@/utils/types";
import {
  WEBDAV_CURRENT_VERSION,
  WEBDAV_FILENAME,
  WEBDAV_STORAGE_KEYS,
  buildWebDavUrl,
  deserializeFromWebDavContent,
  ensureWebDavDirectory,
  getWebDavHeaders,
  joinWebDavPath,
  normalizeWebDavBaseUrl,
  parseWebDavMultiStatus,
  putWebDavFile,
  serializeToWebDavContent,
} from "@/utils/sync/webdavSync";

const createPrompt = (overrides: Partial<PromptItem> = {}): PromptItem => ({
  id: "prompt-1",
  title: "Prompt",
  content: "Content",
  tags: ["tag"],
  enabled: true,
  categoryId: "default",
  attachments: [
    {
      id: "attachment-1",
      name: "guide.pdf",
      type: "application/pdf",
      size: 2048,
      relativePath: "attachments/prompt-1/attachment-1-guide.pdf",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ],
  ...overrides,
});

const createCategory = (overrides: Partial<Category> = {}): Category => ({
  id: "default",
  name: "Default",
  enabled: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

const config = {
  serverUrl: "https://dav.example.com/root/",
  username: "alice",
  password: "secret",
  remoteDir: "/quick-prompt/",
  autoSync: true,
};

describe("webdav sync helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("exports WebDAV constants and storage keys", () => {
    expect(WEBDAV_FILENAME).toBe("quick-prompt-backup.json");
    expect(WEBDAV_CURRENT_VERSION).toBe("1.0");
    expect(WEBDAV_STORAGE_KEYS).toEqual({
      SERVER_URL: "webdavServerUrl",
      USERNAME: "webdavUsername",
      PASSWORD: "webdavPassword",
      REMOTE_DIR: "webdavRemoteDir",
      AUTO_SYNC: "webdavAutoSync",
      SYNC_STATUS: "webdav_sync_status",
    });
  });

  it("normalizes base URLs and joins WebDAV paths without duplicate slashes", () => {
    expect(normalizeWebDavBaseUrl("  https://dav.example.com/root///  ")).toBe("https://dav.example.com/root");
    expect(joinWebDavPath("/backups/", "/quick-prompt/", "backup.json")).toBe("backups/quick-prompt/backup.json");
    expect(joinWebDavPath("", "/", "backup.json")).toBe("backup.json");
    expect(buildWebDavUrl(" https://dav.example.com/root/// ", "/backups/", WEBDAV_FILENAME)).toBe(
      "https://dav.example.com/root/backups/quick-prompt-backup.json"
    );
  });

  it("serializes and deserializes prompts while preserving attachment metadata", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));

    const prompts = [createPrompt()];
    const categories = [createCategory()];

    const content = serializeToWebDavContent(prompts, categories);
    const result = deserializeFromWebDavContent(content);

    expect(result.version).toBe("1.0");
    expect(result.exportedAt).toBe("2024-01-15T12:00:00.000Z");
    expect(result.prompts[0].attachments).toEqual(prompts[0].attachments);
    expect(result.categories).toEqual(categories);
  });

  it("parses all DAV hrefs from multistatus XML", () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <d:multistatus xmlns:d="DAV:">
        <d:response><d:href>/remote.php/dav/files/alice/quick-prompt/</d:href></d:response>
        <d:response><d:href>/remote.php/dav/files/alice/quick-prompt/${WEBDAV_FILENAME}</d:href></d:response>
      </d:multistatus>`;

    expect(parseWebDavMultiStatus(xml)).toEqual([
      "/remote.php/dav/files/alice/quick-prompt/",
      `/remote.php/dav/files/alice/quick-prompt/${WEBDAV_FILENAME}`,
    ]);
  });

  it("builds basic auth headers with optional content type", () => {
    expect(getWebDavHeaders("alice", "secret", "application/json")).toEqual({
      Authorization: "Basic YWxpY2U6c2VjcmV0",
      "Content-Type": "application/json",
    });
  });

  it("uploads files to the configured remote directory with WebDAV headers", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await putWebDavFile(config, `nested/${WEBDAV_FILENAME}`, "{\"ok\":true}", "application/json");

    expect(fetchMock).toHaveBeenCalledWith("https://dav.example.com/root/quick-prompt/nested/quick-prompt-backup.json", {
      method: "PUT",
      headers: {
        Authorization: "Basic YWxpY2U6c2VjcmV0",
        "Content-Type": "application/json",
      },
      body: "{\"ok\":true}",
    });
  });

  it("treats MKCOL 405 as an existing WebDAV directory", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 405 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureWebDavDirectory(config, "nested")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("https://dav.example.com/root/quick-prompt/nested", {
      method: "MKCOL",
      headers: {
        Authorization: "Basic YWxpY2U6c2VjcmV0",
      },
    });
  });
});
