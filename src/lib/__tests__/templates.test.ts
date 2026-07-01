/**
 * templates.ts 单元测试
 */

import { describe, it, expect } from "vitest";
import { fillTemplate } from "@/lib/templates";

describe("fillTemplate", () => {
  it("replaces single placeholder", () => {
    const result = fillTemplate("Hello {{NAME}}", { NAME: "World" });
    expect(result).toBe("Hello World");
  });

  it("replaces multiple placeholders", () => {
    const result = fillTemplate("{{GREETING}} {{NAME}}!", {
      GREETING: "Hello",
      NAME: "World",
    });
    expect(result).toBe("Hello World!");
  });

  it("replaces same placeholder multiple times", () => {
    const result = fillTemplate("{{X}} + {{X}} = 2{{X}}", { X: "a" });
    expect(result).toBe("a + a = 2a");
  });

  it("leaves unmatched placeholders untouched", () => {
    const result = fillTemplate("Hello {{UNKNOWN}}", { NAME: "World" });
    expect(result).toBe("Hello {{UNKNOWN}}");
  });

  it("converts number values to string", () => {
    const result = fillTemplate("Count: {{COUNT}}", { COUNT: 42 });
    expect(result).toBe("Count: 42");
  });

  it("escapes {{ in values to prevent template injection", () => {
    const result = fillTemplate("{{RECORDS}}", {
      RECORDS: "commit: fix {{BUG}} in code",
    });
    // {{BUG}} should be escaped to {\{BUG}
    expect(result).toContain("{\\{BUG}");
    expect(result).not.toContain("{{BUG}}");
  });

  it("handles empty variables", () => {
    const result = fillTemplate("{{A}}{{B}}{{C}}", {});
    expect(result).toBe("{{A}}{{B}}{{C}}");
  });

  it("handles empty template", () => {
    const result = fillTemplate("", { X: "y" });
    expect(result).toBe("");
  });
});
