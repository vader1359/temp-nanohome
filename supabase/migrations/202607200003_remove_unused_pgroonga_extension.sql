-- All PGroonga indexes have been removed. Dropping the extension also removes
-- its extension-managed Groonga objects, which hold the remaining disk usage.
drop extension if exists pgroonga;
