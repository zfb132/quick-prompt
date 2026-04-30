export interface ZipArchiveInputEntry {
  path: string;
  data: string | Uint8Array | ArrayBuffer | Blob;
}

export interface ZipArchiveEntry {
  path: string;
  data: Uint8Array;
}

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_VERSION_NEEDED = 20;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_STORE_METHOD = 0;
const ZIP_DEFLATE_METHOD = 8;
const DOS_DATE_1980_01_01 = 0x0021;
const DOS_TIME_MIDNIGHT = 0x0000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let crc32Table: Uint32Array | null = null;

const getCrc32Table = (): Uint32Array => {
  if (crc32Table) {
    return crc32Table;
  }

  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }

    table[index] = value >>> 0;
  }

  crc32Table = table;
  return table;
};

const getCrc32 = (data: Uint8Array): number => {
  const table = getCrc32Table();
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
};

const writeUint16 = (target: Uint8Array, offset: number, value: number): void => {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
};

const writeUint32 = (target: Uint8Array, offset: number, value: number): void => {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
};

const getUint16 = (view: DataView, offset: number): number => (
  view.getUint16(offset, true)
);

const getUint32 = (view: DataView, offset: number): number => (
  view.getUint32(offset, true)
);

const normalizeArchivePath = (path: string): string => {
  const normalizedPath = path.replace(/\\/g, "/").replace(/^\/+/, "");

  if (!normalizedPath) {
    throw new Error("ZIP entry path is required");
  }

  return normalizedPath;
};

export const readBlobAsUint8Array = async (blob: Blob): Promise<Uint8Array> => {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
};

const toUint8Array = async (data: ZipArchiveInputEntry["data"]): Promise<Uint8Array> => {
  if (typeof data === "string") {
    return textEncoder.encode(data);
  }

  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  return readBlobAsUint8Array(data);
};

interface PreparedZipEntry {
  path: string;
  nameBytes: Uint8Array;
  data: Uint8Array;
  crc32: number;
  localHeaderOffset: number;
}

const createLocalHeader = (entry: PreparedZipEntry): Uint8Array => {
  const header = new Uint8Array(30);

  writeUint32(header, 0, LOCAL_FILE_HEADER_SIGNATURE);
  writeUint16(header, 4, ZIP_VERSION_NEEDED);
  writeUint16(header, 6, ZIP_UTF8_FLAG);
  writeUint16(header, 8, ZIP_STORE_METHOD);
  writeUint16(header, 10, DOS_TIME_MIDNIGHT);
  writeUint16(header, 12, DOS_DATE_1980_01_01);
  writeUint32(header, 14, entry.crc32);
  writeUint32(header, 18, entry.data.byteLength);
  writeUint32(header, 22, entry.data.byteLength);
  writeUint16(header, 26, entry.nameBytes.byteLength);
  writeUint16(header, 28, 0);

  return header;
};

const createCentralDirectoryHeader = (entry: PreparedZipEntry): Uint8Array => {
  const header = new Uint8Array(46);

  writeUint32(header, 0, CENTRAL_DIRECTORY_HEADER_SIGNATURE);
  writeUint16(header, 4, ZIP_VERSION_NEEDED);
  writeUint16(header, 6, ZIP_VERSION_NEEDED);
  writeUint16(header, 8, ZIP_UTF8_FLAG);
  writeUint16(header, 10, ZIP_STORE_METHOD);
  writeUint16(header, 12, DOS_TIME_MIDNIGHT);
  writeUint16(header, 14, DOS_DATE_1980_01_01);
  writeUint32(header, 16, entry.crc32);
  writeUint32(header, 20, entry.data.byteLength);
  writeUint32(header, 24, entry.data.byteLength);
  writeUint16(header, 28, entry.nameBytes.byteLength);
  writeUint16(header, 30, 0);
  writeUint16(header, 32, 0);
  writeUint16(header, 34, 0);
  writeUint16(header, 36, 0);
  writeUint32(header, 38, entry.path.endsWith("/") ? 0x10 : 0);
  writeUint32(header, 42, entry.localHeaderOffset);

  return header;
};

const createEndOfCentralDirectory = (
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
): Uint8Array => {
  const footer = new Uint8Array(22);

  writeUint32(footer, 0, END_OF_CENTRAL_DIRECTORY_SIGNATURE);
  writeUint16(footer, 4, 0);
  writeUint16(footer, 6, 0);
  writeUint16(footer, 8, entryCount);
  writeUint16(footer, 10, entryCount);
  writeUint32(footer, 12, centralDirectorySize);
  writeUint32(footer, 16, centralDirectoryOffset);
  writeUint16(footer, 20, 0);

  return footer;
};

export const createZipArchive = async (entries: ZipArchiveInputEntry[]): Promise<Blob> => {
  const chunks: Uint8Array[] = [];
  const preparedEntries: PreparedZipEntry[] = [];
  let offset = 0;

  for (const inputEntry of entries) {
    const path = normalizeArchivePath(inputEntry.path);
    const data = path.endsWith("/") ? new Uint8Array() : await toUint8Array(inputEntry.data);
    const preparedEntry: PreparedZipEntry = {
      path,
      nameBytes: textEncoder.encode(path),
      data,
      crc32: getCrc32(data),
      localHeaderOffset: offset,
    };
    const localHeader = createLocalHeader(preparedEntry);

    chunks.push(localHeader, preparedEntry.nameBytes, data);
    offset += localHeader.byteLength + preparedEntry.nameBytes.byteLength + data.byteLength;
    preparedEntries.push(preparedEntry);
  }

  const centralDirectoryOffset = offset;

  for (const entry of preparedEntries) {
    const centralDirectoryHeader = createCentralDirectoryHeader(entry);

    chunks.push(centralDirectoryHeader, entry.nameBytes);
    offset += centralDirectoryHeader.byteLength + entry.nameBytes.byteLength;
  }

  chunks.push(createEndOfCentralDirectory(
    preparedEntries.length,
    offset - centralDirectoryOffset,
    centralDirectoryOffset
  ));

  return new Blob(chunks, { type: "application/zip" });
};

const findEndOfCentralDirectoryOffset = (view: DataView): number => {
  const minimumOffset = Math.max(0, view.byteLength - 0xffff - 22);

  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (getUint32(view, offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  throw new Error("ZIP archive is missing the end of central directory record");
};

const inflateRaw = async (data: Uint8Array): Promise<Uint8Array> => {
  if (typeof DecompressionStream !== "function") {
    throw new Error("ZIP deflate entries are not supported in this browser");
  }

  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const readEntryData = async (
  method: number,
  compressedData: Uint8Array,
  expectedCrc32: number,
  expectedUncompressedSize: number
): Promise<Uint8Array> => {
  let data: Uint8Array;

  if (method === ZIP_STORE_METHOD) {
    data = compressedData;
  } else if (method === ZIP_DEFLATE_METHOD) {
    data = await inflateRaw(compressedData);
  } else {
    throw new Error(`Unsupported ZIP compression method: ${method}`);
  }

  if (data.byteLength !== expectedUncompressedSize) {
    throw new Error("ZIP entry size does not match the central directory");
  }

  if (getCrc32(data) !== expectedCrc32) {
    throw new Error("ZIP entry checksum does not match the central directory");
  }

  return data;
};

export const readZipArchive = async (source: Blob | ArrayBuffer | Uint8Array): Promise<ZipArchiveEntry[]> => {
  const bytes = source instanceof Blob
    ? await readBlobAsUint8Array(source)
    : ArrayBuffer.isView(source)
      ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
      : new Uint8Array(source);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOfCentralDirectoryOffset = findEndOfCentralDirectoryOffset(view);
  const entryCount = getUint16(view, endOfCentralDirectoryOffset + 10);
  const centralDirectoryOffset = getUint32(view, endOfCentralDirectoryOffset + 16);
  const entries: ZipArchiveEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (getUint32(view, offset) !== CENTRAL_DIRECTORY_HEADER_SIGNATURE) {
      throw new Error("Invalid ZIP central directory header");
    }

    const flags = getUint16(view, offset + 8);
    const method = getUint16(view, offset + 10);
    const crc32 = getUint32(view, offset + 16);
    const compressedSize = getUint32(view, offset + 20);
    const uncompressedSize = getUint32(view, offset + 24);
    const fileNameLength = getUint16(view, offset + 28);
    const extraFieldLength = getUint16(view, offset + 30);
    const commentLength = getUint16(view, offset + 32);
    const localHeaderOffset = getUint32(view, offset + 42);
    const pathBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
    const path = normalizeArchivePath(
      (flags & ZIP_UTF8_FLAG) ? textDecoder.decode(pathBytes) : textDecoder.decode(pathBytes)
    );

    if (getUint32(view, localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error("Invalid ZIP local file header");
    }

    const localFileNameLength = getUint16(view, localHeaderOffset + 26);
    const localExtraFieldLength = getUint16(view, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
    const compressedData = bytes.slice(dataStart, dataStart + compressedSize);

    entries.push({
      path,
      data: await readEntryData(method, compressedData, crc32, uncompressedSize),
    });

    offset += 46 + fileNameLength + extraFieldLength + commentLength;
  }

  return entries;
};

export const isZipArchiveData = (bytes: Uint8Array): boolean => (
  bytes.byteLength >= 4 && (
    (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) ||
    (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x05 && bytes[3] === 0x06)
  )
);
