import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("renders the ligature name hidden from assistive tech", () => {
    const html = renderToStaticMarkup(<Icon name="chair" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain(">chair</span>");
    expect(html).toContain("--icon-size:24px");
    expect(html).toContain("--icon-fill:0");
  });

  it("sets the size, optical size and fill", () => {
    const html = renderToStaticMarkup(<Icon name="mail" size={18} fill />);
    expect(html).toContain("--icon-size:18px");
    expect(html).toContain("--icon-opsz:20");
    expect(html).toContain("--icon-fill:1");
  });

  it("appends a custom class", () => {
    const html = renderToStaticMarkup(<Icon name="call" className="extra" />);
    expect(html).toMatch(/class="[^"]* extra"/);
  });
});
