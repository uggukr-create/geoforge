import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  ms: number;
  headers: Record<string, string>;
  body: string;
  https: boolean;
  error?: string;
}
export type Fetcher = (url: string) => Promise<FetchResult>;

export const DEFAULT_UA = 'geoforge/0.1 (+https://github.com/uggukr-create/geoforge; polite GEO audit bot)';

export function createFetcher(opts: { userAgent?: string; timeoutMs?: number } = {}): Fetcher {
  const ua = opts.userAgent ?? DEFAULT_UA;
  const timeout = opts.timeoutMs ?? 15000;
  return async (url: string) => {
    const start = Date.now();
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeout)
      });
      const body = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
      const finalUrl = res.url || url;
      return { url, finalUrl, status: res.status, ms: Date.now() - start, headers, body, https: finalUrl.startsWith('https:') };
    } catch (e) {
      return { url, finalUrl: url, status: 0, ms: Date.now() - start, headers: {}, body: '', https: url.startsWith('https:'), error: (e as Error).message };
    }
  };
}

export async function mapConcurrent<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

const MIME: Record<string, string> = { '.html': 'text/html', '.htm': 'text/html', '.xml': 'application/xml', '.txt': 'text/plain' };

/** Serves a local HTML file or directory as if it were a site at https://local.test */
export async function createLocalFetcher(path: string): Promise<{ fetcher: Fetcher; origin: string }> {
  const abs = resolve(path);
  const st = await stat(abs);
  const isDir = st.isDirectory();
  const root = isDir ? abs : dirname(abs);
  const origin = 'https://local.test';
  const fetcher: Fetcher = async (url) => {
    const u = new URL(url);
    const rel = decodeURIComponent(u.pathname);
    const candidates: string[] = [];
    if (!isDir && (rel === '/' || rel === '')) candidates.push(abs);
    else if (rel.endsWith('/')) candidates.push(join(root, rel, 'index.html'));
    else candidates.push(join(root, rel), join(root, rel + '.html'), join(root, rel, 'index.html'));
    for (const c of candidates) {
      if (c !== abs && !c.startsWith(root + sep)) continue;
      try {
        const s = await stat(c);
        if (!s.isFile()) continue;
        const body = await readFile(c, 'utf8');
        return { url, finalUrl: url, status: 200, ms: 0, headers: { 'content-type': MIME[extname(c)] ?? 'text/plain' } as Record<string, string>, body, https: true };
      } catch { /* try next */ }
    }
    return { url, finalUrl: url, status: 404, ms: 0, headers: {} as Record<string, string>, body: '', https: true };
  };
  return { fetcher, origin };
}
