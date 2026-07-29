import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CloudflareEmailOptOut } from "./cloudflare-email-opt-out";

describe("CloudflareEmailOptOut", () => {
  it("places Cloudflare opt-out comments around an email link", () => {
    const markup = renderToStaticMarkup(
      <CloudflareEmailOptOut>
        <a href="mailto:test@example.com">test@example.com</a>
      </CloudflareEmailOptOut>,
    );

    const start = markup.indexOf("<!--email_off-->");
    const email = markup.indexOf('href="mailto:test@example.com"');
    const end = markup.indexOf("<!--/email_off-->");

    expect(start).toBeGreaterThanOrEqual(0);
    expect(email).toBeGreaterThan(start);
    expect(end).toBeGreaterThan(email);
  });
});
