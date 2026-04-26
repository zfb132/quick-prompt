import type { Category, PromptItem } from "@/utils/types";

export const WEBDAV_FILENAME = "quick-prompt-backup.json";
export const WEBDAV_CURRENT_VERSION = "1.0";

export const WEBDAV_STORAGE_KEYS = {
  SERVER_URL: "webdavServerUrl",
  USERNAME: "webdavUsername",
  PASSWORD: "webdavPassword",
  REMOTE_DIR: "webdavRemoteDir",
  AUTO_SYNC: "webdavAutoSync",
  SYNC_STATUS: "webdav_sync_status",
} as const;

export interface WebDavConfig {
  serverUrl: string;
  username: string;
  password: string;
  remoteDir: string;
  autoSync: boolean;
}

export interface WebDavExportData {
  version: string;
  exportedAt: string;
  prompts: PromptItem[];
  categories: Category[];
}

export const normalizeWebDavBaseUrl = (url: string): string => url.trim().replace(/\/+$/, "");

export const joinWebDavPath = (...parts: string[]): string => (
  parts
    .map((part) => part.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/")
);

export const buildWebDavUrl = (serverUrl: string, ...parts: string[]): string => {
  const baseUrl = normalizeWebDavBaseUrl(serverUrl);
  const path = joinWebDavPath(...parts);

  return path ? `${baseUrl}/${path}` : baseUrl;
};

const getSafeWebDavPathSegments = (path: string): string[] => {
  const segments = path.trim().replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);

  for (const segment of segments) {
    let decodedSegment: string;
    try {
      decodedSegment = decodeURIComponent(segment);
    } catch {
      throw new Error("WebDAV path is outside the configured WebDAV remote directory");
    }

    if (
      decodedSegment === "." ||
      decodedSegment === ".." ||
      decodedSegment.includes("/") ||
      decodedSegment.includes("\\")
    ) {
      throw new Error("WebDAV path is outside the configured WebDAV remote directory");
    }
  }

  return segments;
};

const buildConfiguredWebDavPath = (config: WebDavConfig, relativePath: string): string => {
  const remoteDirSegments = getSafeWebDavPathSegments(config.remoteDir);
  const relativePathSegments = getSafeWebDavPathSegments(relativePath);

  if (remoteDirSegments.length === 0) {
    throw new Error("WebDAV remote directory is required");
  }

  return joinWebDavPath(...remoteDirSegments, ...relativePathSegments);
};

export const getWebDavHeaders = (
  username: string,
  password: string,
  contentType?: string
): Record<string, string> => {
  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(`${username}:${password}`)}`,
  };

  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  return headers;
};

export const serializeToWebDavContent = (
  prompts: PromptItem[],
  categories: Category[]
): string => {
  const data: WebDavExportData = {
    version: WEBDAV_CURRENT_VERSION,
    exportedAt: new Date().toISOString(),
    prompts,
    categories,
  };

  return JSON.stringify(data, null, 2);
};

export const deserializeFromWebDavContent = (content: string): WebDavExportData => {
  const data = JSON.parse(content);

  if (!Array.isArray(data.prompts)) {
    throw new Error("WebDAV backup data must include a prompts array");
  }

  return {
    version: data.version || WEBDAV_CURRENT_VERSION,
    exportedAt: data.exportedAt || new Date().toISOString(),
    prompts: data.prompts,
    categories: Array.isArray(data.categories) ? data.categories : [],
  };
};

export const parseWebDavMultiStatus = (xml: string): string[] => {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = document.getElementsByTagName("parsererror")[0];

  if (parseError) {
    throw new Error("Invalid WebDAV multistatus XML");
  }

  const hrefElements = document.getElementsByTagNameNS("DAV:", "href");
  const fallbackHrefElements = hrefElements.length > 0
    ? []
    : Array.from(document.getElementsByTagName("href"));
  const elements = hrefElements.length > 0 ? Array.from(hrefElements) : fallbackHrefElements;

  return elements.map((element) => element.textContent?.trim() || "").filter(Boolean);
};

const buildConfiguredWebDavUrl = (config: WebDavConfig, relativePath: string): string => (
  buildWebDavUrl(config.serverUrl, buildConfiguredWebDavPath(config, relativePath))
);

const getResponseBodySnippet = async (response: Response): Promise<string> => {
  try {
    const body = await response.clone().text();
    return body.replace(/\s+/g, " ").trim().slice(0, 200);
  } catch {
    return "";
  }
};

const assertWebDavResponse = async (response: Response, action: string): Promise<void> => {
  if (response.ok) {
    return;
  }

  const status = [`HTTP ${response.status}`, response.statusText].filter(Boolean).join(" ");
  const bodySnippet = await getResponseBodySnippet(response);
  const message = bodySnippet ? `${status} - ${bodySnippet}` : status;

  throw new Error(`WebDAV ${action} failed: ${message}`);
};

export const ensureWebDavDirectory = async (
  config: WebDavConfig,
  path: string
): Promise<void> => {
  const remoteDirSegments = getSafeWebDavPathSegments(config.remoteDir);
  const pathSegments = getSafeWebDavPathSegments(path);

  if (remoteDirSegments.length === 0) {
    throw new Error("WebDAV remote directory is required");
  }

  if (pathSegments.length === 0) {
    return;
  }

  for (let index = 0; index < pathSegments.length; index += 1) {
    const directoryPath = joinWebDavPath(
      ...remoteDirSegments,
      ...pathSegments.slice(0, index + 1)
    );
    const response = await fetch(buildWebDavUrl(config.serverUrl, directoryPath), {
      method: "MKCOL",
      headers: getWebDavHeaders(config.username, config.password),
    });

    if (response.status === 405) {
      continue;
    }

    await assertWebDavResponse(response, "MKCOL");
  }
};

export const putWebDavFile = async (
  config: WebDavConfig,
  relativePath: string,
  body: BodyInit,
  contentType?: string
): Promise<void> => {
  const response = await fetch(buildConfiguredWebDavUrl(config, relativePath), {
    method: "PUT",
    headers: getWebDavHeaders(config.username, config.password, contentType),
    body,
  });

  await assertWebDavResponse(response, "PUT");
};

export const deleteWebDavFile = async (
  config: WebDavConfig,
  relativePath: string
): Promise<void> => {
  const response = await fetch(buildConfiguredWebDavUrl(config, relativePath), {
    method: "DELETE",
    headers: getWebDavHeaders(config.username, config.password),
  });

  if (response.status === 404) {
    return;
  }

  await assertWebDavResponse(response, "DELETE");
};

export const getWebDavTextFile = async (
  config: WebDavConfig,
  relativePath: string
): Promise<string> => {
  const response = await fetch(buildConfiguredWebDavUrl(config, relativePath), {
    method: "GET",
    headers: getWebDavHeaders(config.username, config.password),
  });

  await assertWebDavResponse(response, "GET");

  return response.text();
};

export const getWebDavBlobFile = async (
  config: WebDavConfig,
  relativePath: string
): Promise<Blob> => {
  const response = await fetch(buildConfiguredWebDavUrl(config, relativePath), {
    method: "GET",
    headers: getWebDavHeaders(config.username, config.password),
  });

  await assertWebDavResponse(response, "GET");

  return response.blob();
};
