import React from "react";
import { Braces } from "lucide-react";
import GistIntegration from "./GistIntegration";
import { PageHeader } from "@/components/common/PageHeader";
import { PageSurface } from "@/components/layout/AppShell";
import { t } from "../../../utils/i18n";

const GistIntegrationPage: React.FC = () => {
  return (
    <PageSurface>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader icon={Braces} title={t("gistSync")} description={t("gistSyncDescription")} />
        <GistIntegration />
      </div>
    </PageSurface>
  );
};

export default GistIntegrationPage;
