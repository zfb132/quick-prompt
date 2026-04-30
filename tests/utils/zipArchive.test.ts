import { describe, expect, it } from "vitest";
import {
  createZipArchive,
  isZipArchiveData,
  readBlobAsUint8Array,
  readZipArchive,
} from "@/utils/zipArchive";

const textDecoder = new TextDecoder();

describe("zip archive helpers", () => {
  it("creates a readable zip archive with text and binary entries", async () => {
    const archive = await createZipArchive([
      { path: "quick-prompt-backup.json", data: JSON.stringify({ ok: true }) },
      { path: "prompts/prompt-1.json", data: new TextEncoder().encode("prompt") },
      { path: "attachments/prompt-1/file.bin", data: new Uint8Array([1, 2, 3]) },
    ]);

    const bytes = await readBlobAsUint8Array(archive);
    expect(isZipArchiveData(bytes)).toBe(true);

    const entries = await readZipArchive(archive);
    expect(entries.map((entry) => entry.path)).toEqual([
      "quick-prompt-backup.json",
      "prompts/prompt-1.json",
      "attachments/prompt-1/file.bin",
    ]);
    expect(textDecoder.decode(entries[1].data)).toBe("prompt");
    expect(Array.from(entries[2].data)).toEqual([1, 2, 3]);
  });
});
