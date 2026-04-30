import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("options shell branding and attachment gate", () => {
  it("does not block the options app behind the attachment storage gate", () => {
    const source = readFileSync("entrypoints/options/App.tsx", "utf8");

    expect(source).not.toContain("AttachmentStorageGate");
  });

  it("renders the sidebar logo without rounded or shadow framing", () => {
    const source = readFileSync("entrypoints/options/components/Sidebar.tsx", "utf8");

    expect(source).toContain('alt="Quick Prompt Logo"');
    expect(source).not.toContain('className="size-9 rounded-2xl shadow-sm"');
  });

  it("renders the popup logo without rounded or shadow framing", () => {
    const source = readFileSync("entrypoints/popup/App.tsx", "utf8");

    expect(source).toContain('alt="quick prompt logo"');
    expect(source).not.toContain('className="size-10 rounded-2xl shadow-sm"');
  });
});
