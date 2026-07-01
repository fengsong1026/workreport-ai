/**
 * schemas.ts (Zod) 单元测试
 */

import { describe, it, expect } from "vitest";
import {
  LoginSchema,
  RegisterSchema,
  PasswordSchema,
  ProfileSchema,
  GenerateSchema,
  ScheduleCreateSchema,
  ScheduleUpdateSchema,
  DataSourcesPostSchema,
} from "@/lib/schemas";

describe("LoginSchema", () => {
  it("accepts valid input", () => {
    expect(LoginSchema.safeParse({ email: "a@b.com", password: "12345678" }).success).toBe(true);
  });

  it("rejects missing email", () => {
    expect(LoginSchema.safeParse({ password: "12345678" }).success).toBe(false);
  });

  it("rejects empty email", () => {
    expect(LoginSchema.safeParse({ email: "", password: "12345678" }).success).toBe(false);
  });
});

describe("RegisterSchema", () => {
  it("accepts valid input", () => {
    expect(RegisterSchema.safeParse({
      name: "Test", email: "a@b.com", password: "12345678",
    }).success).toBe(true);
  });

  it("rejects invalid email", () => {
    expect(RegisterSchema.safeParse({
      name: "Test", email: "not-email", password: "12345678",
    }).success).toBe(false);
  });

  it("rejects short password", () => {
    expect(RegisterSchema.safeParse({
      name: "Test", email: "a@b.com", password: "123",
    }).success).toBe(false);
  });

  it("rejects long name", () => {
    expect(RegisterSchema.safeParse({
      name: "x".repeat(101), email: "a@b.com", password: "12345678",
    }).success).toBe(false);
  });

  it("rejects empty name", () => {
    expect(RegisterSchema.safeParse({
      name: "", email: "a@b.com", password: "12345678",
    }).success).toBe(false);
  });
});

describe("PasswordSchema", () => {
  it("rejects short new password", () => {
    expect(PasswordSchema.safeParse({
      oldPassword: "oldpass", newPassword: "short",
    }).success).toBe(false);
  });

  it("accepts valid passwords", () => {
    expect(PasswordSchema.safeParse({
      oldPassword: "oldpass", newPassword: "12345678",
    }).success).toBe(true);
  });
});

describe("ProfileSchema", () => {
  it("rejects empty name", () => {
    expect(ProfileSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects overlong name", () => {
    expect(ProfileSchema.safeParse({ name: "x".repeat(101) }).success).toBe(false);
  });

  it("accepts valid name", () => {
    expect(ProfileSchema.safeParse({ name: "John" }).success).toBe(true);
  });
});

describe("GenerateSchema", () => {
  it("defaults type to weekly", () => {
    const result = GenerateSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe("weekly");
  });

  it("rejects invalid type", () => {
    expect(GenerateSchema.safeParse({ type: "yearly" }).success).toBe(false);
  });

  it("accepts dryRun flag", () => {
    const result = GenerateSchema.safeParse({ dryRun: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dryRun).toBe(true);
  });
});

describe("ScheduleCreateSchema", () => {
  it("accepts valid schedule", () => {
    expect(ScheduleCreateSchema.safeParse({
      name: "周五周报", schedule: "Fri 17:00",
    }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(ScheduleCreateSchema.safeParse({
      name: "", schedule: "Fri 17:00",
    }).success).toBe(false);
  });

  it("rejects long name", () => {
    expect(ScheduleCreateSchema.safeParse({
      name: "x".repeat(201), schedule: "Fri 17:00",
    }).success).toBe(false);
  });

  it("rejects invalid reportType", () => {
    expect(ScheduleCreateSchema.safeParse({
      name: "test", schedule: "Fri 17:00", reportType: "yearly",
    }).success).toBe(false);
  });
});

describe("ScheduleUpdateSchema", () => {
  it("accepts partial update (enabled only)", () => {
    expect(ScheduleUpdateSchema.safeParse({ enabled: false }).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(ScheduleUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("rejects invalid reportType", () => {
    expect(ScheduleUpdateSchema.safeParse({ reportType: "invalid" }).success).toBe(false);
  });
});

describe("DataSourcesPostSchema", () => {
  it("rejects missing name", () => {
    expect(DataSourcesPostSchema.safeParse({}).success).toBe(false);
  });

  it("accepts disconnect action", () => {
    const result = DataSourcesPostSchema.safeParse({ name: "git", action: "disconnect" });
    expect(result.success).toBe(true);
  });

  it("accepts select-repos with repo list", () => {
    const result = DataSourcesPostSchema.safeParse({
      name: "git", action: "select-repos", repos: [1, 2, 3],
    });
    expect(result.success).toBe(true);
  });
});
