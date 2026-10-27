import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuditOptions, AuditResult, BuildOptions, PageData } from './types.js';
import { DEFAULT_UA, createFetcher, createLocalFetcher, mapConcurrent, type FetchResult, type Fetcher } from './crawler/fetcher.js';
import { analyzeRobots, generateRobotsAi } from './crawler/robots.js';
import { bfsDiscover, discoverSitemapUrls, normalizeUrl } from './crawler/sitemap.js';
import { analyzePage, classifyUrl } from './extractor/page-classifier.js';
import { canonicalUrl, digitsOnly, isOrgNode, sameAsOf } from './extractor/entity-graph.js';
import { scoreSite } from './analyzer/geo-scorer.js';
import { buildLlmsFull, buildLlmsTxt } from './compiler/llms-txt.js';
import { buildSchemaFile } from './compiler/schema-generator.js';
import { buildReport } from './compiler/report-generator.js';
import { estimateTokens } from './analyzer/token-counter.js';

export async function resolveTarget(target: string, opts: AuditOptions = {}): Promise<{ fetcher: Fetcher; origin: string; startUrl: string }> {
  if (opts.fetcher) {
    const u = new URL(/^https?:\/\//i.test(target) ? target : `https://${target}`);
    return { fetcher: opts.fetcher, origin: u.origin, startUrl: u.toString() };
  }
  try {
    await stat(target);
    const { fetcher, origin } = await createLocalFetcher(target);
    return { fetcher, origin, startUrl: origin + '/' };
  } catch { /* not a local path */ }
  const u = new URL(/^https?:\/\//i.test(target) ? target : `https://${target}`);
  return { fetcher: createFetcher({ userAgent: opts.userAgent ?? DEFAULT_UA }), origin: u.origin, startUrl: u.toString() };
}

const isHtml = (r: FetchResult) => r.status === 200 && (/html/i.test(r.headers['content-type'] ?? '') || /<html|<body|<h1|<title/i.test(r.body));

export async function runAudit(target: string, opts: AuditOptions = {}): Promise<AuditResult> {
  const maxPages = opts.maxPages ?? 25;
  const concurrency = opts.concurrency ?? 4;
  const { fetcher, origin, startUrl } = await resolveTarget(target, opts);

  const home = await fetcher(startUrl);
  if (home.status === 0 || home.status >= 400) throw new Error(`Cannot fetch ${startUrl}: ${home.error ?? 'HTTP ' + home.status}`);

  const robotsRes = await fetcher(`${origin}/robots.txt`);
  const robots = analyzeRobots(robotsRes.status === 200 && !/<html/i.test(robotsRes.body) ? robotsRes.body : null);
  const llmsRes = await fetcher(`${origin}/llms.txt`);
  const hasLlmsTxt = llmsRes.status === 200 && !/<html/i.test(llmsRes.body) && llmsRes.body.trim().startsWith('#');

  const sm = await discoverSitemapUrls(origin, fetcher, robots.sitemaps);
  let candidates = sm.urls;
  if (!sm.found || candidates.length === 0) candidates = await bfsDiscover(startUrl, home.body, fetcher, maxPages, concurrency);

  const homeKey = normalizeUrl(home.finalUrl || startUrl);
  const unique = [...new Set(candidates.map(normalizeUrl))].filter((u) => u !== homeKey && classifyUrl(u) !== 3);
  const rank = (u: string) => classifyUrl(u) * 1000 + new URL(u).pathname.length;
  unique.sort((a, b) => rank(a) - rank(b));
  const chosen = unique.slice(0, Math.max(0, maxPages - 1));

  const fetched = await mapConcurrent(chosen, concurrency, (u) => fetcher(u));
  const pages: PageData[] = [home, ...fetched].filter(isHtml).map(analyzePage);

  const allJson = pages.flatMap((p) => p.jsonld);
  const existingSameAs = sameAsOf(allJson);
  const socialMap = new Map<string, { platform: string; url: string }>();
  pages.forEach((p) => p.social.forEach((s) => { if (!socialMap.has(canonicalUrl(s.url))) socialMap.set(canonicalUrl(s.url), s); }));
  const social = [...socialMap.values()];
  const sameSet = new Set(existingSameAs.map(canonicalUrl));
  const unlinkedSocial = social.filter((s) => !sameSet.has(canonicalUrl(s.url)));

  const phones = new Set(pages.map((p) => digitsOnly(p.nap.phone)).filter(Boolean));
  const emails = new Set(pages.map((p) => (p.nap.email ?? '').toLowerCase()).filter(Boolean));
  const napConsistent = phones.size <= 1 && emails.size <= 1;
  const homePage = pages[0];
  const nap = { ...(pages.find((p) => p.nap.phone || p.nap.email)?.nap ?? {}), ...(homePage?.nap.name ? { name: homePage.nap.name } : {}) };
  const orgNode = allJson.find(isOrgNode);
  const siteName = nap.name || (homePage?.title.split(/[|\-:]/)[0].trim()) || new URL(origin).host;
  const ratingNode = allJson.find((n) => n && n.aggregateRating)?.aggregateRating;
  const rating = ratingNode?.ratingValue ? { value: String(ratingNode.ratingValue), count: ratingNode.reviewCount ? String(ratingNode.reviewCount) : ratingNode.ratingCount ? String(ratingNode.ratingCount) : undefined } : undefined;
  void orgNode;

  const score = scoreSite({ robots, hasSitemap: sm.found, hasLlmsTxt, pages, existingSameAs, social, unlinkedSocial, napConsistent });
  return { target, origin, siteName, generatedAt: new Date().toISOString(), robots, hasSitemap: sm.found, hasLlmsTxt, pages, social, unlinkedSocial, existingSameAs, nap, napConsistent, rating, score };
}

export interface BuildStats { indexTokens: number; fullTokens: number; pages: number; factsOnlyPages: number; truncatedPages: number }
export interface Artifacts { files: Record<string, string>; stats: BuildStats }

export function buildArtifacts(r: AuditResult, opts: BuildOptions = {}): Artifacts {
  const llms = buildLlmsTxt(r, opts.maxIndexTokens ?? 6000);
  const full = buildLlmsFull(r, opts.maxFullTokens ?? 80000);
  const sitemaps = r.robots.sitemaps.length ? r.robots.sitemaps : r.hasSitemap ? [`${r.origin}/sitemap.xml`] : [];
  const files = {
    'llms.txt': llms,
    'llms-full.txt': full.text,
    'geo-schema.jsonld': buildSchemaFile(r),
    'robots.ai.txt': generateRobotsAi({ origin: r.origin, allowTraining: opts.allowTraining, sitemaps }),
    'geo-audit-report.md': buildReport(r)
  };
  return { files, stats: { indexTokens: estimateTokens(llms), fullTokens: full.stats.tokens, pages: full.stats.pages, factsOnlyPages: full.stats.factsOnly, truncatedPages: full.stats.truncated } };
}

export async function writeArtifacts(dir: string, files: Record<string, string>): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const out: string[] = [];
  for (const [name, content] of Object.entries(files)) { const p = join(dir, name); await writeFile(p, content, 'utf8'); out.push(p); }
  return out;
}
