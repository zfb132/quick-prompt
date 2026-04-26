import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category, PromptItem } from "@/utils/types";
import {
  WEBDAV_CURRENT_VERSION,
  WEBDAV_FILENAME,
  WEBDAV_STORAGE_KEYS,
  buildWebDavUrl,
  deserializeFromWebDavContent,
  ensureWebDavDirectory,
  getWebDavBlobFile,
  getWebDavHeaders,
  getWebDavTextFile,
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

const readBlobAsText = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener("load", () => resolve(String(reader.result)));
  reader.addEventListener("error", () => reject(reader.error));
  reader.readAsText(blob);
});

describe("webdav sync helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it("creates only nested directories inside the configured remote directory", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await ensureWebDavDirectory(config, "attachments/prompt-id");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://dav.example.com/root/quick-prompt/attachments", {
      method: "MKCOL",
      headers: {
        Authorization: "Basic YWxpY2U6c2VjcmV0",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://dav.example.com/root/quick-prompt/attachments/prompt-id", {
      method: "MKCOL",
      headers: {
        Authorization: "Basic YWxpY2U6c2VjcmV0",
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not create the configured remote directory itself", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await ensureWebDavDirectory(config, "");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats MKCOL 405 as an existing WebDAV directory", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 405 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureWebDavDirectory(config, "nested")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects paths that would leave the configured remote directory before sending WebDAV requests", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(putWebDavFile(config, "../outside.txt", "escape")).rejects.toThrow(
      "outside the configured WebDAV remote directory"
    );
    await expect(getWebDavTextFile(config, "attachments/%2e%2e/outside.txt")).rejects.toThrow(
      "outside the configured WebDAV remote directory"
    );
    await expect(ensureWebDavDirectory(config, "attachments/../outside")).rejects.toThrow(
      "outside the configured WebDAV remote directory"
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads text files with WebDAV headers", async () => {
    const fetchMock = vi.fn(async () => new Response("backup content", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getWebDavTextFile(config, WEBDAV_FILENAME)).resolves.toBe("backup content");
    expect(fetchMock).toHaveBeenCalledWith("https://dav.example.com/root/quick-prompt/quick-prompt-backup.json", {
      method: "GET",
      headers: {
        Authorization: "Basic YWxpY2U6c2VjcmV0",
      },
    });
  });

  it("downloads blob files with WebDAV headers", async () => {
    const fetchMock = vi.fn(async () => new Response("file content", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getWebDavBlobFile(config, "attachments/file.txt");

    expect(await readBlobAsText(result)).toBe("file content");
    expect(result.type).toBe("text/plain");
    expect(fetchMock).toHaveBeenCalledWith("https://dav.example.com/root/quick-prompt/attachments/file.txt", {
      method: "GET",
      headers: {
        Authorization: "Basic YWxpY2U6c2VjcmV0",
      },
    });
  });

  it("includes status code and body snippet for non-ok PUT responses", async () => {
    const fetchMock = vi.fn(async () => new Response("quota exceeded while uploading", {
      status: 507,
      statusText: "Insufficient Storage",
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      putWebDavFile(config, WEBDAV_FILENAME, "{}", "application/json")
    ).rejects.toThrow("WebDAV PUT failed: HTTP 507 Insufficient Storage - quota exceeded while uploading");
  });

  it("includes status code for non-ok GET responses", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getWebDavTextFile(config, WEBDAV_FILENAME)).rejects.toThrow("WebDAV GET failed: HTTP 404");
  });

  it("includes status code for non-ok MKCOL responses", async () => {
    const fetchMock = vi.fn(async () => (
      new Response("parent does not exist", { status: 409, statusText: "Conflict" })
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureWebDavDirectory(config, "nested")).rejects.toThrow(
      "WebDAV MKCOL failed: HTTP 409 Conflict - parent does not exist"
    );
  });
});
