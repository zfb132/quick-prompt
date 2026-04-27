import React, { useState, useEffect, useRef } from "react";
import { Check, Info, Loader2, Plus, RefreshCcw, UploadCloud } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { LoadingState } from "@/components/common/LoadingState";
import { SectionCard } from "@/components/common/SectionCard";
import { SettingsRow } from "@/components/common/SettingsRow";
import { browser } from "#imports";
import { t } from "../../../utils/i18n";

interface NotionIntegrationProps {
  // 不需要额外的props
}

// 定义同步状态的类型
interface SyncStatus {
  id: string;
  status: "in_progress" | "success" | "error";
  startTime?: number;
  completedTime?: number;
  message?: string;
  error?: string;
  success?: boolean;
}

const NotionIntegration: React.FC<NotionIntegrationProps> = () => {
  const [apiKey, setApiKey] = useState<string>("");
  const [databaseId, setDatabaseId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [testMessage, setTestMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [isSyncToNotionEnabled, setIsSyncToNotionEnabled] =
    useState<boolean>(false);
  const messageTimeoutRef = useRef<number | null>(null);

  // 新增状态：跟踪同步ID和轮询定时器
  const [currentSyncId, setCurrentSyncId] = useState<string | null>(null);
  const syncCheckIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    loadSettings();
    clearTemporaryMessages();
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
      // 清理轮询定时器
      if (syncCheckIntervalRef.current) {
        clearInterval(syncCheckIntervalRef.current);
      }
    };
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const result = await browser.storage.sync.get([
        "notionApiKey",
        "notionDatabaseId",
        "notionSyncToNotionEnabled",
      ]);
      setApiKey(result.notionApiKey || "");
      setDatabaseId(result.notionDatabaseId || "");
      setIsSyncToNotionEnabled(result.notionSyncToNotionEnabled ?? false);
    } catch (error) {
      console.error(t("loadSettingsError"), error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearTemporaryMessages = async () => {
    try {
      console.log('Clearing temporary messages...');
      // 获取所有本地存储的数据
      const allData = await browser.storage.local.get(null);
      const keysToRemove: string[] = [];

      // 查找所有临时消息键和同步状态键
      Object.keys(allData).forEach(key => {
        if (key.startsWith('temp_notion_message_') || 
            key === 'notion_sync_status' || 
            key === 'notion_from_sync_status') {
          keysToRemove.push(key);
        }
      });

      // 删除所有临时消息和同步状态
      if (keysToRemove.length > 0) {
        await browser.storage.local.remove(keysToRemove);
        console.log(`清理了 ${keysToRemove.length} 个临时消息和同步状态`);
      }
    } catch (error) {
      console.error('清理临时消息和同步状态时出错:', error);
    }
  };

  const showMessage = (type: "success" | "error" | "info", text: string) => {
    // 先设置本地状态
    setTestMessage({ type, text });

    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }

    messageTimeoutRef.current = window.setTimeout(() => {
      setTestMessage(null);
      messageTimeoutRef.current = null;
    }, 5000);

    // 只有成功和错误消息才保存到storage，显示为Toast
    if (type === "success" || type === "error") {
      const statusKey = `temp_notion_message_${Date.now()}`;
      const statusValue = {
        id: `message_${Date.now()}`,
        status: type === "success" ? "success" : "error",
        message: text,
        completedTime: Date.now(),
      };

      browser.storage.local.set({ [statusKey]: statusValue }).then(() => {
        // 5秒后自动删除临时消息
        setTimeout(() => {
          browser.storage.local.remove(statusKey);
        }, 5000);
      });
    }
  };

  const saveSyncToNotionEnabled = async (enabled: boolean) => {
    try {
      await browser.storage.sync.set({ notionSyncToNotionEnabled: enabled });
    } catch (error) {
      console.error("Error saving Notion sync setting:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !databaseId) {
      showMessage("error", t("fillAPIKeyAndDatabaseID"));
      return;
    }
    try {
      // 测试连接
      const testResult = await testNotionConnection(apiKey, databaseId);

      if (testResult.success) {
        // 保存设置
        await browser.storage.sync.set({
          notionApiKey: apiKey,
          notionDatabaseId: databaseId,
        });
        showMessage("success", t("connectionSuccessNotionSaved"));
      } else {
        showMessage("error", testResult.error || t("testConnectionError"));
      }
    } catch (error) {
      console.error(t("saveSettingsError"), error);
      showMessage("error", t("testConnectionError"));
    }
  };

  const testNotionConnection = async (
    key: string,
    dbId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(
        `https://api.notion.com/v1/databases/${dbId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${key}`,
            "Notion-Version": "2022-06-28",
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        console.error(t("notionConnectionFailed"), errorData.message);
        return {
          success: false,
          error: errorData.message || t("notionConnectionFailed")
        };
      }
      console.log(t("notionConnectionSuccessful"));
      return { success: true };
    } catch (error) {
      console.error(t("testConnectionError"), error);
      return {
        success: false,
        error: t("testConnectionError"),
      };
    }
  };

  const handleSyncToNotionToggle = async (enabled: boolean) => {
    setIsSyncToNotionEnabled(enabled);
    await saveSyncToNotionEnabled(enabled);
  };

  // 修改startSyncStatusPolling函数
  const startSyncStatusPolling = (syncId: string, storageKey: string) => {
    if (syncCheckIntervalRef.current) {
      clearInterval(syncCheckIntervalRef.current);
    }
    setCurrentSyncId(syncId);

    syncCheckIntervalRef.current = window.setInterval(async () => {
      try {
        const result = (await browser.storage.local.get(storageKey)) as {
          [key: string]: SyncStatus;
        };
        const syncStatus = result[storageKey];

        if (syncStatus && syncStatus.id === syncId) {
          if (
            syncStatus.status === "success" ||
            syncStatus.status === "error"
          ) {
            // 不再显示消息，只清理本地状态
            clearInterval(syncCheckIntervalRef.current!);
            syncCheckIntervalRef.current = null;
            setCurrentSyncId(null);
            // 不再立即清除存储中的状态，让ToastContainer处理
          } else if (syncStatus.status === "in_progress") {
            // 仍在进行中，继续轮询，但不显示消息
            console.log(`Sync ID ${syncId} is still in progress...`);
          }
        } else {
          // 当前 syncStatus 已经被清除，说明同步已经完成
          clearInterval(syncCheckIntervalRef.current!);
          syncCheckIntervalRef.current = null;
          setCurrentSyncId(null);
        }
      } catch (error) {
        console.error("Error polling sync status:", error);
        clearInterval(syncCheckIntervalRef.current!);
        syncCheckIntervalRef.current = null;
        setCurrentSyncId(null);
      }
    }, 2000); // 每2秒检查一次
  };

  // 修改同步到Notion的按钮点击处理函数
  const handleSyncToNotionClick = async () => {
    // 检查是否已配置Notion
    if (!apiKey || !databaseId) {
      showMessage(
        "error",
        t("notionAPIKeyOrDatabaseNotConfigured")
      );
      return;
    }

    if (currentSyncId) {
      showMessage("info", t("syncTaskInProgress"));
      return;
    }
    try {
      // 只在界面上显示info消息，不将其保存到storage
      showMessage("info", t("startingSyncToNotion"));

      const response = await browser.runtime.sendMessage({
        action: "syncToNotion",
        forceSync: true,
      });

      console.log(t('receivedSyncStartResponse'), response);

      if (response && response.syncInProgress && response.syncId) {
        // 直接将同步状态设置为in_progress，让ToastContainer显示loading状态
        await browser.storage.local.set({
          notion_sync_status: {
            id: response.syncId,
            status: "in_progress",
            message: t("syncingToNotionMessage"),
            startTime: Date.now(),
          },
        });

        // 启动轮询检查同步状态
        startSyncStatusPolling(response.syncId, "notion_sync_status");
      } else {
        showMessage("error", `${t("syncStartFailed")}: ${response?.error || t("unknownError")}`);
      }
    } catch (error) {
      console.error("Error triggering local to Notion sync:", error);
      showMessage("error", t("errorTriggeringSyncToNotion"));
    }
  };

  // 修改从Notion同步（覆盖）的按钮点击处理函数
  const handleSyncFromNotionReplaceClick = async () => {
    // 检查是否已配置Notion
    if (!apiKey || !databaseId) {
      showMessage(
        "error",
        t("notionAPIKeyOrDatabaseNotConfigured")
      );
      return;
    }

    if (currentSyncId) {
      showMessage("info", t("syncTaskInProgress"));
      return;
    }
    try {
      // 只在界面上显示info消息，不将其保存到storage
      showMessage("info", t("startingNotionOverwriteSync"));

      const response = await browser.runtime.sendMessage({
        action: "syncFromNotion",
        mode: "replace",
      });
      console.log(t('receivedNotionOverwriteSyncResponse'), response);

      if (response && response.syncInProgress && response.syncId) {
        // 直接将同步状态设置为in_progress，让ToastContainer显示loading状态
        await browser.storage.local.set({
          notion_from_sync_status: {
            id: response.syncId,
            status: "in_progress",
            message: t("syncingFromNotionOverwriteMessage"),
            startTime: Date.now(),
          },
        });

        // 启动轮询检查同步状态
        startSyncStatusPolling(response.syncId, "notion_from_sync_status");
      } else {
        showMessage("error", `${t("syncStartFailed")}: ${response?.error || t("unknownError")}`);
      }
    } catch (error) {
      console.error("Error triggering Notion to local sync (replace):", error);
      showMessage("error", t("errorTriggeringNotionOverwriteSync"));
    }
  };

  // 修改从Notion同步（追加）的按钮点击处理函数
  const handleSyncFromNotionAppendClick = async () => {
    // 检查是否已配置Notion
    if (!apiKey || !databaseId) {
      showMessage(
        "error",
        t("notionAPIKeyOrDatabaseNotConfigured")
      );
      return;
    }

    if (currentSyncId) {
      showMessage("info", t("syncTaskInProgress"));
      return;
    }
    try {
      // 只在界面上显示info消息，不将其保存到storage
      showMessage("info", t("startingNotionAppendSync"));

      const response = await browser.runtime.sendMessage({
        action: "syncFromNotion",
        mode: "append",
      });
      console.log(t('receivedNotionAppendSyncResponse'), response);

      if (response && response.syncInProgress && response.syncId) {
        // 直接将同步状态设置为in_progress，让ToastContainer显示loading状态
        await browser.storage.local.set({
          notion_from_sync_status: {
            id: response.syncId,
            status: "in_progress",
            message: t("syncingFromNotionAppendMessage"),
            startTime: Date.now(),
          },
        });

        // 启动轮询检查同步状态
        startSyncStatusPolling(response.syncId, "notion_from_sync_status");
      } else {
        showMessage("error", `${t("syncStartFailed")}: ${response?.error || t("unknownError")}`);
      }
    } catch (error) {
      console.error("Error triggering Notion to local sync (append):", error);
      showMessage("error", t("errorTriggeringNotionAppendSync"));
    }
  };

  if (isLoading)
    return <LoadingState title={t("loading")} description={t("loadingMessage")} />;

  const Spinner = () => (
    <Loader2 className="size-4 animate-spin" />
  );

  return (
    <div className="space-y-5">
      {testMessage && (
        <Alert variant={testMessage.type === "error" ? "destructive" : testMessage.type}>
          <AlertDescription>{testMessage.text}</AlertDescription>
        </Alert>
      )}

      <SectionCard
        title={t("basicSettings")}
        actions={(
          <Button asChild variant="outline" size="sm">
            <a
              href="https://github.com/wenyuanw/quick-prompt/blob/main/docs/notion-sync-guide.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Info className="size-4" />
              {t("configurationGuide")}
            </a>
          </Button>
        )}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="mb-1.5 block text-sm font-medium text-foreground">
              {t("notionAPIKey")}
            </label>
            <Input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t("notionAPIKeyPlaceholder")}
              required
            />
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {t("notionAPIKeyHelp")}{" "}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {t("notionIntegrationsPage")}
              </a>{" "}
              {t("notionAPIKeyHelp2")}
            </p>
          </div>

          <div>
            <label htmlFor="databaseId" className="mb-1.5 block text-sm font-medium text-foreground">
              {t("notionDatabaseID")}
            </label>
            <Input
              type="text"
              id="databaseId"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
              placeholder={t("notionDatabaseIDPlaceholder")}
              required
            />
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              {t("notionDatabaseIDHelp")}
            </p>
          </div>

          <Button type="submit">
            <Check className="size-4" />
            {t("saveSettingsAndTest")}
          </Button>
        </form>
      </SectionCard>

      <SectionCard contentClassName="p-0">
        <SettingsRow
          title={t("enableAutoSync")}
          description={t("autoSyncDescription")}
          control={(
            <Switch
              checked={isSyncToNotionEnabled}
              onCheckedChange={handleSyncToNotionToggle}
              aria-label={t("enableSync")}
            />
          )}
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SectionCard title={t("syncFromLocalToNotion")}>
          <Button
            type="button"
            onClick={handleSyncToNotionClick}
            disabled={currentSyncId !== null}
            className="w-full"
          >
            {currentSyncId !== null ? <Spinner /> : <UploadCloud className="size-4" />}
            {t("syncToNotion")}
          </Button>
          <div className="mt-4 text-xs leading-5 text-muted-foreground">
            <p className="mb-1">{t("syncToNotionDescription")}</p>
            <ul className="pl-4 list-disc space-y-0.5">
              <li>{t("createMissingPrompts")}</li>
              <li>{t("updateChangedPrompts")}</li>
              <li>{t("markDeletedPrompts")}</li>
            </ul>
          </div>
        </SectionCard>

        <SectionCard title={t("syncFromNotionToLocal")}>
          <div className="space-y-2">
            <Button
              type="button"
              onClick={handleSyncFromNotionAppendClick}
              disabled={currentSyncId !== null}
              variant="outline"
              className="w-full"
            >
              {currentSyncId !== null ? <Spinner /> : <Plus className="size-4" />}
              {t("appendToLocal")}
            </Button>
            <Button
              type="button"
              onClick={handleSyncFromNotionReplaceClick}
              disabled={currentSyncId !== null}
              variant="outline"
              className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              {currentSyncId !== null ? <Spinner /> : <RefreshCcw className="size-4" />}
              {t("overwriteLocalData")}
            </Button>
          </div>
          <div className="mt-4 space-y-1 text-xs leading-5 text-muted-foreground">
            <p>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{t("appendMode")}</span>{" "}
              {t("appendModeDescription")}
            </p>
            <p>
              <span className="font-medium text-destructive">{t("overwriteMode")}</span>{" "}
              {t("overwriteModeDescription")}
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-1 text-xs leading-5 text-muted-foreground">
        <p>• {t("apiKeyStorageNote")}</p>
        <p>• {t("permissionsNote")}</p>
        <p>• {t("oneTimeOperationNote")}</p>
      </div>
    </div>
  );
};

export default NotionIntegration;
