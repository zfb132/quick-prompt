import React from "react";
import WebDavIntegration from "./WebDavIntegration";
import { t } from "../../../utils/i18n";

const WebDavIntegrationPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t("webdavSync")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("webdavSyncDescription")}
          </p>
        </div>

        <WebDavIntegration />
      </div>
    </div>
  );
};

export default WebDavIntegrationPage;
