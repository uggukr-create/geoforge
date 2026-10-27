import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildArtifacts, runAudit, writeArtifacts } from '../src/pipeline.js';
import { estimateTokens } from '../src/analyzer/token-counter.js';
import { buildLlmsFull, buildLlmsTxt } from '../src/compiler/llms-txt.js';
import { buildSchemaGraph } from '../src/compiler/schema-generator.js';
import { HOME_HTML, ORIGIN, PRODUCT_HTML, ROBOTS_MIXED, SITEMAP, mockFetcher } from './fixtures.js';

const site = { '/': HOME_HTML, '/products/crocs-classic-black': PRODUCT_HTML, '/robots.txt': ROBOTS_MIXED, '/sitemap.xml': SITEMAP, '/privacy-policy': '<html><body><h1>Privacy</h1></body></html>' };

describe('end to end (offline mock site)', () => {
  it('audits, skips Tier 3 pages and builds all five artifacts', async () => {
    const r = await runAudit(ORIGIN, { fetcher: mockFetcher(site) });
    expect(r.pages.map((p) => new URL(p.url).pathname).sort()).toEqual(['/', '/products/crocs-classic-black']);
    expect(r.hasSitemap).toBe(true);
    const art = buildArtifacts(r);
    expect(Object.keys(art.files).sort()).toEqual(['geo-audit-report.md', 'geo-schema.jsonld', 'llms-full.txt', 'llms.txt', 'robots.ai.txt']);
    const dir = await mkdtemp(join(tmpdir(), 'geoforge-'));
    await writeArtifacts(dir, art.files);
    expect(await readFile(join(dir, 'llms.txt'), 'utf8')).toContain('# Shoes Example');
  });

  it('llms.txt follows the spec and includes brand authority and products', async () => {
    const r = await runAudit(ORIGIN, { fetcher: mockFetcher(site) });
    const t = buildLlmsTxt(r);
    expect(t.startsWith('# Shoes Example\n\n> ')).toBe(true);
    expect(t).toContain('## Official Brand Channels, Social Proof & Authority');
    expect(t).toContain('## Key Products, Categories & Buying Guides');
    expect(t).toContain('Price 1899 UAH');
    expect(t).toContain('https://t.me/shoesexample');
  });

  it('enforces token caps on llms.txt and llms-full.txt', async () => {
    const r = await runAudit(ORIGIN, { fetcher: mockFetcher(site) });
    const many = { ...r, pages: [...r.pages, ...Array.from({ length: 300 }, (_, i) => ({ ...r.pages[1], url: `${ORIGIN}/products/p${i}`, title: `Product ${i}`, summary: 'Brand Crocs, Price 1899 UAH, InStock' }))] };
    expect(estimateTokens(buildLlmsTxt(many, 1500))).toBeLessThanOrEqual(1500);
    const full = buildLlmsFull(many, 2500);
    expect(estimateTokens(full.text)).toBeLessThanOrEqual(2500);
    expect(full.stats.pages).toBeGreaterThan(0);
  });

  it('full text lists Tier 1 pages before products and carries metadata blocks', async () => {
    const r = await runAudit(ORIGIN, { fetcher: mockFetcher(site) });
    const { text } = buildLlmsFull(r);
    expect(text.indexOf('Tier: 1')).toBeLessThan(text.indexOf('Tier: 2'));
    expect(text).toContain('Extracted Facts/Price: Brand Crocs, Price 1899 UAH');
  });

  it('JSON-LD merges discovered social profiles into sameAs without duplicates', async () => {
    const r = await runAudit(ORIGIN, { fetcher: mockFetcher(site) });
    expect(r.unlinkedSocial.map((s) => s.platform).sort()).toEqual(['Telegram', 'TikTok', 'Trustpilot', 'YouTube']);
    const g = buildSchemaGraph(r);
    const org = g['@graph'].find((n: any) => n['@type'] === 'Organization');
    expect(org.sameAs).toHaveLength(5);
    expect(org.telephone).toContain('380');
    const types = g['@graph'].map((n: any) => n['@type']);
    expect(types).toEqual(expect.arrayContaining(['WebSite', 'FAQPage', 'Product']));
    const product = g['@graph'].find((n: any) => n['@type'] === 'Product');
    expect(product.offers.potentialAction['@type']).toBe('BuyAction');
    expect(product.offers.availability).toBe('https://schema.org/InStock');
  });

  it('never emits em or en dashes', async () => {
    const r = await runAudit(ORIGIN, { fetcher: mockFetcher(site) });
    for (const [name, content] of Object.entries(buildArtifacts(r).files)) {
      if (name === 'llms-full.txt') continue;
      expect(content, name).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe('token counter', () => {
  it('counts Cyrillic heavier than Latin per character', () => {
    expect(estimateTokens('привіт світе привіт світе')).toBeGreaterThan(estimateTokens('hello world hello world'));
    expect(estimateTokens('')).toBe(0);
  });
});
