#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import { buildArtifacts, runAudit, writeArtifacts } from './pipeline.js';
import { terminalSummary } from './compiler/report-generator.js';

const program = new Command();
program.name('geoforge').description('GEO/AEO auditor, llms.txt compiler and MCP server').version('0.1.0');

program.command('audit <target>')
  .description('Audit a URL (or local HTML file/directory) for GEO/AEO readiness')
  .option('--max-pages <n>', 'maximum pages to analyze', '25')
  .option('--json', 'print the full result as JSON')
  .action(async (target: string, o: { maxPages: string; json?: boolean }) => {
    const r = await runAudit(target, { maxPages: Number(o.maxPages) });
    if (o.json) { const { pages, ...rest } = r; console.log(JSON.stringify({ ...rest, pages: pages.map(({ markdown, jsonld, ...p }) => p) }, null, 2)); }
    else console.log(terminalSummary(r));
  });

program.command('build <target>')
  .description('Crawl a site and write llms.txt, llms-full.txt, geo-schema.jsonld, robots.ai.txt, geo-audit-report.md')
  .option('--out <dir>', 'output directory', './geoforge-output')
  .option('--max-pages <n>', 'maximum pages to crawl', '50')
  .option('--max-index-tokens <n>', 'token cap for llms.txt', '6000')
  .option('--max-full-tokens <n>', 'token cap for llms-full.txt', '80000')
  .option('--allow-training', 'allow AI training scrapers in robots.ai.txt')
  .action(async (target: string, o: { out: string; maxPages: string; maxIndexTokens: string; maxFullTokens: string; allowTraining?: boolean }) => {
    const r = await runAudit(target, { maxPages: Number(o.maxPages) });
    const art = buildArtifacts(r, { allowTraining: o.allowTraining, maxIndexTokens: Number(o.maxIndexTokens), maxFullTokens: Number(o.maxFullTokens) });
    const written = await writeArtifacts(resolve(o.out), art.files);
    console.log(terminalSummary(r));
    console.log(`\nWrote ${written.length} files to ${resolve(o.out)}`);
    console.log(`llms.txt: ~${art.stats.indexTokens} tokens | llms-full.txt: ~${art.stats.fullTokens} tokens (${art.stats.pages} pages)`);
  });

program.command('mcp')
  .description('Start the stdio MCP server (Claude Code, Claude Desktop, Cursor)')
  .action(async () => { const { startMcpServer } = await import('./mcp.js'); await startMcpServer(); });

program.parseAsync(process.argv).catch((e) => { console.error(`geoforge: ${(e as Error).message}`); process.exit(1); });
