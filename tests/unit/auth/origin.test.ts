import { isSameOrigin } from "@/lib/auth/origin";

const h = (init: Record<string, string>) => new Headers(init);

describe("isSameOrigin", () => {
  it("accepts a matching Origin", () => {
    expect(isSameOrigin(h({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(true);
  });

  it("accepts the public host announced by a reverse proxy", () => {
    expect(
      isSameOrigin(
        h({
          host: "app:3000",
          "x-forwarded-host": "quotes.example.com",
          origin: "https://quotes.example.com",
        })
      )
    ).toBe(true);
  });

  it("ignores default ports and case", () => {
    expect(isSameOrigin(h({ host: "Quotes.Example.com:443", origin: "https://quotes.example.com" }))).toBe(true);
    expect(isSameOrigin(h({ host: "quotes.example.com:80", origin: "http://quotes.example.com" }))).toBe(true);
  });

  it("falls back to Referer when Origin is absent", () => {
    expect(isSameOrigin(h({ host: "localhost:3000", referer: "http://localhost:3000/en/login" }))).toBe(true);
    expect(isSameOrigin(h({ host: "localhost:3000", referer: "https://evil.example/x" }))).toBe(false);
  });

  it("rejects cross-site and opaque origins", () => {
    expect(isSameOrigin(h({ host: "localhost:3000", origin: "https://evil.example" }))).toBe(false);
    expect(isSameOrigin(h({ host: "localhost:3000", origin: "http://localhost:3001" }))).toBe(false);
    expect(isSameOrigin(h({ host: "localhost:3000", origin: "null" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "http://localhost:3000" }))).toBe(false);
  });

  it("allows non-browser clients that send neither header", () => {
    expect(isSameOrigin(h({ host: "localhost:3000" }))).toBe(true);
  });
});
