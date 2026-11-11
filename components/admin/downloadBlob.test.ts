// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./downloadBlob";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("downloadBlob", () => {
  it("clicks a temporary link, then revokes the URL", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:file");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download });
    });
    const file = new Blob(["x"]);

    downloadBlob(file, "products.xlsx");

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(clicked).toEqual([{ href: "blob:file", download: "products.xlsx" }]);
    expect(document.querySelector("a")).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:file");
  });
});
