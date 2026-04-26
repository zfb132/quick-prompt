import { getAttachmentPathSegments } from "@/utils/attachments/metadata";

const DB_NAME = "quick-prompt-attachments";
const DB_VERSION = 1;
const STORE_NAME = "handles";
const ATTACHMENT_ROOT_KEY = "attachmentRoot";

const openAttachmentDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const runHandleStoreRequest = <T>(
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  return openAttachmentDatabase().then((db) => {
    return new Promise<T>((resolve, reject) => {
      let requestResult: T | undefined;
      let settled = false;

      const resolveAndClose = () => {
        if (settled) return;
        settled = true;
        db.close();
        resolve(requestResult as T);
      };
      const rejectAndClose = (error: unknown) => {
        if (settled) return;
        settled = true;
        db.close();
        reject(error);
      };

      try {
        const transaction = db.transaction(STORE_NAME, mode);
        const request = createRequest(transaction.objectStore(STORE_NAME));

        request.onsuccess = () => {
          requestResult = request.result;
        };
        request.onerror = () => rejectAndClose(request.error ?? transaction.error);
        transaction.oncomplete = () => resolveAndClose();
        transaction.onerror = () => rejectAndClose(transaction.error ?? request.error);
        transaction.onabort = () => rejectAndClose(transaction.error ?? request.error);
      } catch (error) {
        rejectAndClose(error);
      }
    });
  });
};

const getAttachmentFilePathParts = (relativePath: string): { parentSegments: string[]; fileName: string } => {
  const segments = getAttachmentPathSegments(relativePath);
  const fileName = segments.at(-1);

  if (!fileName) {
    throw new DOMException("Attachment path is empty", "NotFoundError");
  }

  return {
    parentSegments: segments.slice(0, -1),
    fileName,
  };
};

const withTextReader = (file: File): File => {
  if ("text" in file && typeof file.text === "function") {
    return file;
  }

  Object.defineProperty(file, "text", {
    value: () =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      }),
  });

  return file;
};

export const saveAttachmentRootHandle = (handle: FileSystemDirectoryHandle): Promise<void> => {
  return runHandleStoreRequest("readwrite", (store) => store.put(handle, ATTACHMENT_ROOT_KEY)).then(() => {});
};

export const getAttachmentRootHandle = (): Promise<FileSystemDirectoryHandle | undefined> => {
  return runHandleStoreRequest<FileSystemDirectoryHandle | undefined>("readonly", (store) =>
    store.get(ATTACHMENT_ROOT_KEY)
  );
};

export const verifyReadWritePermission = async (handle: FileSystemHandle): Promise<boolean> => {
  const descriptor: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };

  if ((await handle.queryPermission(descriptor)) === "granted") {
    return true;
  }

  return (await handle.requestPermission(descriptor)) === "granted";
};

export const pickAndStoreAttachmentRoot = async (): Promise<FileSystemDirectoryHandle> => {
  if (typeof window.showDirectoryPicker !== "function") {
    throw new DOMException("File System Access API is not available", "NotSupportedError");
  }

  const handle = await window.showDirectoryPicker({ mode: "readwrite" });

  if (!(await verifyReadWritePermission(handle))) {
    throw new DOMException("Read/write permission denied", "NotAllowedError");
  }

  await saveAttachmentRootHandle(handle);
  return handle;
};

export const getDirectoryForSegments = async (
  rootHandle: FileSystemDirectoryHandle,
  segments: string[],
  create: boolean
): Promise<FileSystemDirectoryHandle> => {
  let current = rootHandle;

  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create });
  }

  return current;
};

export const copyFileToAttachmentRoot = async (
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string,
  file: File
): Promise<void> => {
  const { parentSegments, fileName } = getAttachmentFilePathParts(relativePath);

  const directory = await getDirectoryForSegments(rootHandle, parentSegments, true);
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(file);
  await writable.close();
};

export const getFileFromAttachmentRoot = async (
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string
): Promise<File> => {
  const { parentSegments, fileName } = getAttachmentFilePathParts(relativePath);

  const directory = await getDirectoryForSegments(rootHandle, parentSegments, false);
  const fileHandle = await directory.getFileHandle(fileName);
  return withTextReader(await fileHandle.getFile());
};

export const removeAttachmentFileFromRoot = async (
  rootHandle: FileSystemDirectoryHandle,
  relativePath: string
): Promise<void> => {
  const { parentSegments, fileName } = getAttachmentFilePathParts(relativePath);

  const directory = await getDirectoryForSegments(rootHandle, parentSegments, false);
  await directory.removeEntry(fileName);
};
