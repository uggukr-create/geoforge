# geoforge

[![CI](https://github.com/uggukr-create/geoforge/actions/workflows/ci.yml/badge.svg)](https://github.com/uggukr-create/geoforge/actions)
![license](https://img.shields.io/badge/license-MIT-blue)
![node](https://img.shields.io/badge/node-%3E%3D18-green)

Open-source **GEO/AEO** (Generative and Answer Engine Optimization) auditor, `llms.txt` compiler and **MCP server**.
Optimize websites and online stores for ChatGPT Search, Google AI Overviews, Claude and Perplexity. Runs 100% locally, no paid API.

## Why

Naive `llms.txt` generators dump dirty HTML into one file. Commercial GEO platforms charge $100-500 per month and only point at problems. geoforge audits your site and **compiles the files you actually deploy**:

| File | What it is |
|---|---|
| `llms.txt` | Spec-style index with key facts, prices, categories and an *Official Brand Channels, Social Proof & Authority* section |
| `llms-full.txt` | Clean Markdown knowledge base, ordered by semantic tier, hard token budget |
| `geo-schema.jsonld` | Ready-to-embed JSON-LD: Organization (with merged `sameAs`), WebSite, FAQPage, Product/Offer/BuyAction |
| `robots.ai.txt` | Rules that keep AI **search** bots allowed, block junk URLs, and (by default) block AI **training** scrapers |
| `geo-audit-report.md` | 0-100 GEO/AEO Readiness Score, bot matrix, BLUF analysis, entity graph, e-commerce checklist, prioritized fixes |

## Architecture

```text
crawler (robots, sitemap, fetcher)
   -> extractor (dom-cleaner, entity-graph, page-classifier)
      -> analyzer (token-counter, geo-scorer)
         -> compiler (llms-txt, schema-generator, report-generator)
CLI (commander)  and  MCP server (@modelcontextprotocol/sdk) share src/pipeline.ts
```

## Usage

```bash
npm install && npm run build
node dist/cli.js audit https://your-shop.com --max-pages 25
node dist/cli.js build https://your-shop.com --out ./geoforge-output --max-full-tokens 80000
node dist/cli.js build ./my-static-site            # local HTML file or directory also works
node dist/cli.js build https://your-shop.com --allow-training
```

Options: `--max-pages`, `--max-index-tokens` (default 6000), `--max-full-tokens` (default 80000), `--allow-training`, `--json` (audit).
During development use `npx tsx src/cli.ts ...`.

## MCP server

Claude Code:

```bash
claude mcp add geoforge -- node /absolute/path/to/geoforge/dist/cli.js mcp
```

Claude Desktop / Cursor (`mcpServers` config):

```json
{ "mcpServers": { "geoforge": { "command": "node", "args": ["/absolute/path/to/geoforge/dist/cli.js", "mcp"] } } }
```

Tools: `audit_site_geo`, `generate_geo_artifacts`, `analyze_robots_ai`, `extract_page_for_llm`.

## Methodology

1. **Technical and AI crawler access (20)**: 7 AI search bots (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Applebot) must be allowed; 7 training scrapers (GPTBot, ClaudeBot, Google-Extended, CCBot, Meta-ExternalAgent, Bytespider, Amazonbot) are the owner's choice. Also sitemap, response time under 2 s, HTTPS, mixed content, viewport, X-Robots-Tag.
2. **LLMs.txt and token hygiene (20)**: llms.txt presence, duplicate titles and descriptions, signal-to-noise ratio, tokens per page.
3. **AEO content structure (20)**: question headings, BLUF answers (30-75 words directly under a heading), tables, lists, FAQ, title and description length.
4. **E-commerce and Schema.org depth (20)**: Organization, WebSite, Product/Offer, BuyAction/OrderAction, FAQPage, HowTo/Article/VideoObject, image alt coverage.
5. **Brand authority and entity graph (20)**: `sameAs` completeness, social profiles found on the site but missing from `sameAs`, NAP consistency, AggregateRating.

Token counts are offline estimates (about 4 chars per token for Latin text, 2 for Cyrillic), good enough for budgeting, not exact tokenizer output.

## Development

```bash
npm run typecheck && npm run build && npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CLAUDE.md](CLAUDE.md). MIT licensed.
