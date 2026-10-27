# CLAUDE.md: geoforge

geoforge is a local-first GEO/AEO auditor, llms.txt compiler and MCP server (TypeScript, Node >= 18). No paid APIs.

## Commands
- `npm install`: install dependencies
- `npm run typecheck`: strict TypeScript check
- `npm run build`: compile to `dist/`
- `npm test`: Vitest (all tests are offline, fixtures live in `tests/fixtures.ts`)
- `npx tsx src/cli.ts audit <url|path>` / `build <url|path> --out ./out` / `mcp`

## Architecture (data flows left to right)
`crawler/` (robots, sitemap, fetcher) -> `extractor/` (dom-cleaner, entity-graph, page-classifier) -> `analyzer/` (token-counter, geo-scorer) -> `compiler/` (llms-txt, schema-generator, report-generator).
`src/pipeline.ts` wires everything: `runAudit()` returns an `AuditResult`, `buildArtifacts()` turns it into the 5 output files. `cli.ts` and `mcp.ts` are thin wrappers over the pipeline.

## Rules
- Network access goes only through the `Fetcher` type (`crawler/fetcher.ts`). Tests inject a mock fetcher; never hit the network in tests.
- A local file or directory is served by `createLocalFetcher` as `https://local.test`.
- Scoring: 5 pillars x 20 points. Every check carries a `fix` string used for the prioritized fix list.
- Tiers: 1 core pages, 2 catalog and guides, 3 noise and legal (never fetched or compiled).
- Token limits are enforced by `estimateTokens`/`truncateToTokens`. Respect `--max-index-tokens` and `--max-full-tokens`.
- Style: strict TS, ESM with `.js` import suffixes, no `TODO` stubs, no em dashes or en dashes anywhere (use hyphens, colons, commas).
- Every new heuristic needs a unit test with an offline HTML fixture.
