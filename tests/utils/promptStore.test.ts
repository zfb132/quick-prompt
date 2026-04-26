import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PromptItem } from "@/utils/types";
import {
  BROWSER_STORAGE_KEY,
} from "@/utils/constants";
import {
  getAllPrompts,
  isPromptStorageChange,
  PROMPT_STORAGE_INDEX_KEY,
  PROMPT_STORAGE_ITEM_PREFIX,
  setAllPrompts,
} from "@/utils/promptStore";

const localData = new Map<string, unknown>();

vi.mock("#imports", () => ({
  browser: {
    storage: {
      local: {
        get: vi.fn(async (key?: string | string[]) => {
          if (Array.isArray(key)) {
            return Object.fromEntries(key.map((item) => [item, localData.get(item)]));
          }

          if (typeof key === "string") {
            return { [key]: localData.get(key) };
          }

          return Object.fromEntries(localData.entries());
        }),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.entries(values).forEach(([key, value]) => localData.set(key, value));
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys];
          list.forEach((key) => localData.delete(key));
        }),
      },
    },
  },
}));

const createPrompt = (overrides: Partial<PromptItem> = {}): PromptItem => ({
  id: "prompt-1",
  title: "Prompt",
  content: "Content",
  tags: ["work"],
  enabled: true,
  categoryId: "default",
  lastModified: "2026-04-26T00:00:00.000Z",
  ...overrides,
});

describe("promptStore", () => {
  beforeEach(() => {
    localData.clear();
    vi.clearAllMocks();
  });

  it("migrates the legacy single prompt array into prompt item storage", async () => {
    localData.set(BROWSER_STORAGE_KEY, [
      createPrompt({ id: "prompt-1" }),
      createPrompt({ id: "prompt-2", title: "Other" }),
    ]);

    const prompts = await getAllPrompts();

    expect(prompts).toHaveLength(2);
    expect(localData.get(BROWSER_STORAGE_KEY)).toBeUndefined();
    expect(localData.get(PROMPT_STORAGE_INDEX_KEY)).toMatchObject({
      version: 2,
      ids: ["prompt-1", "prompt-2"],
    });
    expect(localData.get(`${PROMPT_STORAGE_ITEM_PREFIX}prompt-1`)).toMatchObject({
      id: "prompt-1",
      createdAt: "2026-04-26T00:00:00.000Z",
    });
  });

  it("updates only changed prompt items and removes stale item keys", async () => {
    await setAllPrompts([
      createPrompt({ id: "prompt-1" }),
      createPrompt({ id: "prompt-2", title: "Other" }),
    ]);

    await setAllPrompts([
      createPrompt({ id: "prompt-2", title: "Other updated" }),
    ]);

    expect(localData.get(`${PROMPT_STORAGE_ITEM_PREFIX}prompt-1`)).toBeUndefined();
    expect(localData.get(PROMPT_STORAGE_INDEX_KEY)).toMatchObject({
      ids: ["prompt-2"],
    });
    expect(localData.get(`${PROMPT_STORAGE_ITEM_PREFIX}prompt-2`)).toMatchObject({
      title: "Other updated",
    });
  });

  it("detects prompt storage changes for legacy, index, and item keys", () => {
    expect(isPromptStorageChange({ [BROWSER_STORAGE_KEY]: {} as any })).toBe(true);
    expect(isPromptStorageChange({ [PROMPT_STORAGE_INDEX_KEY]: {} as any })).toBe(true);
    expect(isPromptStorageChange({ [`${PROMPT_STORAGE_ITEM_PREFIX}prompt-1`]: {} as any })).toBe(true);
    expect(isPromptStorageChange({ userCategories: {} as any })).toBe(false);
  });
});
