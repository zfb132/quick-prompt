import React from "react";
import { Cloud } from "lucide-react";
import WebDavIntegration from "./WebDavIntegration";
import { PageHeader } from "@/components/common/PageHeader";
import { PageSurface } from "@/components/layout/AppShell";
import { t } from "../../../utils/i18n";

const WebDavIntegrationPage: React.FC = () => {
  return (
    <PageSurface>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader icon={Cloud} title={t("webdavSync")} description={t("webdavSyncDescription")} />
        <WebDavIntegration />
      </div>
    </PageSurface>
  );
};

export default WebDavIntegrationPage;
