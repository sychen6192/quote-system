const cookieStore = { get: jest.fn() };
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => cookieStore),
}));

import { assertAuthenticated, isAuthenticated, isUnauthenticatedError } from "@/lib/auth/guard";
import { createSessionToken } from "@/lib/auth/session";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.AUTH_SECRET = "0123456789abcdef0123456789abcdef";
  delete process.env.APP_PASSWORD;
  cookieStore.get.mockReset();
});
afterAll(() => {
  process.env = ORIGINAL;
});

describe("assertAuthenticated", () => {
  it("passes without looking at cookies when auth is disabled", async () => {
    await expect(assertAuthenticated()).resolves.toBeUndefined();
    expect(await isAuthenticated()).toBe(true);
    expect(cookieStore.get).not.toHaveBeenCalled();
  });

  it("throws UNAUTHENTICATED without a session cookie", async () => {
    process.env.APP_PASSWORD = "s3cret";
    cookieStore.get.mockReturnValue(undefined);
    const err = await assertAuthenticated().catch((e: unknown) => e);
    expect(isUnauthenticatedError(err)).toBe(true);
    expect(await isAuthenticated()).toBe(false);
    expect(cookieStore.get).toHaveBeenCalledWith("qs_session");
  });

  it("throws for a forged cookie", async () => {
    process.env.APP_PASSWORD = "s3cret";
    cookieStore.get.mockReturnValue({ value: "v1.9999999999.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" });
    await expect(assertAuthenticated()).rejects.toThrow("UNAUTHENTICATED");
  });

  it("passes with a valid session cookie", async () => {
    process.env.APP_PASSWORD = "s3cret";
    cookieStore.get.mockReturnValue({ value: await createSessionToken() });
    await expect(assertAuthenticated()).resolves.toBeUndefined();
  });
});

describe("isUnauthenticatedError", () => {
  it("recognises only the guard's error", () => {
    expect(isUnauthenticatedError(new Error("UNAUTHENTICATED"))).toBe(true);
    expect(isUnauthenticatedError(new Error("nope"))).toBe(false);
    expect(isUnauthenticatedError("UNAUTHENTICATED")).toBe(false);
    expect(isUnauthenticatedError(null)).toBe(false);
  });
});
