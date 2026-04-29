import { syncPromptsFromNotion as syncCorePromptsFromNotion, syncPromptsToNotion as syncCorePromptsToNotion } from "@/entrypoints/content/utils/notionSync"
import { t } from "@/utils/i18n"
import { getAllPrompts } from "@/utils/promptStore"

// Wrapper for Notion Sync: Notion -> Local
export const syncFromNotionToLocal = async (forceSync: boolean = false, mode: 'replace' | 'append' = 'replace'): Promise<boolean> => {
  console.log(`Background: Triggering syncFromNotionToLocal (force: ${forceSync}, mode: ${mode})`);
  return await syncCorePromptsFromNotion(mode);
};

// Wrapper for Notion Sync: Local -> Notion
export const syncLocalDataToNotion = async (forceSync: boolean = false): Promise<{success: boolean; errors?: string[]}> => {
  console.log(`Background: Triggering syncLocalDataToNotion (force: ${forceSync})`);
  const syncSettingsResult = await browser.storage.sync.get(['notionSyncToNotionEnabled']);
  const notionSyncToNotionEnabled = syncSettingsResult.notionSyncToNotionEnabled ?? false;

  if (!forceSync && !notionSyncToNotionEnabled) {
    console.log('Local -> Notion sync is disabled and not forced, skipping.');
    return {success: false, errors: [t('notionSyncDisabled')]};
  }

  const localPrompts = await getAllPrompts();

  if (!localPrompts || localPrompts.length === 0) {
    console.log('No local prompts to sync to Notion.');
    return {success: true};
  }
  return await syncCorePromptsToNotion(localPrompts);
};
