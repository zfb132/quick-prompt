import React from "react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

describe("interactive cursor styles", () => {
  it("adds pointer cursor classes to shared interactive controls", () => {
    render(
      <div>
        <Button data-testid="button">Action</Button>
        <Select>
          <SelectTrigger data-testid="select-trigger">
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
        </Select>
        <Tabs defaultValue="one">
          <TabsList>
            <TabsTrigger data-testid="tabs-trigger" value="one">
              One
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Checkbox data-testid="checkbox" aria-label="Accept" />
        <Switch data-testid="switch" aria-label="Enable" />
      </div>
    );

    expect(screen.getByTestId("button")).toHaveClass("cursor-pointer");
    expect(screen.getByTestId("select-trigger")).toHaveClass("cursor-pointer");
    expect(screen.getByTestId("tabs-trigger")).toHaveClass("cursor-pointer");
    expect(screen.getByTestId("checkbox")).toHaveClass("cursor-pointer");
    expect(screen.getByTestId("switch")).toHaveClass("cursor-pointer");
  });

  it("defines a global hover pointer cursor for native clickable elements", () => {
    const styles = readFileSync("assets/tailwind.css", "utf8");

    expect(styles).toContain("button:not(:disabled):hover");
    expect(styles).toContain('[role="button"]:not([aria-disabled="true"]):hover');
    expect(styles).toContain("a[href]:hover");
  });
});
