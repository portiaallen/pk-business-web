/**
 * One-off confirmation prompt for irreversible admin deletes.
 * Wraps window.confirm so callers stay terse; returns false when cancelled
 * or when running in a non-browser environment.
 */
export function confirmDelete(message: string): boolean {
  if (typeof window === "undefined") return false;
  return window.confirm(message);
}
