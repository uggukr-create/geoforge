import type { FetchResult, Fetcher } from '../src/crawler/fetcher.js';

export const ORIGIN = 'https://shoes.example.com';

export const ROBOTS_BLOCK_ALL = `User-agent: *\nDisallow: /\n`;
export const ROBOTS_MIXED = `User-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: PerplexityBot\nDisallow: /\n\nUser-agent: *\nDisallow: /cart\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;

const BLUF1 = 'Crocs Classic Clogs are lightweight foam shoes made from Croslite material. They fit true to size for most adults, and people between sizes should go up to the next half size. The ventilation ports keep feet cool, so they work well for summer, beach days and long walks around town.';
const BLUF2 = 'Delivery across Ukraine by Nova Poshta usually takes one to three working days after the order is confirmed. Orders above 2000 UAH ship free, and you can inspect and try on the shoes at the post office before paying, so the risk of a wrong size is low.';

export const HOME_HTML = `<!doctype html><html lang="en"><head>
<title>Shoes Example | Crocs, sneakers and summer footwear</title>
<meta name="description" content="Original Crocs, sneakers and summer footwear with delivery across Ukraine.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Shoes Example","url":"${ORIGIN}","telephone":"+380 50 123 45 67","email":"hello@shoes.example.com","sameAs":["https://www.instagram.com/shoesexample"]},{"@type":"WebSite","url":"${ORIGIN}","name":"Shoes Example"}]}</script>
</head><body>
<div class="cookie-banner">We use cookies. Accept all cookies now.</div>
<nav><a href="/">Home</a><a href="/crocs">Crocs</a></nav>
<main>
<h1>Original Crocs and sneakers in Ukraine</h1>
<h2>What are Crocs Classic Clogs made of?</h2>
<p>${BLUF1}</p>
<h2>How long does delivery take?</h2>
<p>${BLUF2}</p>
<h2>Our advantages</h2>
<p>Short text.</p>
<ul><li>Original brands</li><li>Fast delivery</li><li>Easy returns</li></ul>
<table><caption>Size chart</caption><tr><th>EU size</th><th>Foot length cm</th></tr><tr><td>40</td><td>25.0</td></tr></table>
<img src="/a.jpg" alt="Crocs clog"><img src="/b.jpg">
</main>
<footer>
<a href="https://www.instagram.com/shoesexample/">Instagram</a>
<a href="https://www.tiktok.com/@shoesexample">TikTok</a>
<a href="https://www.youtube.com/@shoesexample">YouTube</a>
<a href="https://t.me/shoesexample">Telegram</a>
<a href="https://www.trustpilot.com/review/shoes.example.com">Trustpilot</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
<a href="tel:+380501234567">Call</a>
</footer></body></html>`;

export const PRODUCT_HTML = `<!doctype html><html lang="en"><head>
<title>Crocs Classic Clog Black</title>
<meta name="description" content="Crocs Classic Clog in black, Croslite, sizes 36-46.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Crocs Classic Clog Black","brand":{"@type":"Brand","name":"Crocs"},"material":"Croslite","color":"Black","sku":"CR-100","offers":{"@type":"Offer","price":"1899","priceCurrency":"UAH","availability":"https://schema.org/InStock","potentialAction":{"@type":"BuyAction","target":"${ORIGIN}/products/crocs-classic-black"}}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Do Crocs run small?","acceptedAnswer":{"@type":"Answer","text":"They fit true to size."}}]}</script>
</head><body><main>
<h1>Crocs Classic Clog Black</h1>
<h2>Which size should I order?</h2>
<p>${BLUF1}</p>
<table><tr><th>Size guide EU</th><th>Length cm</th></tr><tr><td>41</td><td>26</td></tr></table>
<img src="/c.jpg" alt="Black clog">
</main></body></html>`;

export const BAD_HTML = `<html><head><title>Home</title></head><body><div><h1>Welcome</h1><p>We sell things.</p></div></body></html>`;

export const SITEMAP = `<?xml version="1.0"?><urlset><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/products/crocs-classic-black</loc></url><url><loc>${ORIGIN}/privacy-policy</loc></url><url><loc>${ORIGIN}/crocs?page=2</loc></url></urlset>`;

export function res(url: string, status: number, body: string, headers: Record<string, string> = {}): FetchResult {
  return { url, finalUrl: url, status, ms: 120, headers, body, https: url.startsWith('https:') };
}

export function mockFetcher(map: Record<string, string>): Fetcher {
  return async (url: string) => {
    const path = url.replace(ORIGIN, '') || '/';
    const key = path === '' ? '/' : path;
    if (key in map) return res(url, 200, map[key], { 'content-type': key.endsWith('.xml') ? 'application/xml' : key.endsWith('.txt') ? 'text/plain' : 'text/html' });
    return res(url, 404, '');
  };
}
