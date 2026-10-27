import { describe, expect, it } from 'vitest';
import { analyzeRobots, generateRobotsAi, parseRobotsTxt, SEARCH_BOTS, TRAINING_BOTS } from '../src/crawler/robots.js';
import { ORIGIN, ROBOTS_BLOCK_ALL, ROBOTS_MIXED } from './fixtures.js';

describe('robots analysis', () => {
  it('tracks exactly 14 AI bots in two groups', () => {
    expect(SEARCH_BOTS.length + TRAINING_BOTS.length).toBe(14);
  });
  it('flags every bot blocked by a wildcard disallow', () => {
    const a = analyzeRobots(ROBOTS_BLOCK_ALL);
    expect(a.bots.every((b) => b.status === 'Blocked')).toBe(true);
    expect(a.issues.some((i) => i.includes('OAI-SearchBot'))).toBe(true);
  });
  it('separates search bots from training scrapers', () => {
    const a = analyzeRobots(ROBOTS_MIXED);
    const st = (n: string) => a.bots.find((b) => b.bot === n)?.status;
    expect(st('GPTBot')).toBe('Blocked');
    expect(st('OAI-SearchBot')).toBe('Allowed');
    expect(st('PerplexityBot')).toBe('Blocked');
    expect(st('ClaudeBot')).toBe('Unspecified');
    expect(a.sitemaps).toEqual([`${ORIGIN}/sitemap.xml`]);
  });
  it('handles missing robots.txt', () => {
    const a = analyzeRobots(null);
    expect(a.found).toBe(false);
    expect(a.bots.every((b) => b.status === 'Unspecified')).toBe(true);
  });
  it('treats stacked user-agent lines as one group', () => {
    const { groups } = parseRobotsTxt('User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n');
    expect(groups).toHaveLength(1);
    expect(groups[0].agents).toEqual(['gptbot', 'ccbot']);
  });
  it('generates robots.ai.txt that allows search and blocks training by default', () => {
    const txt = generateRobotsAi({ origin: ORIGIN });
    const reparsed = analyzeRobots(txt);
    for (const b of reparsed.bots) expect(b.status).toBe(b.group === 'search' ? 'Allowed' : 'Blocked');
    expect(txt).toContain('Disallow: /cart');
    expect(txt).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
    expect(txt).toContain('llms.txt');
  });
  it('allows training with the flag', () => {
    const reparsed = analyzeRobots(generateRobotsAi({ origin: ORIGIN, allowTraining: true }));
    expect(reparsed.bots.every((b) => b.status === 'Allowed')).toBe(true);
  });
  it('uses no em or en dashes in generated output', () => {
    expect(generateRobotsAi({ origin: ORIGIN })).not.toMatch(/[\u2013\u2014]/);
  });
});
