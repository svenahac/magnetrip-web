/**
 * The cover-image rules, as pure functions so the API services and the client
 * that mirrors them optimistically cannot drift apart.
 *
 * Ordering matches `pickCover()` in `lib/services/mappers.ts`: lowest `position` wins.
 */

type Positioned = { id: string; position: number };

/** The first image added to a coverless trip becomes its cover. */
export function coverAfterAdd(coverImageId: string | null, addedId: string): string | null {
  return coverImageId ?? addedId;
}

/**
 * Deleting the cover promotes the lowest-position survivor (null when none are left).
 * Deleting any other image leaves the cover alone.
 */
export function coverAfterDeleteMany(
  coverImageId: string | null,
  deletedIds: string[],
  remaining: Positioned[],
): string | null {
  if (coverImageId === null || !deletedIds.includes(coverImageId)) return coverImageId;
  if (remaining.length === 0) return null;
  return [...remaining].sort((a, b) => a.position - b.position)[0].id;
}

/** The single-image case of {@link coverAfterDeleteMany}. */
export function coverAfterDelete(
  coverImageId: string | null,
  deletedId: string,
  remaining: Positioned[],
): string | null {
  return coverAfterDeleteMany(coverImageId, [deletedId], remaining);
}
