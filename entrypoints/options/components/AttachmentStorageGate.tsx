import { ReactNode, useCallback, useEffect, useState } from "react";
import { FolderOpen, HardDrive, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSurface } from "@/components/layout/AppShell";
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
    <PageSurface className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-2xl border-border/80 bg-card/95 shadow-2xl shadow-slate-950/5 backdrop-blur">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
            {isChecking ? <Loader2 className="size-5 animate-spin" /> : <ShieldCheck className="size-5" />}
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">{translate("attachmentStorageTitle")}</CardTitle>
            <CardDescription className="mx-auto max-w-xl text-sm leading-6">
              {translate("attachmentStorageDescription")}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <TriangleAlert className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isExternalStorageUnsupported && (
            <Alert variant="warning">
              <TriangleAlert className="size-4" />
              <AlertDescription>{translate("attachmentStorageUnsupported")}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={chooseAttachmentDirectory}
              disabled={isChecking || isExternalStorageUnsupported || isChoosing}
              className="group flex min-h-44 flex-col items-start rounded-2xl border border-primary/20 bg-primary/5 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-background text-primary shadow-sm ring-1 ring-border">
                {isChoosingExternal ? <Loader2 className="size-4 animate-spin" /> : <FolderOpen className="size-4" />}
              </span>
              <Badge variant="secondary" className="mb-3 border-primary/15 bg-primary/10 text-primary">
                {translate("attachmentStorageRecommended")}
              </Badge>
              <span className="text-sm font-semibold text-foreground">
                {translate("useExternalAttachmentStorage")}
              </span>
              <span className="mt-2 text-xs leading-5 text-muted-foreground">
                {translate("useExternalAttachmentStorageDescription")}
              </span>
            </button>

            <button
              type="button"
              onClick={chooseInternalStorage}
              disabled={isChecking || isChoosing}
              className="group flex min-h-44 flex-col items-start rounded-2xl border border-border bg-background/80 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:bg-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground shadow-sm ring-1 ring-border">
                {isChoosingInternal ? <Loader2 className="size-4 animate-spin" /> : <HardDrive className="size-4" />}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {translate("useBuiltInAttachmentStorage")}
              </span>
              <span className="mt-2 text-xs leading-5 text-muted-foreground">
                {translate("useBuiltInAttachmentStorageDescription")}
              </span>
            </button>
          </div>

          {isChecking && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {translate("loading")}
            </div>
          )}

          {isChoosing && (
            <Button disabled className="w-full">
              <Loader2 className="size-4 animate-spin" />
              {translate("saving")}
            </Button>
          )}
        </CardContent>
      </Card>
    </PageSurface>
  );
};

export default AttachmentStorageGate;
