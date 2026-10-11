/** Merge local run activity and persisted Supabase records without hiding either.
 * Preserve the latest local status in the rare case of matching IDs. */
export function mergeRunHistory<T extends { id: number }>(local: readonly T[], persisted: readonly T[], limit = 40): T[] {
  const ids = new Set<number>();
  return [...local, ...persisted]
    .sort((a, b) => b.id - a.id)
    .filter(item => {
      if (!Number.isFinite(item.id) || ids.has(item.id)) return false;
      ids.add(item.id);
      return true;
    })
    .slice(0, Math.max(0, Math.min(limit, 100)));
}
