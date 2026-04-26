import { ReactNode, useCallback, useEffect, useState } from "react";
import {
  getAttachmentRootHandle,
  pickAndStoreAttachmentRoot,
  verifyReadWritePermission,
} from "@/utils/attachments/fileSystem";

type GateStatus = "checking" | "ready" | "needs-permission" | "unsupported";

type AttachmentStorageGateProps = {
  children: ReactNode;
};

const t = (key: string): string => {
  const message = (globalThis as any).chrome?.i18n?.getMessage?.(key);
  return message || key;
};

const AttachmentStorageGate = ({ children }: AttachmentStorageGateProps) => {
  const [status, setStatus] = useState<GateStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isChoosing, setIsChoosing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAttachmentRoot = async () => {
      if (typeof window.showDirectoryPicker !== "function") {
        setStatus("unsupported");
        return;
      }

      try {
        const handle = await getAttachmentRootHandle();
        if (!isMounted) return;

        if (!handle) {
          setStatus("needs-permission");
          return;
        }

        const hasPermission = await verifyReadWritePermission(handle);
        if (!isMounted) return;

        setStatus(hasPermission ? "ready" : "needs-permission");
      } catch {
        if (!isMounted) return;
        setError(t("attachmentStoragePermissionRequired"));
        setStatus("needs-permission");
      }
    };

    checkAttachmentRoot();

    return () => {
      isMounted = false;
    };
  }, []);

  const chooseAttachmentDirectory = useCallback(async () => {
    setError(null);
    setIsChoosing(true);

    try {
      await pickAndStoreAttachmentRoot();
      setStatus("ready");
    } catch {
      setError(t("attachmentStoragePermissionRequired"));
      setStatus("needs-permission");
    } finally {
      setIsChoosing(false);
    }
  }, []);

  if (status === "ready") {
    return <>{children}</>;
  }

  const isUnsupported = status === "unsupported";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 transition-colors duration-200">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {t("attachmentStorageTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {t("attachmentStorageDescription")}
        </p>

        {(error || isUnsupported) && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {isUnsupported ? t("attachmentStorageUnsupported") : error}
          </p>
        )}

        <button
          type="button"
          onClick={chooseAttachmentDirectory}
          disabled={isUnsupported || isChoosing}
          className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400"
        >
          {t("chooseAttachmentDirectory")}
        </button>
      </div>
    </div>
  );
};

export default AttachmentStorageGate;
