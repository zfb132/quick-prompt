import React, { useEffect, useRef, useState } from "react";
import { Switch } from "@headlessui/react";
import { browser } from "#imports";
import { CATEGORIES_STORAGE_KEY } from "@/utils/constants";
import type { Category, PromptItem } from "@/utils/types";
import { getAllPrompts, setAllPrompts } from "@/utils/promptStore";
import {
  getAttachmentRootHandle,
  pickAndStoreAttachmentRoot,
  verifyReadWritePermission,
} from "@/utils/attachments/fileSystem";
import {
  downloadWebDavBackup,
  uploadWebDavBackup,
  type WebDavBackupDownloadMode,
} from "@/utils/sync/webdavBackup";
import { WEBDAV_STORAGE_KEYS, type WebDavConfig } from "@/utils/sync/webdavSync";
import { t } from "../../../utils/i18n";

type MessageType = "success" | "error" | "info";

const DEFAULT_REMOTE_DIR = "quick-prompt";

const getErrorMessage = (error: unknown): string => (
  error instanceof Error ? error.message : String(error)
);

const WebDavIntegration: React.FC = () => {
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remoteDir, setRemoteDir] = useState(DEFAULT_REMOTE_DIR);
  const [autoSync, setAutoSync] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSyncSaving, setIsAutoSyncSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [needsAttachmentReauthorization, setNeedsAttachmentReauthorization] = useState(false);
  const [isReauthorizing, setIsReauthorizing] = useState(false);
  const [message, setMessage] = useState<{ type: MessageType; text: string } | null>(null);
  const messageTimeoutRef = useRef<number | null>(null);
  const saveRequestIdRef = useRef(0);
  const autoSyncRequestIdRef = useRef(0);

  useEffect(() => {
    loadSettings();

    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  const showMessage = (type: MessageType, text: string) => {
    setMessage({ type, text });

    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }

    messageTimeoutRef.current = window.setTimeout(() => {
      setMessage(null);
      messageTimeoutRef.current = null;
    }, 5000);
  };

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const result = await browser.storage.sync.get([
        WEBDAV_STORAGE_KEYS.SERVER_URL,
        WEBDAV_STORAGE_KEYS.USERNAME,
        WEBDAV_STORAGE_KEYS.PASSWORD,
        WEBDAV_STORAGE_KEYS.REMOTE_DIR,
        WEBDAV_STORAGE_KEYS.AUTO_SYNC,
      ]);

      setServerUrl(result[WEBDAV_STORAGE_KEYS.SERVER_URL] || "");
      setUsername(result[WEBDAV_STORAGE_KEYS.USERNAME] || "");
      setPassword(result[WEBDAV_STORAGE_KEYS.PASSWORD] || "");
      setRemoteDir(result[WEBDAV_STORAGE_KEYS.REMOTE_DIR] || DEFAULT_REMOTE_DIR);
      setAutoSync(result[WEBDAV_STORAGE_KEYS.AUTO_SYNC] ?? false);
    } catch (error) {
      console.error("Error loading WebDAV settings:", error);
      showMessage("error", t("webdavLoadSettingsFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const buildConfig = (): WebDavConfig | null => {
    const normalizedServerUrl = serverUrl.trim();
    const normalizedUsername = username.trim();
    const normalizedRemoteDir = remoteDir.trim();

    if (!normalizedServerUrl || !normalizedUsername || !password) {
      showMessage("error", t("webdavRequiredFields"));
      return null;
    }

    try {
      const parsedUrl = new URL(normalizedServerUrl);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        showMessage("error", t("webdavInvalidServerUrl"));
        return null;
      }
    } catch {
      showMessage("error", t("webdavInvalidServerUrl"));
      return null;
    }

    if (!normalizedRemoteDir || normalizedRemoteDir.includes("..")) {
      showMessage("error", t("webdavInvalidRemoteDirectory"));
      return null;
    }

    return {
      serverUrl: normalizedServerUrl,
      username: normalizedUsername,
      password,
      remoteDir: normalizedRemoteDir,
      autoSync,
    };
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }

    const config = buildConfig();

    if (!config) {
      return;
    }

    const requestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = requestId;
    setIsSaving(true);

    try {
      await browser.storage.sync.set({
        [WEBDAV_STORAGE_KEYS.SERVER_URL]: config.serverUrl,
        [WEBDAV_STORAGE_KEYS.USERNAME]: config.username,
        [WEBDAV_STORAGE_KEYS.PASSWORD]: config.password,
        [WEBDAV_STORAGE_KEYS.REMOTE_DIR]: config.remoteDir,
        [WEBDAV_STORAGE_KEYS.AUTO_SYNC]: config.autoSync,
      });
      if (requestId !== saveRequestIdRef.current) {
        return;
      }
      setRemoteDir(config.remoteDir);
      showMessage("success", t("webdavSettingsSaved"));
    } catch (error) {
      if (requestId !== saveRequestIdRef.current) {
        return;
      }
      console.error("Error saving WebDAV settings:", error);
      showMessage("error", `${t("webdavSaveSettingsFailed")}: ${getErrorMessage(error)}`);
    } finally {
      if (requestId === saveRequestIdRef.current) {
        setIsSaving(false);
      }
    }
  };

  const handleAutoSyncToggle = async (enabled: boolean) => {
    if (isAutoSyncSaving) {
      return;
    }

    const requestId = autoSyncRequestIdRef.current + 1;
    autoSyncRequestIdRef.current = requestId;
    setAutoSync(enabled);
    setIsAutoSyncSaving(true);

    try {
      await browser.storage.sync.set({ [WEBDAV_STORAGE_KEYS.AUTO_SYNC]: enabled });
      if (requestId !== autoSyncRequestIdRef.current) {
        return;
      }
    } catch (error) {
      if (requestId !== autoSyncRequestIdRef.current) {
        return;
      }
      console.error("Error saving WebDAV auto upload setting:", error);
      const result = await browser.storage.sync.get(WEBDAV_STORAGE_KEYS.AUTO_SYNC);
      setAutoSync(result[WEBDAV_STORAGE_KEYS.AUTO_SYNC] ?? false);
      showMessage("error", `${t("webdavSaveSettingsFailed")}: ${getErrorMessage(error)}`);
    } finally {
      if (requestId === autoSyncRequestIdRef.current) {
        setIsAutoSyncSaving(false);
      }
    }
  };

  const getAuthorizedRootHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
    const rootHandle = await getAttachmentRootHandle();

    if (!rootHandle || !(await verifyReadWritePermission(rootHandle))) {
      setNeedsAttachmentReauthorization(true);
      showMessage("error", t("attachmentPermissionLost"));
      return null;
    }

    setNeedsAttachmentReauthorization(false);
    return rootHandle;
  };

  const handleReauthorizeAttachmentDirectory = async () => {
    if (isReauthorizing) {
      return;
    }

    setIsReauthorizing(true);
    try {
      await pickAndStoreAttachmentRoot();
      setNeedsAttachmentReauthorization(false);
      showMessage("success", t("attachmentStorageReauthorized"));
    } catch (error) {
      console.error("Error reauthorizing attachment directory:", error);
      showMessage("error", `${t("attachmentStoragePermissionRequired")}: ${getErrorMessage(error)}`);
    } finally {
      setIsReauthorizing(false);
    }
  };

  const getPromptsAndCategories = async (): Promise<{
    prompts: PromptItem[];
    categories: Category[];
  }> => {
    const categoriesResult = await browser.storage.local.get(CATEGORIES_STORAGE_KEY);

    return {
      prompts: await getAllPrompts(),
      categories: (categoriesResult[CATEGORIES_STORAGE_KEY] as Category[]) || [],
    };
  };

  const handleUpload = async () => {
    const config = buildConfig();
    if (!config || isSyncing) {
      return;
    }

    setIsSyncing(true);
    try {
      const rootHandle = await getAuthorizedRootHandle();
      if (!rootHandle) {
        return;
      }

      const { prompts, categories } = await getPromptsAndCategories();
      const result = await uploadWebDavBackup(config, rootHandle, prompts, categories);

      if (result.success) {
        showMessage("success", t("webdavUploadSuccess", [
          String(result.uploadedFiles.length),
          String(result.deletedFiles.length),
        ]));
      } else {
        showMessage("error", `${t("webdavUploadFailed")}: ${result.errors.join("; ")}`);
      }
    } catch (error) {
      console.error("Error uploading WebDAV backup:", error);
      showMessage("error", `${t("webdavUploadFailed")}: ${getErrorMessage(error)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownload = async (mode: WebDavBackupDownloadMode) => {
    const config = buildConfig();
    if (!config || isSyncing) {
      return;
    }

    setIsSyncing(true);
    try {
      const rootHandle = await getAuthorizedRootHandle();
      if (!rootHandle) {
        return;
      }

      const { prompts, categories } = await getPromptsAndCategories();
      const result = await downloadWebDavBackup(config, rootHandle, prompts, categories, mode);

      if (!result.success) {
        showMessage("error", `${t("webdavDownloadFailed")}: ${result.errors.join("; ")}`);
        return;
      }

      await setAllPrompts(result.prompts);
      await browser.storage.local.set({
        [CATEGORIES_STORAGE_KEY]: result.categories,
      });
      showMessage("success", t("webdavDownloadSuccess", [String(result.downloadedFiles.length)]));
    } catch (error) {
      console.error("Error downloading WebDAV backup:", error);
      showMessage("error", `${t("webdavDownloadFailed")}: ${getErrorMessage(error)}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const Spinner = () => (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
              : message.type === "error"
                ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t("webdavConnectionSettings")}
        </h3>
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label htmlFor="webdav-server-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("webdavServerUrl")}
            </label>
            <input
              id="webdav-server-url"
              type="url"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder={t("webdavServerUrlPlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="webdav-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("webdavUsername")}
              </label>
              <input
                id="webdav-username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t("webdavUsernamePlaceholder")}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="webdav-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("webdavPassword")}
              </label>
              <input
                id="webdav-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("webdavPasswordPlaceholder")}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="webdav-remote-directory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("webdavRemoteDirectory")}
            </label>
            <input
              id="webdav-remote-directory"
              type="text"
              value={remoteDir}
              onChange={(event) => setRemoteDir(event.target.value)}
              placeholder={DEFAULT_REMOTE_DIR}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("webdavRemoteDirectoryHelp")}
            </p>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            {isSaving ? <Spinner /> : (
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {t("saveWebdavSettings")}
          </button>
        </form>
      </div>

      {needsAttachmentReauthorization && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {t("attachmentPermissionLost")}
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {t("webdavReauthorizeDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReauthorizeAttachmentDirectory}
              disabled={isReauthorizing}
              className="inline-flex justify-center items-center px-4 py-2 text-sm font-medium text-amber-900 dark:text-amber-100 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReauthorizing ? <Spinner /> : (
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7h18M5 7l1 12h12l1-12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                </svg>
              )}
              {t("reauthorizeAttachmentDirectory")}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {t("webdavAutoUpload")}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t("webdavAutoUploadDescription")}
            </p>
          </div>
          <Switch
            checked={autoSync}
            onChange={handleAutoSyncToggle}
            aria-label={t("webdavAutoUpload")}
            disabled={isAutoSyncSaving}
            className={`${
              autoSync ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-600"
            } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <span
              className={`${
                autoSync ? "translate-x-5" : "translate-x-1"
              } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
            />
          </Switch>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {t("webdavUploadTitle")}
          </h4>
          <button
            type="button"
            onClick={handleUpload}
            disabled={isSyncing}
            className="w-full flex justify-center items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? <Spinner /> : (
              <>
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0-12l4 4m-4-4L8 8" />
                </svg>
                {t("uploadWebdavBackup")}
              </>
            )}
          </button>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t("webdavUploadDescription")}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {t("webdavDownloadTitle")}
          </h4>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleDownload("append")}
              disabled={isSyncing}
              className="w-full flex justify-center items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? <Spinner /> : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  {t("appendWebdavBackup")}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleDownload("replace")}
              disabled={isSyncing}
              className="w-full flex justify-center items-center px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSyncing ? <Spinner /> : (
                <>
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t("replaceWebdavBackup")}
                </>
              )}
            </button>
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>
              <span className="font-medium text-green-600 dark:text-green-400">{t("appendMode")}</span>{" "}
              {t("appendModeDescription")}
            </p>
            <p>
              <span className="font-medium text-red-600 dark:text-red-400">{t("overwriteMode")}</span>{" "}
              {t("overwriteModeDescription")}
            </p>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
        <p>{t("webdavAttachmentPermissionNote")}</p>
        <p>{t("webdavAutoUploadTaskNote")}</p>
      </div>
    </div>
  );
};

export default WebDavIntegration;
