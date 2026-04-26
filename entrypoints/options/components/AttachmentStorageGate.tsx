import { ReactNode, useCallback, useEffect, useState } from "react";
import {
  getAttachmentStorageMode,
  getAttachmentRootHandle,
  pickAndStoreAttachmentRoot,
  useInternalAttachmentStorage,
  verifyReadWritePermission,
} from "@/utils/attachments/fileSystem";
import type { t as repoTranslate } from "@/utils/i18n";

type GateStatus = "checking" | "ready" | "needs-choice";

type AttachmentStorageGateProps = {
  children: ReactNode;
  translate?: typeof repoTranslate;
};

const AttachmentStorageGate = ({ children, translate = (key) => key }: AttachmentStorageGateProps) => {
  const [status, setStatus] = useState<GateStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isChoosingInternal, setIsChoosingInternal] = useState(false);
  const [isChoosingExternal, setIsChoosingExternal] = useState(false);
  const [isExternalStorageUnsupported, setIsExternalStorageUnsupported] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAttachmentRoot = async () => {
      const externalStorageAvailable = typeof window.showDirectoryPicker === "function";
      setIsExternalStorageUnsupported(!externalStorageAvailable);

      try {
        const mode = await getAttachmentStorageMode();
        const handle = await getAttachmentRootHandle();
        if (!isMounted) return;

        if (mode === "internal") {
          setStatus("ready");
          return;
        }

        if (!handle) {
          setStatus("needs-choice");
          return;
        }

        if (!externalStorageAvailable) {
          setStatus("needs-choice");
          return;
        }

        const hasPermission = await verifyReadWritePermission(handle);
        if (!isMounted) return;

        setStatus(hasPermission ? "ready" : "needs-choice");
      } catch {
        if (!isMounted) return;
        setError(translate("attachmentStoragePermissionRequired"));
        setStatus("needs-choice");
      }
    };

    checkAttachmentRoot();

    return () => {
      isMounted = false;
    };
  }, []);

  const chooseInternalStorage = useCallback(async () => {
    setError(null);
    setIsChoosingInternal(true);

    try {
      await useInternalAttachmentStorage();
      setStatus("ready");
    } catch {
      setError(translate("attachmentStoragePermissionRequired"));
      setStatus("needs-choice");
    } finally {
      setIsChoosingInternal(false);
    }
  }, [translate]);

  const chooseAttachmentDirectory = useCallback(async () => {
    setError(null);
    setIsChoosingExternal(true);

    try {
      await pickAndStoreAttachmentRoot();
      setStatus("ready");
    } catch {
      setError(translate("attachmentStoragePermissionRequired"));
      setStatus("needs-choice");
    } finally {
      setIsChoosingExternal(false);
    }
  }, [translate]);

  if (status === "ready") {
    return <>{children}</>;
  }

  const isChecking = status === "checking";
  const isChoosing = isChoosingInternal || isChoosingExternal;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 transition-colors duration-200">
      <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {translate("attachmentStorageTitle")}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
          {translate("attachmentStorageDescription")}
        </p>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {isExternalStorageUnsupported && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {translate("attachmentStorageUnsupported")}
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={chooseAttachmentDirectory}
            disabled={isChecking || isExternalStorageUnsupported || isChoosing}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-left transition-colors hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-blue-800 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 dark:disabled:border-gray-700 dark:disabled:bg-gray-800"
          >
            <span className="mb-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-200">
              {translate("attachmentStorageRecommended")}
            </span>
            <span className="block text-sm font-semibold text-blue-800 dark:text-blue-200">
              {translate("useExternalAttachmentStorage")}
            </span>
            <span className="mt-1 block text-xs leading-5 text-blue-700 dark:text-blue-300">
              {translate("useExternalAttachmentStorageDescription")}
            </span>
          </button>

          <button
            type="button"
            onClick={chooseInternalStorage}
            disabled={isChecking || isChoosing}
            className="rounded-lg border border-gray-200 bg-white px-4 py-4 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:disabled:bg-gray-800"
          >
            <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
              {translate("useBuiltInAttachmentStorage")}
            </span>
            <span className="mt-1 block text-xs leading-5 text-gray-600 dark:text-gray-300">
              {translate("useBuiltInAttachmentStorageDescription")}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default AttachmentStorageGate;
