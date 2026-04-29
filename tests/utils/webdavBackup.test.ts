import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, PromptItem } from "@/utils/types";
import { WEBDAV_FILENAME, serializeToWebDavContent } from "@/utils/sync/webdavSync";
import {
  downloadWebDavBackup,
  uploadWebDavBackup,
} from "@/utils/sync/webdavBackup";

vi.mock("@/utils/attachments/fileSystem", () => ({
  copyFileToAttachmentRoot: vi.fn(),
  getFileFromAttachmentRoot: vi.fn(),
}));

const fileSystem = await import("@/utils/attachments/fileSystem");

const config = {
  serverUrl: "https://dav.example.com/root/",
  username: "alice",
  password: "secret",
  remoteDir: "/quick-prompt/",
  autoSync: true,
};

const rootHandle = { name: "attachments" } as FileSystemDirectoryHandle;

const createCategory = (overrides: Partial<Category> = {}): Category => ({
  id: "default",
  name: "Default",
  enabled: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

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
      size: 11,
      relativePath: "attachments/prompt-1/attachment-1-guide.pdf",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
  ],
  ...overrides,
});

const readBlobAsText = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.addEventListener("load", () => resolve(String(reader.result)));
  reader.addEventListener("error", () => reject(reader.error));
  reader.readAsText(blob);
});

const readBodyAsText = async (body: BodyInit | null | undefined): Promise<string> => {
  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Blob) {
    return readBlobAsText(body);
  }

  return "";
};

describe("webdav backup orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uploads attachment files before publishing the manifest with their WebDAV paths and content types", async () => {
    const prompt = createPrompt({
      attachments: [
        {
          id: "attachment-1",
          name: "guide.pdf",
          type: "application/pdf",
          size: 11,
          relativePath: "attachments/prompt-1/attachment-1-guide.pdf",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "attachment-2",
          name: "notes.txt",
          type: "text/plain",
          size: 12,
          relativePath: "attachments/prompt-1/attachment-2-notes.txt",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    const categories = [createCategory()];
    vi.mocked(fileSystem.getFileFromAttachmentRoot)
      .mockResolvedValueOnce(new File(["pdf content"], "guide.pdf", { type: "application/pdf" }))
      .mockResolvedValueOnce(new File(["note content"], "notes.txt", { type: "text/plain" }));
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadWebDavBackup(config, rootHandle, [prompt], categories);

    expect(result).toEqual({
      success: true,
      uploadedFiles: [
        "attachments/prompt-1/attachment-1-guide.pdf",
        "attachments/prompt-1/attachment-2-notes.txt",
        "prompts/prompt-1.json",
        WEBDAV_FILENAME,
      ],
      deletedFiles: [],
      errors: [],
    });
    expect(fileSystem.getFileFromAttachmentRoot).toHaveBeenCalledTimes(2);

    const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(putCalls).toHaveLength(4);
    expect(putCalls[0]).toMatchObject([
      "https://dav.example.com/root/quick-prompt/attachments/prompt-1/attachment-1-guide.pdf",
      {
        method: "PUT",
        headers: {
          Authorization: "Basic YWxpY2U6c2VjcmV0",
          "Content-Type": "application/pdf",
        },
      },
    ]);
    expect(await readBodyAsText(putCalls[0][1]?.body)).toBe("pdf content");
    expect(putCalls[1]).toMatchObject([
      "https://dav.example.com/root/quick-prompt/attachments/prompt-1/attachment-2-notes.txt",
      {
        method: "PUT",
        headers: {
          Authorization: "Basic YWxpY2U6c2VjcmV0",
          "Content-Type": "text/plain",
        },
      },
    ]);
    expect(await readBodyAsText(putCalls[1][1]?.body)).toBe("note content");
    const promptFileCall = putCalls.find(([url]) => String(url).endsWith("/prompts/prompt-1.json"));
    expect(promptFileCall).toMatchObject([
      "https://dav.example.com/root/quick-prompt/prompts/prompt-1.json",
      {
        method: "PUT",
        headers: {
          Authorization: "Basic YWxpY2U6c2VjcmV0",
          "Content-Type": "application/json",
        },
      },
    ]);
    expect(JSON.parse(await readBodyAsText(promptFileCall?.[1]?.body))).toMatchObject({
      prompt,
    });
    const manifestCall = putCalls.find(([url]) => String(url).endsWith(WEBDAV_FILENAME));
    expect(manifestCall).toMatchObject([
      "https://dav.example.com/root/quick-prompt/quick-prompt-backup.json",
      {
        method: "PUT",
        headers: {
          Authorization: "Basic YWxpY2U6c2VjcmV0",
          "Content-Type": "application/json",
        },
      },
    ]);
    expect(JSON.parse(await readBodyAsText(manifestCall?.[1]?.body))).toMatchObject({
      storageFormat: "prompt-files",
      promptFiles: [expect.objectContaining({ id: "prompt-1", path: "prompts/prompt-1.json" })],
      categories,
    });

    const mkcolUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "MKCOL")
      .map(([url]) => url);
    expect(mkcolUrls.filter((url) => url === "https://dav.example.com/root/quick-prompt/attachments/prompt-1")).toHaveLength(1);
  });

  it("stores prompts as individual WebDAV JSON files and keeps the manifest lightweight", async () => {
    const prompts = [
      createPrompt({ id: "prompt-1", title: "First prompt", lastModified: "2024-01-01T00:00:00.000Z" }),
      createPrompt({ id: "prompt-2", title: "Second prompt", attachments: [], lastModified: "2024-01-02T00:00:00.000Z" }),
    ];
    vi.mocked(fileSystem.getFileFromAttachmentRoot).mockResolvedValue(
      new File(["pdf content"], "guide.pdf", { type: "application/pdf" })
    );
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadWebDavBackup(config, rootHandle, prompts, []);

    expect(result.success).toBe(true);
    expect(result.uploadedFiles).toEqual([
      "attachments/prompt-1/attachment-1-guide.pdf",
      "prompts/prompt-1.json",
      "prompts/prompt-2.json",
      WEBDAV_FILENAME,
    ]);

    const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    const manifestCall = putCalls.find(([url]) => String(url).endsWith(WEBDAV_FILENAME));
    const firstPromptCall = putCalls.find(([url]) => String(url).endsWith("/prompts/prompt-1.json"));
    const secondPromptCall = putCalls.find(([url]) => String(url).endsWith("/prompts/prompt-2.json"));

    expect(firstPromptCall).toBeTruthy();
    expect(JSON.parse(await readBodyAsText(firstPromptCall?.[1]?.body))).toMatchObject({
      prompt: prompts[0],
    });
    expect(secondPromptCall).toBeTruthy();
    expect(JSON.parse(await readBodyAsText(secondPromptCall?.[1]?.body))).toMatchObject({
      prompt: prompts[1],
    });

    const manifest = JSON.parse(await readBodyAsText(manifestCall?.[1]?.body));
    expect(manifest.prompts).toBeUndefined();
    expect(manifest.promptFiles).toEqual([
      expect.objectContaining({ id: "prompt-1", path: "prompts/prompt-1.json" }),
      expect.objectContaining({ id: "prompt-2", path: "prompts/prompt-2.json" }),
    ]);
  });

  it("uploads only changed prompt JSON files when the remote manifest has matching checksums", async () => {
    const originalPrompts = [
      createPrompt({ id: "prompt-1", title: "First prompt", lastModified: "2024-01-01T00:00:00.000Z" }),
      createPrompt({ id: "prompt-2", title: "Second prompt", attachments: [], lastModified: "2024-01-02T00:00:00.000Z" }),
    ];
    const updatedPrompts = [
      originalPrompts[0],
      { ...originalPrompts[1], title: "Second prompt updated", lastModified: "2024-01-03T00:00:00.000Z" },
    ];
    vi.mocked(fileSystem.getFileFromAttachmentRoot).mockResolvedValue(
      new File(["pdf content"], "guide.pdf", { type: "application/pdf" })
    );

    let remoteManifest = "";
    const remotePromptFiles = new Map<string, string>();
    const firstFetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", firstFetchMock);

    await uploadWebDavBackup(config, rootHandle, originalPrompts, []);

    for (const [url, init] of firstFetchMock.mock.calls) {
      if (init?.method !== "PUT") continue;
      const body = await readBodyAsText(init.body);
      if (String(url).endsWith(WEBDAV_FILENAME)) {
        remoteManifest = body;
      }
      if (String(url).includes("/prompts/")) {
        remotePromptFiles.set(String(url), body);
      }
    }

    const secondFetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response(remoteManifest, { status: 200 });
      }
      if (init?.method === "GET" && remotePromptFiles.has(url)) {
        return new Response(remotePromptFiles.get(url), { status: 200 });
      }

      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", secondFetchMock);

    const result = await uploadWebDavBackup(config, rootHandle, updatedPrompts, []);

    expect(result.success).toBe(true);
    expect(result.uploadedFiles).toEqual([
      "prompts/prompt-2.json",
      WEBDAV_FILENAME,
    ]);
    const putUrls = secondFetchMock.mock.calls
      .filter(([, init]) => init?.method === "PUT")
      .map(([url]) => String(url));
    expect(putUrls).toEqual([
      "https://dav.example.com/root/quick-prompt/prompts/prompt-2.json",
      "https://dav.example.com/root/quick-prompt/quick-prompt-backup.json",
    ]);
  });

  it("downloads prompts from individual WebDAV JSON files in replace mode", async () => {
    const remotePrompt = createPrompt({ id: "prompt-remote", title: "Remote prompt" });
    const remoteCategories = [createCategory({ id: "remote-category" })];
    const manifest = JSON.stringify({
      version: "1.0",
      exportedAt: "2024-01-10T00:00:00.000Z",
      storageFormat: "prompt-files",
      promptFiles: [
        {
          id: "prompt-remote",
          path: "prompts/prompt-remote.json",
          checksum: "existing",
        },
      ],
      categories: remoteCategories,
    });
    const promptFile = JSON.stringify({
      version: "1.0",
      exportedAt: "2024-01-10T00:00:00.000Z",
      prompt: remotePrompt,
    });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response(manifest, { status: 200 });
      }
      if (init?.method === "GET" && url.endsWith("prompts/prompt-remote.json")) {
        return new Response(promptFile, { status: 200 });
      }

      return new Response("pdf content", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadWebDavBackup(config, rootHandle, [], [], "replace");

    expect(result.success).toBe(true);
    expect(result.prompts).toEqual([remotePrompt]);
    expect(result.categories).toEqual(remoteCategories);
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledWith(
      rootHandle,
      "attachments/prompt-1/attachment-1-guide.pdf",
      expect.any(File)
    );
  });

  it("copies all remote attachments and returns remote data in replace mode", async () => {
    const remotePrompt = createPrompt();
    const remoteCategories = [createCategory()];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response(serializeToWebDavContent([remotePrompt], remoteCategories), { status: 200 });
      }

      return new Response("pdf content", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadWebDavBackup(
      config,
      rootHandle,
      [createPrompt({ id: "local-prompt" })],
      [createCategory({ id: "local-category" })],
      "replace"
    );

    expect(result.success).toBe(true);
    expect(result.prompts).toEqual([remotePrompt]);
    expect(result.categories).toEqual(remoteCategories);
    expect(result.downloadedFiles).toEqual(["attachments/prompt-1/attachment-1-guide.pdf"]);
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledTimes(1);
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledWith(
      rootHandle,
      "attachments/prompt-1/attachment-1-guide.pdf",
      expect.any(File)
    );
    const copiedFile = vi.mocked(fileSystem.copyFileToAttachmentRoot).mock.calls[0][2];
    expect(copiedFile.name).toBe("guide.pdf");
    expect(copiedFile.type).toBe("application/pdf");
    expect(await readBlobAsText(copiedFile)).toBe("pdf content");
  });

  it("appends only new remote prompts and categories and downloads only new prompt attachments", async () => {
    const existingPrompt = createPrompt({ id: "prompt-existing", title: "Local existing" });
    const newPrompt = createPrompt({
      id: "prompt-new",
      title: "Remote new",
      attachments: [
        {
          id: "attachment-new",
          name: "new.txt",
          type: "text/plain",
          size: 8,
          relativePath: "attachments/prompt-new/attachment-new-new.txt",
          createdAt: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    const existingCategory = createCategory({ id: "cat-existing", name: "Local existing" });
    const newCategory = createCategory({ id: "cat-new", name: "Remote new" });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response(
          serializeToWebDavContent(
            [
              createPrompt({ id: "prompt-existing", title: "Remote existing" }),
              newPrompt,
            ],
            [
              createCategory({ id: "cat-existing", name: "Remote existing" }),
              newCategory,
            ]
          ),
          { status: 200 }
        );
      }

      return new Response("new file", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadWebDavBackup(
      config,
      rootHandle,
      [existingPrompt],
      [existingCategory],
      "append"
    );

    expect(result.success).toBe(true);
    expect(result.prompts).toEqual([existingPrompt, newPrompt]);
    expect(result.categories).toEqual([existingCategory, newCategory]);
    expect(result.downloadedFiles).toEqual(["attachments/prompt-new/attachment-new-new.txt"]);
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledTimes(1);
    expect(fileSystem.copyFileToAttachmentRoot).toHaveBeenCalledWith(
      rootHandle,
      "attachments/prompt-new/attachment-new-new.txt",
      expect.any(File)
    );
  });

  it("reports attachment upload failures without publishing the manifest", async () => {
    const prompt = createPrompt();
    vi.mocked(fileSystem.getFileFromAttachmentRoot).mockResolvedValue(
      new File(["pdf content"], "guide.pdf", { type: "application/pdf" })
    );
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = await readBodyAsText(init.body);
        if (body === "pdf content") {
          return new Response("quota exceeded", { status: 507, statusText: "Insufficient Storage" });
        }
      }

      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadWebDavBackup(config, rootHandle, [prompt], []);

    expect(result.success).toBe(false);
    expect(result.uploadedFiles).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("attachments/prompt-1/attachment-1-guide.pdf");
    expect(result.errors[0]).toContain("WebDAV PUT failed: HTTP 507 Insufficient Storage - quota exceeded");
    const putUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "PUT")
      .map(([url]) => url);
    expect(putUrls).not.toContain("https://dav.example.com/root/quick-prompt/quick-prompt-backup.json");
  });

  it("deletes remote attachment files that were removed locally after publishing the new manifest", async () => {
    const retainedAttachment = {
      id: "attachment-1",
      name: "guide.pdf",
      type: "application/pdf",
      size: 11,
      relativePath: "attachments/prompt-1/attachment-1-guide.pdf",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    const deletedAttachment = {
      id: "attachment-old",
      name: "old.pdf",
      type: "application/pdf",
      size: 12,
      relativePath: "attachments/prompt-1/attachment-old-old.pdf",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    const remotePrompt = createPrompt({
      attachments: [retainedAttachment, deletedAttachment],
    });
    const localPrompt = createPrompt({
      attachments: [retainedAttachment],
    });
    vi.mocked(fileSystem.getFileFromAttachmentRoot).mockResolvedValue(
      new File(["pdf content"], "guide.pdf", { type: "application/pdf" })
    );

    const events: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        events.push("read-manifest");
        return new Response(serializeToWebDavContent([remotePrompt], []), { status: 200 });
      }

      if (init?.method === "PUT" && url.endsWith(WEBDAV_FILENAME)) {
        events.push("write-manifest");
        return new Response(null, { status: 201 });
      }

      if (init?.method === "DELETE") {
        events.push("delete-old-attachment");
        return new Response(null, { status: 204 });
      }

      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadWebDavBackup(config, rootHandle, [localPrompt], []);

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toEqual(["attachments/prompt-1/attachment-old-old.pdf"]);
    expect(events).toEqual(["read-manifest", "write-manifest", "delete-old-attachment"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dav.example.com/root/quick-prompt/attachments/prompt-1/attachment-old-old.pdf",
      {
        method: "DELETE",
        headers: {
          Authorization: "Basic YWxpY2U6c2VjcmV0",
        },
      }
    );
  });

  it("deletes the remote prompt attachment directory when all attachments are removed locally", async () => {
    const remotePrompt = createPrompt();
    const localPrompt = createPrompt({ attachments: [] });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response(serializeToWebDavContent([remotePrompt], []), { status: 200 });
      }

      return new Response(null, { status: init?.method === "DELETE" ? 204 : 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadWebDavBackup(config, rootHandle, [localPrompt], []);

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toEqual([
      "attachments/prompt-1/attachment-1-guide.pdf",
      "attachments/prompt-1",
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dav.example.com/root/quick-prompt/attachments/prompt-1",
      {
        method: "DELETE",
        headers: {
          Authorization: "Basic YWxpY2U6c2VjcmV0",
        },
      }
    );
  });

  it("deletes the remote prompt attachment directory when the prompt is removed locally", async () => {
    const remotePrompt = createPrompt();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response(serializeToWebDavContent([remotePrompt], []), { status: 200 });
      }

      return new Response(null, { status: init?.method === "DELETE" ? 204 : 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadWebDavBackup(config, rootHandle, [], []);

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toEqual([
      "attachments/prompt-1/attachment-1-guide.pdf",
      "attachments/prompt-1",
    ]);
  });

  it("does not delete remote files that are not listed in the previous WebDAV manifest", async () => {
    const localPrompt = createPrompt({ attachments: [] });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response(serializeToWebDavContent([], []), { status: 200 });
      }

      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadWebDavBackup(config, rootHandle, [localPrompt], []);

    expect(result.success).toBe(true);
    expect(result.deletedFiles).toEqual([]);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });

  it("reports stale remote attachment delete failures after publishing the new manifest", async () => {
    const deletedAttachment = {
      id: "attachment-old",
      name: "old.pdf",
      type: "application/pdf",
      size: 12,
      relativePath: "attachments/prompt-1/attachment-old-old.pdf",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    const remotePrompt = createPrompt({
      attachments: [deletedAttachment],
    });
    const localPrompt = createPrompt({ attachments: [] });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response(serializeToWebDavContent([remotePrompt], []), { status: 200 });
      }

      if (init?.method === "DELETE") {
        return new Response("locked", { status: 423, statusText: "Locked" });
      }

      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadWebDavBackup(config, rootHandle, [localPrompt], []);

    expect(result.success).toBe(false);
    expect(result.uploadedFiles).toEqual(["prompts/prompt-1.json", WEBDAV_FILENAME]);
    expect(result.deletedFiles).toEqual([]);
    expect(result.errors).toEqual([
      "attachments/prompt-1/attachment-old-old.pdf: WebDAV DELETE failed: HTTP 423 Locked - locked",
    ]);
  });

  it("reports manifest upload failures after attachment uploads and stops", async () => {
    const prompt = createPrompt();
    vi.mocked(fileSystem.getFileFromAttachmentRoot).mockResolvedValue(
      new File(["pdf content"], "guide.pdf", { type: "application/pdf" })
    );
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response("locked", { status: 423, statusText: "Locked" });
      }

      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadWebDavBackup(config, rootHandle, [prompt], []);

    expect(result.success).toBe(false);
    expect(result.uploadedFiles).toEqual([
      "attachments/prompt-1/attachment-1-guide.pdf",
      "prompts/prompt-1.json",
    ]);
    expect(result.errors).toEqual(["quick-prompt-backup.json: WebDAV PUT failed: HTTP 423 Locked - locked"]);
    expect(fileSystem.getFileFromAttachmentRoot).toHaveBeenCalledTimes(1);
  });

  it("reports manifest download failures and preserves local data", async () => {
    const localPrompts = [createPrompt({ id: "local-prompt" })];
    const localCategories = [createCategory({ id: "local-category" })];
    vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));

    const result = await downloadWebDavBackup(
      config,
      rootHandle,
      localPrompts,
      localCategories,
      "replace"
    );

    expect(result).toEqual({
      success: false,
      prompts: localPrompts,
      categories: localCategories,
      downloadedFiles: [],
      errors: ["WebDAV GET failed: HTTP 404 - missing"],
    });
    expect(fileSystem.copyFileToAttachmentRoot).not.toHaveBeenCalled();
  });

  it("preserves local data when a replace-mode attachment download fails", async () => {
    const localPrompts = [createPrompt({ id: "local-prompt" })];
    const localCategories = [createCategory({ id: "local-category" })];
    const remotePrompt = createPrompt();
    const remoteCategories = [createCategory()];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response(serializeToWebDavContent([remotePrompt], remoteCategories), { status: 200 });
      }

      return new Response("missing attachment", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadWebDavBackup(
      config,
      rootHandle,
      localPrompts,
      localCategories,
      "replace"
    );

    expect(result.success).toBe(false);
    expect(result.prompts).toBe(localPrompts);
    expect(result.categories).toBe(localCategories);
    expect(result.downloadedFiles).toEqual([]);
    expect(result.errors).toEqual([
      "attachments/prompt-1/attachment-1-guide.pdf: WebDAV GET failed: HTTP 404 - missing attachment",
    ]);
  });

  it("preserves local data when an append-mode attachment copy fails", async () => {
    const existingPrompt = createPrompt({ id: "prompt-existing", title: "Local existing" });
    const existingCategory = createCategory({ id: "cat-existing", name: "Local existing" });
    const newPrompt = createPrompt({ id: "prompt-new" });
    vi.mocked(fileSystem.copyFileToAttachmentRoot).mockRejectedValue(new Error("disk full"));
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "GET" && url.endsWith(WEBDAV_FILENAME)) {
        return new Response(
          serializeToWebDavContent([newPrompt], [createCategory({ id: "cat-new" })]),
          { status: 200 }
        );
      }

      return new Response("pdf content", {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadWebDavBackup(
      config,
      rootHandle,
      [existingPrompt],
      [existingCategory],
      "append"
    );

    expect(result.success).toBe(false);
    expect(result.prompts).toEqual([existingPrompt]);
    expect(result.categories).toEqual([existingCategory]);
    expect(result.downloadedFiles).toEqual([]);
    expect(result.errors).toEqual([
      "attachments/prompt-1/attachment-1-guide.pdf: disk full",
    ]);
  });
});
