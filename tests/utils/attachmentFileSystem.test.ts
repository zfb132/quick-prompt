import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyFileToAttachmentRoot,
  getFileFromAttachmentRoot,
  pickAndStoreAttachmentRoot,
  removeAttachmentDirectoryFromRoot,
  removeAttachmentFileFromRoot,
  saveAttachmentRootHandle,
} from "@/utils/attachments/fileSystem";

const createFakeFileHandle = () => {
  let currentFile = new File([""], "empty.txt");
  return {
    kind: "file",
    name: "empty.txt",
    async getFile() {
      return currentFile;
    },
    async createWritable() {
      return {
        async write(value: Blob) {
          currentFile = new File([value], "written.txt", { type: value.type });
        },
        async close() {},
      };
    },
  };
};

const createFakeDirectory = () => {
  const directories = new Map<string, any>();
  const files = new Map<string, any>();
  return {
    kind: "directory",
    name: "root",
    removed: [] as string[],
    async getDirectoryHandle(name: string, options?: { create?: boolean }) {
      if (!directories.has(name)) {
        if (!options?.create) throw new DOMException("Not found", "NotFoundError");
        directories.set(name, createFakeDirectory());
      }
      return directories.get(name);
    },
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!files.has(name)) {
        if (!options?.create) throw new DOMException("Not found", "NotFoundError");
        files.set(name, createFakeFileHandle());
      }
      return files.get(name);
    },
    async removeEntry(name: string) {
      files.delete(name);
      directories.delete(name);
      this.removed.push(name);
    },
    async queryPermission() {
      return "granted";
    },
    async requestPermission() {
      return "granted";
    },
  };
};

describe("attachment file system helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies a file into the relative attachment path", async () => {
    const root = createFakeDirectory();
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    await copyFileToAttachmentRoot(root as any, "attachments/prompt-1/att-1-hello.txt", file);
    const copied = await getFileFromAttachmentRoot(root as any, "attachments/prompt-1/att-1-hello.txt");

    expect(await copied.text()).toBe("hello");
    expect(copied.type).toBe("text/plain");
  });

  it("stores built-in attachment files as byte snapshots instead of raw file handles", async () => {
    const root = {
      kind: "directory",
      name: "Quick Prompt Built-in Storage",
      __quickPromptInternalAttachmentRoot: true,
    };
    const file = new File(["image-bytes"], "large.png", { type: "image/png" });
    const putRequest = {} as IDBRequest<void>;
    let storedValue: unknown;
    const store = {
      put: vi.fn((value: unknown) => {
        if (value instanceof File) {
          throw new DOMException(
            "A requested file or directory could not be found at the time an operation was processed.",
            "NotFoundError"
          );
        }

        storedValue = value;
        return putRequest;
      }),
    };
    const transaction = {
      error: null,
      objectStore: vi.fn(() => store),
      onabort: null as (() => void) | null,
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const db = {
      close: vi.fn(),
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
      transaction: vi.fn(() => transaction),
    };
    const openRequest = {
      error: null,
      result: db,
      onerror: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
    };

    vi.stubGlobal("indexedDB", {
      open: vi.fn(() => openRequest),
    });

    const promise = copyFileToAttachmentRoot(
      root as any,
      "attachments/prompt-1/att-1-large.png",
      file
    );

    await vi.waitFor(() => {
      expect(indexedDB.open).toHaveBeenCalled();
    });
    openRequest.onsuccess?.();
    await Promise.resolve();
    Object.assign(putRequest, { result: undefined });
    putRequest.onsuccess?.(new Event("success"));
    transaction.oncomplete?.();
    await promise;

    expect(storedValue).toBeInstanceOf(Blob);
    expect(storedValue).not.toBeInstanceOf(File);
    expect((storedValue as Blob).size).toBe(file.size);
    expect((storedValue as Blob).type).toBe("image/png");
  });

  it("removes a file by relative path", async () => {
    const root = createFakeDirectory();
    const file = new File(["hello"], "hello.txt");

    await copyFileToAttachmentRoot(root as any, "attachments/prompt-1/att-1-hello.txt", file);
    await removeAttachmentFileFromRoot(root as any, "attachments/prompt-1/att-1-hello.txt");

    await expect(getFileFromAttachmentRoot(root as any, "attachments/prompt-1/att-1-hello.txt")).rejects.toThrow();
  });

  it("removes a prompt attachment directory by relative path", async () => {
    const root = createFakeDirectory();
    const attachmentsDir = await root.getDirectoryHandle("attachments", { create: true });
    await attachmentsDir.getDirectoryHandle("prompt-1", { create: true });

    await removeAttachmentDirectoryFromRoot(root as any, "attachments/prompt-1");

    expect(attachmentsDir.removed).toContain("prompt-1");
  });

  it("rejects empty paths when copying or removing files", async () => {
    const root = createFakeDirectory();
    const file = new File(["hello"], "hello.txt");

    await expect(copyFileToAttachmentRoot(root as any, "", file)).rejects.toMatchObject({
      name: "NotFoundError",
    });
    await expect(removeAttachmentFileFromRoot(root as any, "")).rejects.toMatchObject({
      name: "NotFoundError",
    });
  });

  it("returns false when readwrite permission is denied", async () => {
    const root = {
      queryPermission: vi.fn().mockResolvedValue("prompt"),
      requestPermission: vi.fn().mockResolvedValue("denied"),
    };

    const { verifyReadWritePermission } = await import("@/utils/attachments/fileSystem");
    await expect(verifyReadWritePermission(root as any)).resolves.toBe(false);
  });

  it("checks readwrite permission without requesting it", async () => {
    const root = {
      queryPermission: vi.fn().mockResolvedValue("prompt"),
      requestPermission: vi.fn().mockResolvedValue("granted"),
    };

    const { hasReadWritePermission } = await import("@/utils/attachments/fileSystem");
    await expect(hasReadWritePermission(root as any)).resolves.toBe(false);
    expect(root.queryPermission).toHaveBeenCalledWith({ mode: "readwrite" });
    expect(root.requestPermission).not.toHaveBeenCalled();
  });

  it("rejects picking an attachment root when the File System Access API is unavailable", async () => {
    vi.stubGlobal("showDirectoryPicker", undefined);

    await expect(pickAndStoreAttachmentRoot()).rejects.toMatchObject({
      name: "NotSupportedError",
    });
  });

  it("resolves saved root handles only after the IndexedDB transaction commits", async () => {
    const root = createFakeDirectory();
    const putRequest = {} as IDBRequest<void>;
    const store = {
      put: vi.fn(() => putRequest),
    };
    const transaction = {
      error: null,
      objectStore: vi.fn(() => store),
      onabort: null as (() => void) | null,
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    const db = {
      close: vi.fn(),
      objectStoreNames: {
        contains: vi.fn(() => true),
      },
      transaction: vi.fn(() => transaction),
    };
    const openRequest = {
      error: null,
      result: db,
      onerror: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onupgradeneeded: null as (() => void) | null,
    };
    let resolved = false;

    vi.stubGlobal("indexedDB", {
      open: vi.fn(() => openRequest),
    });

    const promise = saveAttachmentRootHandle(root as any).then(() => {
      resolved = true;
    });

    openRequest.onsuccess?.();
    await Promise.resolve();
    Object.assign(putRequest, { result: undefined });
    putRequest.onsuccess?.(new Event("success"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resolved).toBe(false);
    expect(db.close).not.toHaveBeenCalled();

    transaction.oncomplete?.();
    await promise;

    expect(resolved).toBe(true);
    expect(db.close).toHaveBeenCalledTimes(1);
  });
});
