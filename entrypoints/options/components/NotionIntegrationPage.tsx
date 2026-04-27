import React from "react";
import { Database } from "lucide-react";
import NotionIntegration from "./NotionIntegration";
import { PageHeader } from "@/components/common/PageHeader";
import { PageSurface } from "@/components/layout/AppShell";
import { t } from "../../../utils/i18n";

const NotionIntegrationPage: React.FC = () => {
  return (
    <PageSurface>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader icon={Database} title={t("notionIntegration")} description={t("notionIntegrationDescription")} />
        <NotionIntegration />
      </div>
    </PageSurface>
  );
};

export default NotionIntegrationPage;
