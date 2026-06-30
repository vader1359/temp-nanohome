"use client";

import { NotionRenderer } from "react-notion-x";
import type { ExtendedRecordMap } from "notion-types";

export function NotionArticle({ recordMap }: Readonly<{ recordMap: ExtendedRecordMap }>) {
  return (
    <div className="notion-shell mx-auto w-full max-w-4xl overflow-x-hidden text-nh-ink [&_.notion-asset-wrapper]:max-w-full [&_.notion-collection]:max-w-full [&_.notion-column]:max-w-full [&_.notion-page-content]:max-w-full [&_.notion-page]:!w-full [&_.notion-row]:max-w-full [&_.notion-table]:max-w-full [&_.notion-table]:overflow-x-auto">
      <NotionRenderer
        recordMap={recordMap}
        fullPage={false}
        darkMode={false}
        disableHeader
        showCollectionViewDropdown={false}
        showTableOfContents={false}
      />
    </div>
  );
}
