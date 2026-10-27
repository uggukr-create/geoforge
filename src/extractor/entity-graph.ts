import * as cheerio from 'cheerio';
import type { NapData, SocialLink } from '../types.js';

type $ = cheerio.CheerioAPI;

export function typesOf(node: any): string[] {
  const t = node && node['@type'];
  if (!t) return [];
  return (Array.isArray(t) ? t : [t]).map((x) => String(x));
}

/** Parses every ld+json block, flattening @graph arrays and top-level arrays. */
export function extractJsonLd($: $): any[] {
  const out: any[] = [];
  const visit = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(visit); return; }
    if (Array.isArray(n['@graph'])) { n['@graph'].forEach(visit); }
    out.push(n);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try { visit(JSON.parse(raw)); } catch { /* invalid JSON-LD is ignored */ }
  });
  return out;
}

/** Collects every typed node nested anywhere (for BuyAction, AggregateRating etc.). */
export function deepNodes(nodes: any[]): any[] {
  const out: any[] = [];
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (n['@type']) out.push(n);
    Object.values(n).forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

const PLATFORMS: { name: string; match: (host: string, path: string) => boolean }[] = [
  { name: 'Instagram', match: (h) => h === 'instagram.com' },
  { name: 'TikTok', match: (h) => h === 'tiktok.com' },
  { name: 'YouTube', match: (h) => h === 'youtube.com' || h === 'm.youtube.com' || h === 'youtu.be' },
  { name: 'Telegram', match: (h) => h === 't.me' || h === 'telegram.me' },
  { name: 'X', match: (h) => h === 'x.com' || h === 'twitter.com' },
  { name: 'LinkedIn', match: (h) => h === 'linkedin.com' },
  { name: 'Facebook', match: (h) => h === 'facebook.com' || h === 'fb.com' || h === 'm.facebook.com' },
  { name: 'Reddit', match: (h) => h === 'reddit.com' || h === 'old.reddit.com' },
  { name: 'Quora', match: (h) => h === 'quora.com' },
  { name: 'Trustpilot', match: (h) => h === 'trustpilot.com' || h.endsWith('.trustpilot.com') },
  { name: 'Yelp', match: (h) => h === 'yelp.com' },
  { name: 'Google Business', match: (h, p) => h === 'g.page' || h === 'maps.app.goo.gl' || h === 'business.google.com' || (h === 'google.com' && p.startsWith('/maps')) || h === 'maps.google.com' },
  { name: 'GitHub', match: (h) => h === 'github.com' },
  { name: 'Pinterest', match: (h) => h === 'pinterest.com' },
  { name: 'Prom.ua / Rozetka reviews', match: (h) => h === 'prom.ua' || h === 'rozetka.com.ua' }
];

const SHARE_RE = /(sharer|share|intent\/|\/dialog|\/plugins\/|login|signup)/i;

export function canonicalUrl(u: string): string {
  try {
    const x = new URL(u);
    return (x.host.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch { return u.toLowerCase(); }
}

export function detectSocial($: $, baseUrl: string): SocialLink[] {
  const out = new Map<string, SocialLink>();
  let ownHost = '';
  try { ownHost = new URL(baseUrl).host.replace(/^www\./, ''); } catch { /* ignore */ }
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    let u: URL;
    try { u = new URL(href, baseUrl); } catch { return; }
    if (!/^https?:$/.test(u.protocol)) return;
    const host = u.host.replace(/^www\./, '').toLowerCase();
    if (host === ownHost) return;
    if (SHARE_RE.test(u.pathname + u.search)) return;
    if (u.pathname.replace(/\//g, '') === '' && host !== 'g.page') return;
    const p = PLATFORMS.find((x) => x.match(host, u.pathname));
    if (!p) return;
    const clean = `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
    const key = canonicalUrl(clean);
    if (!out.has(key)) out.set(key, { platform: p.name, url: clean });
  });
  return [...out.values()];
}

const ORG_TYPES = ['Organization', 'LocalBusiness', 'Store', 'OnlineStore', 'Corporation', 'ShoeStore', 'ClothingStore'];
export const isOrgNode = (n: any) => typesOf(n).some((t) => ORG_TYPES.includes(t));

export function sameAsOf(nodes: any[]): string[] {
  const out: string[] = [];
  for (const n of nodes.filter(isOrgNode)) {
    const s = n.sameAs;
    (Array.isArray(s) ? s : s ? [s] : []).forEach((x: any) => typeof x === 'string' && out.push(x));
  }
  return [...new Set(out)];
}

function addressToString(a: any): string | undefined {
  if (!a) return undefined;
  if (typeof a === 'string') return a;
  const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, typeof a.addressCountry === 'object' ? a.addressCountry?.name : a.addressCountry].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

export function extractNap($: $, nodes: any[]): NapData {
  const nap: NapData = {};
  const org = nodes.find(isOrgNode);
  if (org) {
    nap.name = typeof org.name === 'string' ? org.name : undefined;
    nap.phone = org.telephone ? String(org.telephone) : undefined;
    nap.email = org.email ? String(org.email) : undefined;
    nap.address = addressToString(org.address);
  }
  if (!nap.name) nap.name = $('meta[property="og:site_name"]').attr('content')?.trim() || undefined;
  if (!nap.phone) {
    const tel = $('a[href^="tel:"]').first().attr('href');
    if (tel) nap.phone = tel.replace(/^tel:/i, '').trim();
  }
  if (!nap.email) {
    const mail = $('a[href^="mailto:"]').first().attr('href');
    if (mail) nap.email = mail.replace(/^mailto:/i, '').split('?')[0].trim();
  }
  return nap;
}

export const digitsOnly = (s?: string) => (s ?? '').replace(/\D/g, '');
