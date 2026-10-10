import { downloadFile, filenameFromDisposition } from "@/components/app-shell/download";

describe("filenameFromDisposition", () => {
  it("prefers the UTF-8 filename* over the ASCII fallback", () => {
    expect(
      filenameFromDisposition(
        `attachment; filename="Quote-QT-1.pdf"; filename*=UTF-8''%E5%A0%B1%E5%83%B9%E5%96%AE-QT-1.pdf`
      )
    ).toBe("報價單-QT-1.pdf");
  });

  it("reads a plain quoted or bare filename", () => {
    expect(filenameFromDisposition('attachment; filename="quotes-2026-10-10.csv"')).toBe(
      "quotes-2026-10-10.csv"
    );
    expect(filenameFromDisposition("attachment; filename=a.pdf")).toBe("a.pdf");
    expect(filenameFromDisposition('attachment; filename="a \\"b\\".pdf"')).toBe('a "b".pdf');
  });

  it("falls back to the plain name when filename* is malformed, and null without one", () => {
    expect(filenameFromDisposition(`attachment; filename="x.pdf"; filename*=UTF-8''%E5%ZZ`)).toBe("x.pdf");
    expect(filenameFromDisposition("attachment")).toBeNull();
    expect(filenameFromDisposition(null)).toBeNull();
  });
});

function response(status: number, body = "x", headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

describe("downloadFile", () => {
  it("saves the blob under the server's file name", async () => {
    const save = jest.fn();
    const fetch = jest.fn(async () =>
      response(200, "%PDF", { "content-disposition": 'attachment; filename="Quote-QT-1.pdf"' })
    );
    await expect(downloadFile("/api/quotes/1/pdf?download=1", { fetch, save })).resolves.toBe("saved");
    expect(fetch).toHaveBeenCalledWith("/api/quotes/1/pdf?download=1", { credentials: "same-origin" });
    expect(save).toHaveBeenCalledTimes(1);
    const [blob, name] = save.mock.calls[0];
    expect(name).toBe("Quote-QT-1.pdf");
    expect(await (blob as Blob).text()).toBe("%PDF");
  });

  // The proxy answers /api/* with 401 JSON once the session has expired: a
  // bare <a download> saved that as a cancelled "pdf.json" and said nothing.
  it("reports an expired session instead of saving the 401 JSON", async () => {
    const save = jest.fn();
    const fetch = jest.fn(async () => response(401, '{"error":"UNAUTHENTICATED"}'));
    await expect(downloadFile("/api/quotes/1/pdf", { fetch, save })).resolves.toBe("unauthorized");
    expect(save).not.toHaveBeenCalled();
  });

  it.each([404, 500])("reports %i as failed", async (status) => {
    const save = jest.fn();
    await expect(
      downloadFile("/api/export/quotes", { fetch: async () => response(status), save })
    ).resolves.toBe("failed");
    expect(save).not.toHaveBeenCalled();
  });

  it("reports a network error as failed", async () => {
    const save = jest.fn();
    const fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(downloadFile("/api/export/quotes", { fetch, save })).resolves.toBe("failed");
  });

  it("falls back to the given name, then the URL's last segment", async () => {
    const save = jest.fn();
    await downloadFile("/api/x/file.csv?a=1", { fetch: async () => response(200), save }, "fallback.csv");
    await downloadFile("/api/x/file.csv?a=1", { fetch: async () => response(200), save });
    expect(save.mock.calls.map((call) => call[1])).toEqual(["fallback.csv", "file.csv"]);
  });
});
