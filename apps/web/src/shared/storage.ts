/** Storage helpers that never throw (private mode, blocked storage, ...). */
export function readJSON<T>(store: 'local' | 'session', key: string, fallback: T): T {
  try {
    const s = store === 'local' ? localStorage : sessionStorage;
    const raw = s.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(store: 'local' | 'session', key: string, value: unknown): void {
  try {
    const s = store === 'local' ? localStorage : sessionStorage;
    s.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
