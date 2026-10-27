import * as cheerio from 'cheerio';
import type { FaqItem, HeadingInfo, NapData, OfferInfo, PageData, ProductInfo, Tier } from '../types.js';
import type { FetchResult } from '../crawler/fetcher.js';
import { cleanDom } from './dom-cleaner.js';
import { deepNodes, detectSocial, extractJsonLd, extractNap, typesOf } from './entity-graph.js';
import { estimateTokens } from '../analyzer/token-counter.js';

const LOCALE_RE = /^\/(en|uk|ua|ru|es|pl|de|fr|it)(?=\/|$)/i;
const NOISE_URL_RE = /([?&](page|p|sort|filter|order|orderby|sessionid|utm_\w+|add-to-cart)=|\/page\/\d+)/i;
const LEGAL_RE = /(privacy|terms|cookie|gdpr|oferta|agreement|konfid|login|signin|sign-in|register|account|cart|basket|checkout|wishlist|compare|\/search|\/tag\/)/i;
const CORE_RE = /(about|o-nas|o-kompanii|pro-nas|contact|kontakt|delivery|dostavka|shipping|payment|oplata|warranty|garant|return|refund|vozvrat|povernen|faq|help|size-guide|razmer)/i;
const PRODUCT_URL_RE = /(\/product|\/products\/|\/p\/|\/item|\/tovar|\/shop\/[^/]+\/[^/]+)/i;

export function classifyUrl(url: string, hasProductSchema = false): Tier {
  let path = '/';
  let search = '';
  try { const u = new URL(url); path = u.pathname; search = u.search; } catch { /* keep defaults */ }
  const p = path.replace(LOCALE_RE, '') || '/';
  if (NOISE_URL_RE.test(p + search)) return 3;
  if (LEGAL_RE.test(p)) return 3;
  if (p === '/' || p === '') return 1;
  if (CORE_RE.test(p)) return 1;
  if (hasProductSchema) return 2;
  return 2;
}

export const isProductUrl = (url: string) => PRODUCT_URL_RE.test(url);

const QUESTION_START = /^(how|what|why|which|where|when|who|can|does|do|is|are|should|как|какой|какая|какие|где|почему|что|когда|сколько|можно|як|який|яка|які|де|чому|що|коли|скільки|чи)(?=\s|$)/i;
export const isQuestionHeading = (t: string) => /\?\s*$/.test(t.trim()) || QUESTION_START.test(t.trim());

const wordCount = (s: string) => (s.trim().match(/\S+/g) ?? []).length;
const sentenceCount = (s: string) => (s.match(/[.!?…]+(\s|$)/g) ?? []).length || 1;

export function isBluf(text: string): boolean {
  const w = wordCount(text);
  return w >= 30 && w <= 75 && sentenceCount(text) <= 4;
}

const stripTag = (s: string) => cheerio.load(`<div>${s}</div>`)('div').text().replace(/\s+/g, ' ').trim();
const availShort = (a: any) => (typeof a === 'string' ? a.replace(/^https?:\/\/schema\.org\//i, '') : undefined);

function extractProducts(nodes: any[], pageUrl: string): ProductInfo[] {
  const out: ProductInfo[] = [];
  for (const n of nodes.filter((x) => typesOf(x).includes('Product'))) {
    const offersRaw = n.offers ? (Array.isArray(n.offers) ? n.offers : [n.offers]) : [];
    const offers: OfferInfo[] = offersRaw.map((o: any) => ({
      price: o?.price != null ? String(o.price) : o?.lowPrice != null ? String(o.lowPrice) : undefined,
      currency: o?.priceCurrency ? String(o.priceCurrency) : undefined,
      availability: availShort(o?.availability)
    }));
    out.push({
      name: typeof n.name === 'string' ? n.name : undefined,
      brand: typeof n.brand === 'string' ? n.brand : n.brand?.name,
      material: typeof n.material === 'string' ? n.material : undefined,
      color: typeof n.color === 'string' ? n.color : undefined,
      sku: n.sku ? String(n.sku) : undefined,
      url: typeof n.url === 'string' ? n.url : pageUrl,
      offers
    });
  }
  return out;
}

function extractFaqSchema(nodes: any[]): FaqItem[] {
  const out: FaqItem[] = [];
  for (const n of nodes.filter((x) => typesOf(x).includes('FAQPage'))) {
    const me = Array.isArray(n.mainEntity) ? n.mainEntity : n.mainEntity ? [n.mainEntity] : [];
    for (const q of me) {
      const a = q?.acceptedAnswer?.text;
      if (q?.name && a) out.push({ q: stripTag(String(q.name)), a: stripTag(String(a)) });
    }
  }
  return out;
}

export function factsOf(products: ProductInfo[]): string {
  const p = products[0];
  if (!p) return '';
  const o = p.offers[0];
  const bits = [
    p.brand && `Brand ${p.brand}`,
    o?.price && `Price ${o.price}${o.currency ? ' ' + o.currency : ''}`,
    o?.availability && o.availability,
    p.material && `Material ${p.material}`,
    p.color && `Color ${p.color}`
  ].filter(Boolean);
  return bits.join(', ');
}

export function analyzePage(fr: FetchResult): PageData {
  const html = fr.body;
  const pageUrl = fr.finalUrl || fr.url;
  const $full = cheerio.load(html);
  const jsonld = extractJsonLd($full);
  const nested = deepNodes(jsonld);
  const title = ($full('title').first().text() || '').replace(/\s+/g, ' ').trim();
  const description = ($full('meta[name="description"]').attr('content') || '').trim();
  const { $, root, markdown } = cleanDom(html);

  const headings: HeadingInfo[] = [];
  root.find('h1,h2,h3').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text) return;
    const level = Number((el as any).tagName.slice(1));
    const isQuestion = isQuestionHeading(text);
    const next = $(el).next();
    const hasBluf = isQuestion && next.length > 0 && (next.prop('tagName') ?? '').toLowerCase() === 'p' && isBluf(next.text());
    headings.push({ level, text, isQuestion, hasBluf });
  });

  const faqSchema = extractFaqSchema(nested);
  let faqs = faqSchema;
  if (faqs.length === 0) {
    root.find('h2,h3').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const next = $(el).next();
      if (isQuestionHeading(text) && (next.prop('tagName') ?? '').toLowerCase() === 'p' && faqs.length < 12) {
        faqs.push({ q: text, a: next.text().replace(/\s+/g, ' ').trim() });
      }
    });
  }

  let host = '';
  try { host = new URL(pageUrl).host; } catch { /* ignore */ }
  let internalLinks = 0;
  root.find('a[href]').each((_, el) => {
    try { if (new URL($(el).attr('href') ?? '', pageUrl).host === host) internalLinks++; } catch { /* ignore */ }
  });

  let sizeTables = 0;
  root.find('table').each((_, el) => {
    const t = $(el).text() + ' ' + ($(el).prev().text() ?? '');
    if (/(size|размер|розмір|eu\s*\d|us\s*\d)/i.test(t)) sizeTables++;
  });

  const imgs = $full('img');
  let withAlt = 0;
  imgs.each((_, el) => { if (($full(el).attr('alt') ?? '').trim()) withAlt++; });
  const videoCount = $full('video, iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[src*="vimeo"]').length;
  const https = pageUrl.startsWith('https:');
  const mixedContent = https && $full('[src^="http://"], link[rel*="stylesheet"][href^="http://"]').length > 0;

  const products = extractProducts(nested, pageUrl);
  const allTypes = [...new Set(nested.flatMap(typesOf))];
  const hasBuyAction = nested.some((n) => ['BuyAction', 'OrderAction'].some((t) => typesOf(n).includes(t)));
  const tier = classifyUrl(pageUrl, products.length > 0);
  const nap: NapData = extractNap($full, jsonld);

  const h1 = root.find('h1').first().text().replace(/\s+/g, ' ').trim();
  const lists = root.find('ul,ol').filter((_, el) => $(el).children('li').length >= 3).length;
  const firstPara = root.find('p').filter((_, el) => $(el).text().trim().length > 40).first().text().replace(/\s+/g, ' ').trim();
  let summary = factsOf(products) || description || firstPara.split(/(?<=[.!?])\s/)[0] || '';
  if (summary.length > 220) summary = summary.slice(0, 217).trimEnd() + '...';

  return {
    url: pageUrl, status: fr.status, responseMs: fr.ms, https, mixedContent,
    hasViewport: $full('meta[name="viewport"]').length > 0,
    xRobotsTag: fr.headers['x-robots-tag'],
    title: title || h1, description, h1, tier, markdown, tokens: estimateTokens(markdown), htmlChars: html.length,
    headings,
    questionCount: headings.filter((h) => h.isQuestion).length,
    blufCount: headings.filter((h) => h.hasBluf).length,
    tables: root.find('table').length, sizeTables, lists, internalLinks,
    images: imgs.length, imagesWithAlt: withAlt, videoCount,
    schemaTypes: allTypes, hasBuyAction, products,
    productLike: products.length > 0 || isProductUrl(pageUrl),
    faqs, hasFaqSchema: faqSchema.length > 0,
    social: detectSocial($full, pageUrl), nap, jsonld, summary
  };
}

/** Page-level GEO critique used by the extract_page_for_llm MCP tool. */
export function pageCritique(p: PageData): string[] {
  const c: string[] = [];
  if (!p.title) c.push('Missing <title>.');
  else if (p.title.length > 60) c.push(`Title is ${p.title.length} chars (target 60 or less).`);
  if (!p.description) c.push('Missing meta description.');
  else if (p.description.length > 160) c.push(`Meta description is ${p.description.length} chars (target 160 or less).`);
  if (p.headings.length && p.questionCount === 0) c.push('No question-style H1-H3 headings: add long-tail question headings.');
  if (p.questionCount > p.blufCount) c.push(`${p.questionCount - p.blufCount} question heading(s) lack a concise 30-75 word answer paragraph right below (BLUF).`);
  if (p.tables === 0) c.push('No comparison or specification tables.');
  if (p.productLike && p.products.length === 0) c.push('Looks like a product page but has no Product JSON-LD.');
  for (const pr of p.products) {
    const o = pr.offers[0];
    if (!o || !o.price || !o.currency) c.push(`Product "${pr.name ?? '?'}" lacks Offer price/currency.`);
    if (o && !o.availability) c.push(`Product "${pr.name ?? '?'}" lacks availability.`);
    if (!pr.brand) c.push(`Product "${pr.name ?? '?'}" lacks brand.`);
    if (!pr.material) c.push(`Product "${pr.name ?? '?'}" lacks material.`);
  }
  if (p.products.length && !p.hasBuyAction) c.push('No BuyAction/OrderAction for AI shopping agents.');
  if (p.products.length && p.sizeTables === 0) c.push('No size table found on a product page.');
  if (p.images > 0 && p.imagesWithAlt < p.images) c.push(`${p.images - p.imagesWithAlt} of ${p.images} images have no alt text.`);
  if (p.videoCount > 0 && !p.schemaTypes.includes('VideoObject')) c.push('Video present but no VideoObject JSON-LD.');
  if (p.responseMs > 2000) c.push(`Slow response: ${p.responseMs} ms (target under 2000 ms).`);
  if (p.mixedContent) c.push('Mixed content: http:// assets on an https:// page.');
  if (!p.hasViewport) c.push('Missing mobile viewport meta tag.');
  if (p.xRobotsTag && /(noai|noindex|noimageai)/i.test(p.xRobotsTag)) c.push(`X-Robots-Tag blocks AI/indexing: ${p.xRobotsTag}`);
  return c;
}
