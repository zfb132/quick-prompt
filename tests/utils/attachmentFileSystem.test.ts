import { describe, expect, it, vi } from "vitest";
import {
  copyFileToAttachmentRoot,
  getFileFromAttachmentRoot,
  removeAttachmentFileFromRoot,
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
  it("copies a file into the relative attachment path", async () => {
    const root = createFakeDirectory();
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    await copyFileToAttachmentRoot(root as any, "attachments/prompt-1/att-1-hello.txt", file);
    const copied = await getFileFromAttachmentRoot(root as any, "attachments/prompt-1/att-1-hello.txt");

    expect(await copied.text()).toBe("hello");
    expect(copied.type).toBe("text/plain");
  });

  it("removes a file by relative path", async () => {
    const root = createFakeDirectory();
    const file = new File(["hello"], "hello.txt");

    await copyFileToAttachmentRoot(root as any, "attachments/prompt-1/att-1-hello.txt", file);
    await removeAttachmentFileFromRoot(root as any, "attachments/prompt-1/att-1-hello.txt");

    await expect(getFileFromAttachmentRoot(root as any, "attachments/prompt-1/att-1-hello.txt")).rejects.toThrow();
  });

  it("returns false when readwrite permission is denied", async () => {
    const root = {
      queryPermission: vi.fn().mockResolvedValue("prompt"),
      requestPermission: vi.fn().mockResolvedValue("denied"),
    };

    const { verifyReadWritePermission } = await import("@/utils/attachments/fileSystem");
    await expect(verifyReadWritePermission(root as any)).resolves.toBe(false);
  });
});
