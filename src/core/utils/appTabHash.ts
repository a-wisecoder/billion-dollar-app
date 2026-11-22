export type AppTabId = 'home' | 'calendar' | 'insights' | 'settings';

function normalizeTabName(raw: string | null | undefined): AppTabId | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^#/, '').toLowerCase();
  if (cleaned === 'home' || cleaned === 'radar') return 'home';
  if (cleaned === 'calendar' || cleaned === 'timeline') return 'calendar';
  if (cleaned === 'insights' || cleaned === 'audit') return 'insights';
  if (cleaned === 'settings' || cleaned === 'vault') return 'settings';
  return null;
}

/**
 * Resolves the active app tab from the URL hash first (#home, #calendar, #insights, #settings),
 * falling back to legacy ?tab= query params and finally 'home'.
 */
export function parseTabFromLocation(hash: string, search: string = ''): AppTabId {
  const fromHash = normalizeTabName(hash);
  if (fromHash) return fromHash;

  if (search) {
    const params = new URLSearchParams(search);
    const fromQuery = normalizeTabName(params.get('tab'));
    if (fromQuery) return fromQuery;
  }

  return 'home';
}

export function formatTabHash(tab: AppTabId): string {
  return `#${tab}`;
}
