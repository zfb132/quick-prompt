import { browser as wxtBrowser } from "#imports";
import { BROWSER_STORAGE_KEY } from "@/utils/constants";
import type { PromptItem } from "@/utils/types";
import { normalizePromptItem } from "@/utils/promptUtils";

export const PROMPT_STORAGE_VERSION = 2;
export const PROMPT_STORAGE_INDEX_KEY = `${BROWSER_STORAGE_KEY}:index`;
export const PROMPT_STORAGE_ITEM_PREFIX = `${BROWSER_STORAGE_KEY}:item:`;

export interface PromptStorageIndex {
  version: number;
  ids: string[];
  updatedAt: string;
}

type StorageChanges = Record<string, Browser.storage.StorageChange>;

const buildPromptItemKey = (id: string): string => `${PROMPT_STORAGE_ITEM_PREFIX}${id}`;

const getBrowser = (): typeof wxtBrowser => {
  const globalBrowser = (globalThis as typeof globalThis & { browser?: typeof wxtBrowser }).browser;
  return globalBrowser?.storage?.local ? globalBrowser : wxtBrowser;
};

const getLocalStorageValue = async <T>(key: string): Promise<T | undefined> => {
  const result = await getBrowser().storage.local.get(key);
  return result[key] as T | undefined;
};

const getLocalStorageValues = async <T>(keys: string[]): Promise<Record<string, T | undefined>> => {
  if (keys.length === 0) return {};

  const result = await getBrowser().storage.local.get(keys);
  return result as Record<string, T | undefined>;
};

const removeLocalStorageKeys = async (keys: string[]): Promise<void> => {
  const localStorage = getBrowser().storage.local;

  if (keys.length === 0 || typeof localStorage.remove !== "function") {
    return;
  }

  await localStorage.remove(keys);
};

const isPromptStorageIndex = (value: unknown): value is PromptStorageIndex => (
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as PromptStorageIndex).ids)
);

const uniquePromptList = (prompts: PromptItem[]): PromptItem[] => {
  const promptsById = new Map<string, PromptItem>();

  prompts.forEach((prompt) => {
    if (!prompt.id) return;
    promptsById.set(prompt.id, normalizePromptItem(prompt));
  });

  return Array.from(promptsById.values());
};

export const isPromptStorageChange = (changes: StorageChanges): boolean => (
  Boolean(changes[BROWSER_STORAGE_KEY]) ||
  Boolean(changes[PROMPT_STORAGE_INDEX_KEY]) ||
  Object.keys(changes).some((key) => key.startsWith(PROMPT_STORAGE_ITEM_PREFIX))
);

export const getAllPrompts = async (): Promise<PromptItem[]> => {
  const index = await getLocalStorageValue<PromptStorageIndex | string[]>(PROMPT_STORAGE_INDEX_KEY);

  if (isPromptStorageIndex(index) || Array.isArray(index)) {
    const ids = Array.isArray(index) ? index : index.ids;
    const keys = ids.map(buildPromptItemKey);
    const storedItems = await getLocalStorageValues<PromptItem>(keys);

    return ids
      .map((id) => storedItems[buildPromptItemKey(id)])
      .filter((prompt): prompt is PromptItem => Boolean(prompt))
      .map(normalizePromptItem);
  }

  const legacyPrompts = await getLocalStorageValue<PromptItem[]>(BROWSER_STORAGE_KEY);
  if (!Array.isArray(legacyPrompts) || legacyPrompts.length === 0) {
    return [];
  }

  const migratedPrompts = uniquePromptList(legacyPrompts);
  await setAllPrompts(migratedPrompts);
  return migratedPrompts;
};

export const setAllPrompts = async (prompts: PromptItem[]): Promise<void> => {
  const normalizedPrompts = uniquePromptList(prompts);
  const nextIds = normalizedPrompts.map((prompt) => prompt.id);
  const nextItemKeys = normalizedPrompts.map((prompt) => buildPromptItemKey(prompt.id));
  const currentIndex = await getLocalStorageValue<PromptStorageIndex | string[]>(PROMPT_STORAGE_INDEX_KEY);
  const currentIds = isPromptStorageIndex(currentIndex)
    ? currentIndex.ids
    : Array.isArray(currentIndex)
      ? currentIndex
      : [];
  const currentKeys = currentIds.map(buildPromptItemKey);
  const currentItems = await getLocalStorageValues<PromptItem>(Array.from(new Set([...currentKeys, ...nextItemKeys])));
  const nextValues: Record<string, unknown> = {};

  normalizedPrompts.forEach((prompt) => {
    const key = buildPromptItemKey(prompt.id);
    if (JSON.stringify(currentItems[key]) !== JSON.stringify(prompt)) {
      nextValues[key] = prompt;
    }
  });

  const nextIndex: PromptStorageIndex = {
    version: PROMPT_STORAGE_VERSION,
    ids: nextIds,
    updatedAt: new Date().toISOString(),
  };

  const currentIndexForCompare = isPromptStorageIndex(currentIndex)
    ? currentIndex
    : Array.isArray(currentIndex)
      ? { version: PROMPT_STORAGE_VERSION, ids: currentIndex, updatedAt: "" }
      : null;

  if (
    !currentIndexForCompare ||
    currentIndexForCompare.version !== nextIndex.version ||
    JSON.stringify(currentIndexForCompare.ids) !== JSON.stringify(nextIndex.ids)
  ) {
    nextValues[PROMPT_STORAGE_INDEX_KEY] = nextIndex;
  }

  if (Object.keys(nextValues).length > 0) {
    await getBrowser().storage.local.set(nextValues);
  }

  const nextKeySet = new Set(nextItemKeys);
  const staleKeys = currentKeys.filter((key) => !nextKeySet.has(key));
  await removeLocalStorageKeys([...staleKeys, BROWSER_STORAGE_KEY]);
};

export const getPromptCount = async (): Promise<number> => {
  const index = await getLocalStorageValue<PromptStorageIndex | string[]>(PROMPT_STORAGE_INDEX_KEY);

  if (isPromptStorageIndex(index)) {
    return index.ids.length;
  }

  if (Array.isArray(index)) {
    return index.length;
  }

  const legacyPrompts = await getLocalStorageValue<PromptItem[]>(BROWSER_STORAGE_KEY);
  return Array.isArray(legacyPrompts) ? legacyPrompts.length : 0;
};
