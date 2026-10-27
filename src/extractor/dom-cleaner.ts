import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const NOISE = [
  'script', 'style', 'noscript', 'iframe', 'svg', 'nav', 'footer', 'aside', 'form', 'template',
  '[role=navigation]', '[role=banner] nav', '[role=dialog]', '[aria-modal=true]', '[aria-hidden=true]',
  '[class*=cookie]', '[id*=cookie]', '[class*=consent]', '[id*=consent]', '[class*=modal]', '[class*=popup]',
  '[class*=newsletter]', '[class*=breadcrumb]', '[class*=sidebar]', '[class*=advert]', '[id^=ad-]', '[class^=ad-]'
].join(',');

let td: TurndownService | null = null;
function turndown(): TurndownService {
  if (td) return td;
  td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-', emDelimiter: '*' });
  td.use(gfm);
  td.remove(['script', 'style', 'img', 'picture', 'button']);
  return td;
}

export type CheerioAPI = cheerio.CheerioAPI;

export interface CleanResult { $: CheerioAPI; root: ReturnType<CheerioAPI> ; markdown: string }

/** GFM tables need a header row: promote the first row to <thead> when a table has none, and keep captions as text. */
function normalizeTables($: CheerioAPI): void {
  $('table').each((_, t) => {
    const table = $(t);
    const caption = table.children('caption').first();
    if (caption.length) {
      const text = caption.text().trim();
      caption.remove();
      if (text) table.before(`<p>${text}</p>`);
    }
    if (table.find('thead').length) return;
    const first = table.find('tr').first();
    if (!first.length) return;
    first.find('td').each((__, td) => { td.tagName = 'th'; });
    const head = $('<thead></thead>');
    head.append(first.clone());
    first.remove();
    table.prepend(head);
  });
}

export function cleanDom(html: string): CleanResult {
  const $ = cheerio.load(html);
  $(NOISE).remove();
  normalizeTables($);
  let root = $('main, article, [role=main]').first();
  if (root.length === 0) root = $('body').first();
  if (root.length === 0) root = $.root() as any;
  const inner = root.html() ?? '';
  let markdown = turndown().turndown(inner);
  markdown = markdown.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').trim();
  return { $, root, markdown };
}
