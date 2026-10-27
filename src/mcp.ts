import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve } from 'node:path';
import { buildArtifacts, resolveTarget, runAudit, writeArtifacts } from './pipeline.js';
import { analyzeRobots, generateRobotsAi } from './crawler/robots.js';
import { analyzePage, pageCritique } from './extractor/page-classifier.js';

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const fail = (e: unknown) => ({ content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }], isError: true });

export function createServer(): McpServer {
  const server = new McpServer({ name: 'geoforge', version: '0.1.0' });
  const s = server as any;

  s.tool('audit_site_geo', 'Run a full GEO/AEO readiness audit on a URL or local HTML file/directory. Returns the 5-pillar score, AI bot matrix, BLUF analysis, entity graph and prioritized fixes.',
    { target: z.string().describe('Site URL, or path to a local HTML file or directory'), max_pages: z.number().int().min(1).max(200).default(25) },
    async ({ target, max_pages }: { target: string; max_pages: number }) => {
      try {
        const r = await runAudit(target, { maxPages: max_pages });
        const q = r.pages.reduce((a, p) => a + p.questionCount, 0);
        const b = r.pages.reduce((a, p) => a + p.blufCount, 0);
        return text(JSON.stringify({
          site: r.origin, score: r.score.total, grade: r.score.grade,
          pillars: r.score.pillars.map((p) => ({ name: p.name, score: p.score, max: p.max })),
          botMatrix: r.robots.bots.map((x) => ({ bot: x.bot, group: x.group, status: x.status })),
          bluf: { questionHeadings: q, withBlufAnswer: b },
          entityGraph: { sameAs: r.existingSameAs, discoveredProfiles: r.social, unlinked: r.unlinkedSocial, nap: r.nap, napConsistent: r.napConsistent },
          hasLlmsTxt: r.hasLlmsTxt, hasSitemap: r.hasSitemap, pagesAnalyzed: r.pages.length,
          fixes: r.score.fixes.slice(0, 15)
        }, null, 2));
      } catch (e) { return fail(e); }
    });

  s.tool('generate_geo_artifacts', 'Crawl a site and write llms.txt, llms-full.txt, geo-schema.jsonld, robots.ai.txt and geo-audit-report.md to disk. Returns token statistics.',
    { target: z.string(), out_dir: z.string().default('./geoforge-output'), max_pages: z.number().int().min(1).max(500).default(50),
      max_index_tokens: z.number().int().default(6000), max_full_tokens: z.number().int().default(80000), allow_training: z.boolean().default(false) },
    async (a: { target: string; out_dir: string; max_pages: number; max_index_tokens: number; max_full_tokens: number; allow_training: boolean }) => {
      try {
        const r = await runAudit(a.target, { maxPages: a.max_pages });
        const art = buildArtifacts(r, { allowTraining: a.allow_training, maxIndexTokens: a.max_index_tokens, maxFullTokens: a.max_full_tokens });
        const written = await writeArtifacts(resolve(a.out_dir), art.files);
        return text(JSON.stringify({ score: r.score.total, grade: r.score.grade, written, tokens: art.stats }, null, 2));
      } catch (e) { return fail(e); }
    });

  s.tool('analyze_robots_ai', 'Inspect a domain robots.txt for 7 AI Search bots and 7 AI Training bots and output an optimized robots.ai.txt.',
    { domain: z.string().describe('Domain or URL, e.g. example.com'), allow_training: z.boolean().default(false) },
    async ({ domain, allow_training }: { domain: string; allow_training: boolean }) => {
      try {
        const { fetcher, origin } = await resolveTarget(domain);
        const res = await fetcher(`${origin}/robots.txt`);
        const analysis = analyzeRobots(res.status === 200 && !/<html/i.test(res.body) ? res.body : null);
        const optimized = generateRobotsAi({ origin, allowTraining: allow_training, sitemaps: analysis.sitemaps });
        return text(JSON.stringify({ origin, found: analysis.found, bots: analysis.bots, issues: analysis.issues, xRobotsTag: res.headers['x-robots-tag'] ?? null }, null, 2) + '\n\n--- optimized robots.ai.txt ---\n' + optimized);
      } catch (e) { return fail(e); }
    });

  s.tool('extract_page_for_llm', 'Fetch a single URL (product card, blog post), clean the DOM, check BLUF structure, extract JSON-LD, FAQs, pricing and social links, and return clean Markdown with a GEO critique.',
    { url: z.string().url() },
    async ({ url }: { url: string }) => {
      try {
        const { fetcher } = await resolveTarget(url);
        const res = await fetcher(url);
        if (res.status !== 200) return fail(new Error(`HTTP ${res.status} ${res.error ?? ''}`));
        const p = analyzePage(res);
        const meta = { url: p.url, title: p.title, tier: p.tier, tokens: p.tokens, products: p.products, faqs: p.faqs, schemaTypes: p.schemaTypes, social: p.social, nap: p.nap,
          headings: { questions: p.questionCount, withBluf: p.blufCount }, critique: pageCritique(p) };
        return text(JSON.stringify(meta, null, 2) + '\n\n--- clean markdown ---\n' + p.markdown);
      } catch (e) { return fail(e); }
    });

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createServer();
  await server.connect(new StdioServerTransport());
}
