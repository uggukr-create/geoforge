import type { Fetcher } from './fetcher.js';
import { mapConcurrent } from './fetcher.js';
import * as cheerio from 'cheerio';

export function parseSitemapXml(xml: string): { urls: string[]; sitemaps: string[] } {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s][^<\]]*?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  if (/<sitemapindex/i.test(xml)) return { urls: [], sitemaps: locs };
  return { urls: locs, sitemaps: [] };
}

export function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = '';
    let s = x.toString();
    if (x.pathname !== '/' && s.endsWith('/') && !x.search) s = s.slice(0, -1);
    return s;
  } catch { return u; }
}

export async function discoverSitemapUrls(origin: string, fetcher: Fetcher, hints: string[] = [], maxSitemaps = 20): Promise<{ urls: string[]; found: boolean }> {
  const queue: { url: string; depth: number }[] = [...new Set([...hints, `${origin}/sitemap.xml`])].map((url) => ({ url, depth: 0 }));
  const seen = new Set<string>();
  const urls = new Set<string>();
  let found = false;
  let fetched = 0;
  while (queue.length && fetched < maxSitemaps) {
    const { url, depth } = queue.shift() as { url: string; depth: number };
    if (seen.has(url)) continue;
    seen.add(url);
    fetched++;
    const r = await fetcher(url);
    if (r.status !== 200 || !/<(urlset|sitemapindex)/i.test(r.body)) continue;
    const p = parseSitemapXml(r.body);
    if (p.urls.length || p.sitemaps.length) found = true;
    p.urls.forEach((u) => urls.add(normalizeUrl(u)));
    if (depth < 2) p.sitemaps.forEach((s) => queue.push({ url: s, depth: depth + 1 }));
  }
  const host = new URL(origin).host;
  return { urls: [...urls].filter((u) => { try { return new URL(u).host === host; } catch { return false; } }), found };
}

export function extractInternalLinks(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const host = new URL(pageUrl).host;
  const out = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
    try {
      const u = new URL(href, pageUrl);
      if (u.host !== host || !/^https?:$/.test(u.protocol)) return;
      if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|css|js|ico|xml)$/i.test(u.pathname)) return;
      out.add(normalizeUrl(u.toString()));
    } catch { /* ignore */ }
  });
  return [...out];
}

/** Breadth-first crawl used when no sitemap exists. */
export async function bfsDiscover(startUrl: string, startHtml: string, fetcher: Fetcher, max: number, concurrency = 4): Promise<string[]> {
  const seen = new Set<string>([normalizeUrl(startUrl)]);
  let frontier = extractInternalLinks(startHtml, startUrl).filter((u) => !seen.has(u));
  const order: string[] = [];
  while (frontier.length && order.length < max * 3) {
    const batch = frontier.filter((u) => !seen.has(u)).slice(0, Math.max(0, max * 3 - order.length));
    batch.forEach((u) => { seen.add(u); order.push(u); });
    if (order.length >= max * 3) break;
    const pages = await mapConcurrent(batch.slice(0, max), concurrency, (u) => fetcher(u));
    frontier = pages.flatMap((p) => (p.status === 200 && /<html|<body|<a /i.test(p.body) ? extractInternalLinks(p.body, p.finalUrl) : []));
  }
  return order;
}
