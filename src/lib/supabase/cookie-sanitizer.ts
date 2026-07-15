export interface CookieLike {
  name: string;
  value: string;
}

export function sanitizeCookies(cookiesList: CookieLike[]): CookieLike[] {
  const supabaseGroups: Record<string, { 
    unchunked?: CookieLike; 
    chunks: { name: string; value: string; index: number }[] 
  }> = {};
  const otherCookies: CookieLike[] = [];

  for (const cookie of cookiesList) {
    const match = cookie.name.match(/^sb-([a-zA-Z0-9]+)-auth-token(?:\.(\d+))?$/);
    if (match) {
      const ref = match[1];
      const chunkIdx = match[2];
      
      if (!supabaseGroups[ref]) {
        supabaseGroups[ref] = { chunks: [] };
      }
      
      if (chunkIdx === undefined) {
        supabaseGroups[ref].unchunked = cookie;
      } else {
        supabaseGroups[ref].chunks.push({
          name: cookie.name,
          value: cookie.value,
          index: parseInt(chunkIdx, 10)
        });
      }
    } else {
      otherCookies.push(cookie);
    }
  }

  const isValidJsonSession = (val: string): boolean => {
    try {
      JSON.parse(val);
      return true;
    } catch {}
    try {
      JSON.parse(decodeURIComponent(val));
      return true;
    } catch {}
    try {
      if (val.startsWith("base64-")) {
        const base64Str = val.substring("base64-".length);
        const base64 = base64Str.replace(/-/g, "+").replace(/_/g, "/");
        const padLength = (4 - (base64.length % 4)) % 4;
        const padded = base64 + "=".repeat(padLength);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const decoded = new TextDecoder().decode(bytes);
        JSON.parse(decoded);
        return true;
      }
    } catch {}
    return false;
  };

  for (const ref of Object.keys(supabaseGroups)) {
    const group = supabaseGroups[ref];
    let keepChunked = false;
    let keepUnchunked = false;

    // Check unchunked presence first to align with @supabase/ssr 0.5.2 behavior:
    // "valid unchunked cookie wins even if stale chunk cookies exist.
    // If an unchunked cookie is invalid and chunks exist, discard entire group rather than fall back."
    if (group.unchunked) {
      if (isValidJsonSession(group.unchunked.value)) {
        keepUnchunked = true;
      }
      
      if (keepUnchunked) {
        otherCookies.push(group.unchunked);
      }
      // If unchunked cookie is invalid, we discard the entire group (chunks and unchunked).
      // So if keepUnchunked is false, we do NOT fall back to chunks. We discard the entire group.
    } else if (group.chunks.length > 0) {
      group.chunks.sort((a, b) => a.index - b.index);
      
      let contiguous = true;
      for (let i = 0; i < group.chunks.length; i++) {
        if (group.chunks[i].index !== i) {
          contiguous = false;
          break;
        }
      }
      
      if (contiguous) {
        const combined = group.chunks.map(c => c.value).join('');
        if (isValidJsonSession(combined)) {
          keepChunked = true;
        }
      }
      
      if (keepChunked) {
        otherCookies.push(...group.chunks.map(c => ({ name: c.name, value: c.value })));
      }
    }
  }

  return otherCookies;
}
