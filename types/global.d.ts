// types/global.d.ts

// Define User-Agent Client Hints interfaces if not already available
// Based on MDN and common typings

interface NavigatorUADataBrandVersion {
  readonly brand: string;
  readonly version: string;
}

interface UADataValues {
  readonly architecture?: string;
  readonly bitness?: string;
  readonly brands?: NavigatorUADataBrandVersion[];
  readonly mobile?: boolean;
  readonly model?: string;
  readonly platform?: string;
  readonly platformVersion?: string;
  readonly uaFullVersion?: string;
  // Add other high entropy values as needed
}

interface NavigatorUAData extends UADataValues {
  getHighEntropyValues(hints: string[]): Promise<UADataValues>;
  toJSON(): UADataValues;
}

declare global {
  type FileSystemPermissionMode = "read" | "readwrite";

  interface FileSystemHandlePermissionDescriptor {
    mode?: FileSystemPermissionMode;
  }

  interface FileSystemHandle {
    readonly kind: "file" | "directory";
    readonly name: string;
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface FileSystemCreateWritableOptions {
    keepExistingData?: boolean;
  }

  interface FileSystemWritableFileStream {
    write(data: Blob): Promise<void>;
    close(): Promise<void>;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: "file";
    createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
    getFile(): Promise<File>;
  }

  interface FileSystemGetDirectoryOptions {
    create?: boolean;
  }

  interface FileSystemGetFileOptions {
    create?: boolean;
  }

  interface FileSystemRemoveOptions {
    recursive?: boolean;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: "directory";
    getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
    removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
  }

  interface DirectoryPickerOptions {
    mode?: FileSystemPermissionMode;
    startIn?: string | FileSystemHandle;
  }

  interface Navigator {
    readonly userAgentData?: NavigatorUAData;
  }

  interface Window {
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<FileSystemDirectoryHandle>;
  }
}

// This export statement makes the file a module, which is often necessary
// for global declarations to be picked up correctly in some TypeScript setups.
export {}; 
