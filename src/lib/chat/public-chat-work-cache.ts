const resetters = new Set<() => void>();

export function registerPublicChatWorkCacheReset(reset: () => void): () => void {
  resetters.add(reset);
  return () => {
    resetters.delete(reset);
  };
}

export function resetPublicChatWorkCacheForTests(): void {
  for (const reset of resetters) reset();
}
