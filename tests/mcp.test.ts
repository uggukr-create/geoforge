import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from '../src/mcp.js';
import { HOME_HTML, PRODUCT_HTML } from './fixtures.js';

async function connect() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  await server.connect(b);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(a);
  return client;
}
const textOf = (r: any) => r.content[0].text as string;

describe('MCP server', () => {
  it('exposes the four geoforge tools', async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['analyze_robots_ai', 'audit_site_geo', 'extract_page_for_llm', 'generate_geo_artifacts']);
  });

  it('audits a local directory and writes artifacts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gf-site-'));
    await mkdir(join(dir, 'products'));
    await writeFile(join(dir, 'index.html'), HOME_HTML.replace('<nav>', '<nav><a href="/products/crocs-classic-black">p</a>'));
    await writeFile(join(dir, 'products', 'crocs-classic-black.html'), PRODUCT_HTML);
    const c = await connect();
    const audit = JSON.parse(textOf(await c.callTool({ name: 'audit_site_geo', arguments: { target: dir } })));
    expect(audit.score).toBeGreaterThan(30);
    expect(audit.botMatrix).toHaveLength(14);
    expect(audit.entityGraph.unlinked.length).toBeGreaterThan(0);

    const out = join(dir, 'out');
    const gen = JSON.parse(textOf(await c.callTool({ name: 'generate_geo_artifacts', arguments: { target: dir, out_dir: out } })));
    expect(gen.written).toHaveLength(5);
    expect(await readFile(join(out, 'llms.txt'), 'utf8')).toContain('Official Brand Channels');
  });

  it('returns an error result for an unreachable target', async () => {
    const c = await connect();
    const r: any = await c.callTool({ name: 'audit_site_geo', arguments: { target: '/definitely/not/here' } });
    expect(r.isError).toBe(true);
  });
});
