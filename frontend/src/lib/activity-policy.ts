// H3's five operations. Keep this separate from the identity/document allowlist.
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const UUID = new RegExp(`^${uuid}$`, 'i');
const catalog = new RegExp(`^subjects/${uuid}/activities$`, 'i');
const activity = new RegExp(`^activities/${uuid}$`, 'i');
const submission = new RegExp(`^activities/${uuid}/submissions$`, 'i');
const result = new RegExp(`^activities/${uuid}/submissions/${uuid}$`, 'i');
export function activityRoute(method: string, path: string) {
  return method === 'GET' ? catalog.test(path) || activity.test(path) || result.test(path)
    : method === 'POST' && (catalog.test(path) || submission.test(path));
}
export function bodyLimit(method: string, path: string) {
  // Up to 50 questions, each with six options and a 4,000-character quote.
  // 4 MiB bounds transport independently of schema limits and leaves other routes unchanged.
  return method === 'POST' && catalog.test(path) ? 4 * 1024 * 1024
    : method === 'POST' && submission.test(path) ? 64 * 1024 : 16_384;
}
export function activityQuery(path: string, params: URLSearchParams): URLSearchParams | null {
  if (!catalog.test(path)) return new URLSearchParams();
  const query = new URLSearchParams();
  const limit = params.get('limit'); const cursor = params.get('cursor');
  if (limit !== null) {
    if (!/^\d{1,3}$/.test(limit) || Number(limit) < 1 || Number(limit) > 100) return null;
    query.set('limit', limit);
  }
  if (cursor !== null) { if (!UUID.test(cursor)) return null; query.set('cursor', cursor); }
  return query;
}
