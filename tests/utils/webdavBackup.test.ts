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
        WEBDAV_FILENAME,
      ],
      errors: [],
    });
    expect(fileSystem.getFileFromAttachmentRoot).toHaveBeenCalledTimes(2);

    const putCalls = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(putCalls).toHaveLength(3);
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
    expect(putCalls[2]).toMatchObject([
      "https://dav.example.com/root/quick-prompt/quick-prompt-backup.json",
      {
        method: "PUT",
        headers: {
          Authorization: "Basic YWxpY2U6c2VjcmV0",
          "Content-Type": "application/json",
        },
      },
    ]);
    expect(JSON.parse(await readBodyAsText(putCalls[2][1]?.body))).toMatchObject({
      prompts: [prompt],
      categories,
    });

    const mkcolUrls = fetchMock.mock.calls
      .filter(([, init]) => init?.method === "MKCOL")
      .map(([url]) => url);
    expect(mkcolUrls.filter((url) => url === "https://dav.example.com/root/quick-prompt/attachments/prompt-1")).toHaveLength(1);
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
    expect(result.uploadedFiles).toEqual(["attachments/prompt-1/attachment-1-guide.pdf"]);
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
