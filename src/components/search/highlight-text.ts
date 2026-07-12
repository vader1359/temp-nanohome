export type HighlightSegment = Readonly<{
  matched: boolean;
  value: string;
}>;

export function highlightText(text: string, query: string): readonly HighlightSegment[] {
  const normalizedQuery = query.trim();
  if (normalizedQuery === "") {
    return [{ value: text, matched: false }];
  }

  const normalizedText = text.toLocaleLowerCase();
  const normalizedNeedle = normalizedQuery.toLocaleLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(normalizedNeedle, cursor);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      segments.push({ value: text.slice(cursor, matchIndex), matched: false });
    }

    const matchEnd = matchIndex + normalizedNeedle.length;
    segments.push({ value: text.slice(matchIndex, matchEnd), matched: true });
    cursor = matchEnd;
    matchIndex = normalizedText.indexOf(normalizedNeedle, cursor);
  }

  if (segments.length === 0) {
    return [{ value: text, matched: false }];
  }

  if (cursor < text.length) {
    segments.push({ value: text.slice(cursor), matched: false });
  }

  return segments;
}
