import { describe, expect, it } from 'vitest';
import { analyzeRobots } from '../src/crawler/robots.js';
import { analyzePage } from '../src/extractor/page-classifier.js';
import { scoreSite, gradeFor } from '../src/analyzer/geo-scorer.js';
import { sameAsOf, canonicalUrl } from '../src/extractor/entity-graph.js';
import { BAD_HTML, HOME_HTML, ORIGIN, PRODUCT_HTML, ROBOTS_BLOCK_ALL, ROBOTS_MIXED, res } from './fixtures.js';

function input(htmls: [string, string][], robotsTxt: string | null, extra: { llms?: boolean; sitemap?: boolean } = {}) {
  const pages = htmls.map(([u, h]) => analyzePage(res(ORIGIN + u, 200, h)));
  const existing = sameAsOf(pages.flatMap((p) => p.jsonld));
  const social = pages.flatMap((p) => p.social);
  const set = new Set(existing.map(canonicalUrl));
  return { robots: analyzeRobots(robotsTxt), hasSitemap: extra.sitemap ?? true, hasLlmsTxt: extra.llms ?? false, pages, existingSameAs: existing, social, unlinkedSocial: social.filter((s) => !set.has(canonicalUrl(s.url))), napConsistent: true };
}

describe('GEO scorer', () => {
  const good = scoreSite(input([['/', HOME_HTML], ['/products/crocs-classic-black', PRODUCT_HTML]], ROBOTS_MIXED, { llms: true }));
  const bad = scoreSite(input([['/', BAD_HTML]], ROBOTS_BLOCK_ALL, { sitemap: false }));

  it('has 5 pillars of 20 points each', () => {
    expect(good.pillars).toHaveLength(5);
    expect(good.pillars.every((p) => p.max === 20)).toBe(true);
  });
  it('scores a structured store well above a bare site', () => {
    expect(good.total).toBeGreaterThan(bad.total + 30);
    expect(bad.total).toBeLessThan(40);
    expect(good.total).toBeLessThanOrEqual(100);
  });
  it('penalizes blocked search bots and reports a fix', () => {
    const tech = bad.pillars[0].checks[0];
    expect(tech.points).toBe(0);
    expect(bad.fixes.some((f) => f.fix.includes('OAI-SearchBot'))).toBe(true);
  });
  it('sorts fixes by impact', () => {
    const impacts = bad.fixes.map((f) => f.impact);
    expect([...impacts].sort((a, b) => b - a)).toEqual(impacts);
  });
  it('maps totals to letter grades', () => {
    expect(gradeFor(97)).toBe('A+');
    expect(gradeFor(82)).toBe('B');
    expect(gradeFor(10)).toBe('F');
  });
});
