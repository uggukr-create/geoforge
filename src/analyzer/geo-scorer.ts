import type { Check, Fix, GeoScore, PageData, Pillar, RobotsAnalysis, SocialLink } from '../types.js';

export interface ScoreInput {
  robots: RobotsAnalysis;
  hasSitemap: boolean;
  hasLlmsTxt: boolean;
  pages: PageData[];
  existingSameAs: string[];
  social: SocialLink[];
  unlinkedSocial: SocialLink[];
  napConsistent: boolean;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

function chk(name: string, max: number, ratio: number, fix?: string, detail?: string): Check {
  const points = r1(max * clamp(ratio));
  return { name, points, max, detail, fix: points < max ? fix : undefined };
}

export function gradeFor(total: number): string {
  if (total >= 95) return 'A+';
  if (total >= 90) return 'A';
  if (total >= 85) return 'B+';
  if (total >= 80) return 'B';
  if (total >= 75) return 'C+';
  if (total >= 70) return 'C';
  if (total >= 60) return 'D';
  return 'F';
}

const pillar = (id: string, name: string, checks: Check[]): Pillar => ({
  id, name, checks, max: checks.reduce((s, c) => s + c.max, 0), score: r1(checks.reduce((s, c) => s + c.points, 0))
});

export function scoreSite(i: ScoreInput): GeoScore {
  const pages = i.pages;
  const n = Math.max(1, pages.length);
  const has = (t: string) => pages.some((p) => p.schemaTypes.includes(t));

  // Pillar 1: Technical and AI crawler accessibility
  const search = i.robots.bots.filter((b) => b.group === 'search');
  const blockedSearch = search.filter((b) => b.status === 'Blocked');
  const timed = pages.filter((p) => p.responseMs > 0);
  const avgMs = timed.length ? timed.reduce((s, p) => s + p.responseMs, 0) / timed.length : 0;
  const httpsOk = pages.filter((p) => p.https && !p.mixedContent).length / n;
  const xr = pages.some((p) => p.xRobotsTag && /(noai|noindex|noimageai)/i.test(p.xRobotsTag));
  const p1 = pillar('technical', 'Technical & AI Crawler Accessibility', [
    chk('AI search bots allowed in robots.txt', 8, (search.length - blockedSearch.length) / search.length,
      `Unblock these AI search bots in robots.txt: ${blockedSearch.map((b) => b.bot).join(', ')}. Use the generated robots.ai.txt.`,
      blockedSearch.length ? `Blocked: ${blockedSearch.map((b) => b.bot).join(', ')}` : 'No AI search bot is blocked'),
    chk('sitemap.xml present', 3, i.hasSitemap ? 1 : 0, 'Publish /sitemap.xml and reference it in robots.txt.'),
    chk('Response time under 2s', 3, avgMs <= 2000 ? 1 : avgMs <= 4000 ? 0.5 : 0, 'Improve server response time (cache, CDN). Target under 2000 ms.', `Average ${Math.round(avgMs)} ms`),
    chk('HTTPS without mixed content', 3, httpsOk, 'Serve every page over HTTPS and replace http:// assets.'),
    chk('Mobile viewport tag', 2, pages.filter((p) => p.hasViewport).length / n, 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'),
    chk('Clean X-Robots-Tag', 1, xr ? 0 : 1, 'Remove noai/noindex from X-Robots-Tag headers on pages you want cited.')
  ]);

  // Pillar 2: llms.txt and token hygiene
  const titles = pages.map((p) => p.title.trim().toLowerCase()).filter(Boolean);
  const descs = pages.map((p) => p.description.trim().toLowerCase()).filter(Boolean);
  const dupT = titles.length - new Set(titles).size;
  const dupD = descs.length - new Set(descs).size;
  const dupRatio = 1 - (dupT + dupD) / Math.max(1, titles.length + descs.length);
  const htmlSum = pages.reduce((s, p) => s + p.htmlChars, 0);
  const mdSum = pages.reduce((s, p) => s + p.markdown.length, 0);
  const snr = htmlSum ? mdSum / htmlSum : 0;
  const avgTokens = pages.reduce((s, p) => s + p.tokens, 0) / n;
  const p2 = pillar('llms', 'LLMs.txt & Token Context Hygiene', [
    chk('/llms.txt published', 8, i.hasLlmsTxt ? 1 : 0, 'Publish the generated llms.txt at the site root.'),
    chk('No duplicate titles or descriptions', 4, dupRatio, 'Make every page title and meta description unique.', `${dupT} duplicate titles, ${dupD} duplicate descriptions`),
    chk('Signal-to-noise ratio (clean text vs HTML)', 4, snr / 0.08, 'Reduce template noise: move navigation, banners and widgets out of the main content.', `${(snr * 100).toFixed(1)}% of HTML is useful text`),
    chk('Token budget efficiency', 4, avgTokens <= 4000 ? 1 : avgTokens <= 8000 ? 0.5 : 0, 'Split very long pages; keep key facts near the top.', `Average ${Math.round(avgTokens)} tokens per page`)
  ]);

  // Pillar 3: AEO content structure and BLUF
  const q = pages.reduce((s, p) => s + p.questionCount, 0);
  const hd = pages.reduce((s, p) => s + p.headings.length, 0);
  const bl = pages.reduce((s, p) => s + p.blufCount, 0);
  const goodMeta = pages.filter((p) => p.title && p.title.length <= 60 && p.description && p.description.length <= 160).length / n;
  const p3 = pillar('aeo', 'AEO Content Structure & BLUF Readiness', [
    chk('Question-based H1-H3 headings', 5, hd ? (q / hd) / 0.3 : 0, 'Phrase headings as real user questions (How, What, Which, Как, Який...).', `${q} of ${hd} headings are questions`),
    chk('BLUF answers under question headings', 5, q ? bl / q : 0, 'Put a direct 2-3 sentence answer (30-75 words) right under each question heading.', `${bl} of ${q} question headings have a BLUF answer`),
    chk('Comparison / specification tables', 3, pages.some((p) => p.tables > 0) ? 1 : 0, 'Add comparison or specification tables (sizes, materials, models).'),
    chk('Structured bullet lists', 2, pages.some((p) => p.lists > 0) ? 1 : 0, 'Use bullet lists for specs and steps.'),
    chk('FAQ sections', 3, pages.some((p) => p.faqs.length > 0) ? (pages.some((p) => p.hasFaqSchema) ? 1 : 0.6) : 0, 'Add an FAQ section and mark it up with FAQPage JSON-LD.'),
    chk('Title <=60 and description <=160 chars', 2, goodMeta, 'Shorten titles to 60 chars and descriptions to 160 chars.')
  ]);

  // Pillar 4: E-commerce and Schema.org depth
  const productPages = pages.filter((p) => p.productLike);
  const validProducts = pages.filter((p) => p.products.some((x) => x.offers.some((o) => o.price && o.currency && o.availability)));
  const hasEcom = productPages.length > 0;
  const withProducts = pages.filter((p) => p.products.length > 0);
  const imgTotal = pages.reduce((s, p) => s + p.images, 0);
  const altTotal = pages.reduce((s, p) => s + p.imagesWithAlt, 0);
  const p4 = pillar('schema', 'E-Commerce & Schema.org Depth', [
    chk('Organization / LocalBusiness JSON-LD', 4, ['Organization', 'LocalBusiness', 'Store', 'OnlineStore', 'Corporation'].some(has) ? 1 : 0, 'Add Organization JSON-LD (use geo-schema.jsonld).'),
    chk('WebSite JSON-LD', 2, has('WebSite') ? 1 : 0, 'Add WebSite JSON-LD with SearchAction.'),
    chk('Product + Offer with price, currency, availability', 5, hasEcom ? validProducts.length / productPages.length : 1,
      'Add Product JSON-LD with Offer (price, priceCurrency, availability), brand and material on every product page.',
      hasEcom ? `${validProducts.length} of ${productPages.length} product pages are complete` : 'No product pages detected'),
    chk('BuyAction / OrderAction', 2, hasEcom ? (withProducts.some((p) => p.hasBuyAction) ? 1 : 0) : 1, 'Add potentialAction BuyAction to Product/Offer for AI shopping agents.'),
    chk('FAQPage JSON-LD', 2, has('FAQPage') ? 1 : 0, 'Add FAQPage JSON-LD matching the visible FAQ.'),
    chk('HowTo / Article / VideoObject JSON-LD', 2, ['HowTo', 'Article', 'BlogPosting', 'VideoObject'].some(has) ? 1 : 0, 'Mark up guides as Article/HowTo and videos as VideoObject.'),
    chk('Image alt coverage', 3, imgTotal ? altTotal / imgTotal : 1, 'Add descriptive alt text to every image.', `${altTotal} of ${imgTotal} images have alt text`)
  ]);

  // Pillar 5: Brand authority and entity graph
  const sameAsCount = i.existingSameAs.length;
  const linked = i.social.length - i.unlinkedSocial.length;
  const napPresent = pages.some((p) => p.nap.phone || p.nap.email);
  const rated = pages.some((p) => p.jsonld.some((n) => n && (n.aggregateRating || (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]).includes('AggregateRating'))));
  const p5 = pillar('entity', 'Brand Authority & Entity Graph', [
    chk('sameAs links in JSON-LD (target 5+)', 10, sameAsCount / 5, 'Add all official profiles (Instagram, TikTok, YouTube, Telegram, Trustpilot, Google Business...) to Organization.sameAs.', `${sameAsCount} sameAs links`),
    chk('Social links on site are linked in sameAs', 2, i.social.length ? linked / i.social.length : 0, i.social.length ? `Add to sameAs: ${i.unlinkedSocial.map((s) => s.url).join(', ')}` : 'Link your official social profiles from the site footer.'),
    chk('NAP data present and consistent', 4, napPresent ? (i.napConsistent ? 1 : 0.4) : 0, 'Publish one consistent phone, email and address across all pages and in JSON-LD.'),
    chk('AggregateRating / review signals', 4, rated ? 1 : 0, 'Add AggregateRating from real reviews (Trustpilot, Google) to JSON-LD.')
  ]);

  const pillars = [p1, p2, p3, p4, p5];
  const total = Math.round(pillars.reduce((s, p) => s + p.score, 0));
  const fixes: Fix[] = pillars
    .flatMap((p) => p.checks.filter((c) => c.fix).map((c) => ({ pillar: p.name, impact: r1(c.max - c.points), fix: c.fix as string })))
    .sort((a, b) => b.impact - a.impact);
  return { total, grade: gradeFor(total), pillars, fixes };
}
