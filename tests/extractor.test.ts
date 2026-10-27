import { describe, expect, it } from 'vitest';
import * as cheerio from 'cheerio';
import { cleanDom } from '../src/extractor/dom-cleaner.js';
import { detectSocial } from '../src/extractor/entity-graph.js';
import { analyzePage, classifyUrl, isBluf, isQuestionHeading, pageCritique } from '../src/extractor/page-classifier.js';
import { ORIGIN, HOME_HTML, PRODUCT_HTML, res } from './fixtures.js';

describe('dom cleaner', () => {
  it('strips nav, footer and cookie banners but keeps content and GFM tables', () => {
    const { markdown } = cleanDom(HOME_HTML);
    expect(markdown).toContain('Original Crocs and sneakers in Ukraine');
    expect(markdown).not.toContain('cookies');
    expect(markdown).not.toContain('Instagram');
    expect(markdown).toMatch(/\| EU size/);
  });
});

describe('social and entity detection', () => {
  const $ = cheerio.load(HOME_HTML);
  const links = detectSocial($, ORIGIN + '/');
  it('finds profiles and ignores share links', () => {
    const names = links.map((l) => l.platform).sort();
    expect(names).toEqual(['Instagram', 'Telegram', 'TikTok', 'Trustpilot', 'YouTube']);
  });
});

describe('page analysis', () => {
  const home = analyzePage(res(ORIGIN + '/', 200, HOME_HTML));
  const product = analyzePage(res(ORIGIN + '/products/crocs-classic-black', 200, PRODUCT_HTML));

  it('detects question headings and BLUF answers', () => {
    expect(home.questionCount).toBe(2);
    expect(home.blufCount).toBe(2);
    expect(isQuestionHeading('Як обрати розмір')).toBe(true);
    expect(isQuestionHeading('Our story')).toBe(false);
    expect(isBluf('Too short.')).toBe(false);
  });
  it('extracts Product, Offer and BuyAction', () => {
    const p = product.products[0];
    expect(p.brand).toBe('Crocs');
    expect(p.material).toBe('Croslite');
    expect(p.offers[0]).toEqual({ price: '1899', currency: 'UAH', availability: 'InStock' });
    expect(product.hasBuyAction).toBe(true);
    expect(product.hasFaqSchema).toBe(true);
    expect(product.sizeTables).toBe(1);
    expect(product.tier).toBe(2);
  });
  it('measures alt coverage and meta hygiene', () => {
    expect(home.images).toBe(2);
    expect(home.imagesWithAlt).toBe(1);
    expect(home.hasViewport).toBe(true);
    expect(pageCritique(home).some((c) => c.includes('alt'))).toBe(true);
  });
  it('extracts NAP', () => {
    expect(home.nap.phone).toContain('380');
    expect(home.nap.email).toBe('hello@shoes.example.com');
  });
});

describe('semantic tiers', () => {
  it('classifies URLs', () => {
    expect(classifyUrl(ORIGIN + '/')).toBe(1);
    expect(classifyUrl(ORIGIN + '/uk/')).toBe(1);
    expect(classifyUrl(ORIGIN + '/delivery')).toBe(1);
    expect(classifyUrl(ORIGIN + '/return-policy')).toBe(1);
    expect(classifyUrl(ORIGIN + '/products/x')).toBe(2);
    expect(classifyUrl(ORIGIN + '/privacy-policy')).toBe(3);
    expect(classifyUrl(ORIGIN + '/crocs?page=2')).toBe(3);
    expect(classifyUrl(ORIGIN + '/cart')).toBe(3);
  });
});
