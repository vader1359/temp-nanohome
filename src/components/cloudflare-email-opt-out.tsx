import type { ReactNode } from "react";

const EMAIL_OFF = { __html: "<!--email_off-->" };
const EMAIL_ON = { __html: "<!--/email_off-->" };

export function CloudflareEmailOptOut({ children }: { children: ReactNode }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="contents"
        dangerouslySetInnerHTML={EMAIL_OFF}
      />
      {children}
      <span
        aria-hidden="true"
        className="contents"
        dangerouslySetInnerHTML={EMAIL_ON}
      />
    </>
  );
}
