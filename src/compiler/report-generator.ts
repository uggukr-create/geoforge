import type { AuditResult } from '../types.js';

const bar = (s: number, m: number) => '#'.repeat(Math.round((s / m) * 10)).padEnd(10, '.');

export function buildReport(r: AuditResult): string {
  const L: string[] = [];
  L.push(`# GEO/AEO Audit Report: ${r.siteName}`, '', `- Site: ${r.origin}`, `- Generated: ${r.generatedAt}`, `- Pages analyzed: ${r.pages.length}`, '');
  L.push(`## GEO/AEO Readiness Score: ${r.score.total}/100 (grade ${r.score.grade})`, '');
  L.push('| Pillar | Score | |', '|---|---|---|');
  for (const p of r.score.pillars) L.push(`| ${p.name} | ${p.score}/${p.max} | \`${bar(p.score, p.max)}\` |`);
  L.push('', '## AI Bot Access Matrix', '');
  L.push(`robots.txt found: ${r.robots.found ? 'yes' : 'no'}`, '', '| Bot | Vendor | Group | Status |', '|---|---|---|---|');
  for (const b of r.robots.bots) L.push(`| ${b.bot} | ${b.vendor} | ${b.group === 'search' ? 'AI Search (should be allowed)' : 'AI Training (owner choice)'} | ${b.status} |`);
  if (r.robots.issues.length) L.push('', ...r.robots.issues.map((i) => `- ${i}`));
  const q = r.pages.reduce((s, p) => s + p.questionCount, 0);
  const b = r.pages.reduce((s, p) => s + p.blufCount, 0);
  const h = r.pages.reduce((s, p) => s + p.headings.length, 0);
  L.push('', '## BLUF and Question Heading Analysis', '', `- Question headings: ${q} of ${h} (${h ? Math.round((q / h) * 100) : 0}%)`, `- Question headings with a concise BLUF answer: ${b} of ${q}`);
  const weak = r.pages.filter((p) => p.questionCount > p.blufCount).slice(0, 8);
  for (const p of weak) L.push(`  - ${p.url}: ${p.questionCount - p.blufCount} heading(s) without BLUF`);
  L.push('', '## Entity Graph and Social Proof', '', `- sameAs links in JSON-LD: ${r.existingSameAs.length}`, `- Profiles discovered on site: ${r.social.length}`);
  for (const s of r.social) L.push(`  - ${s.platform}: ${s.url}${r.unlinkedSocial.some((u) => u.url === s.url) ? ' (NOT in sameAs, injected into geo-schema.jsonld)' : ''}`);
  L.push(`- NAP: ${[r.nap.name, r.nap.phone, r.nap.email, r.nap.address].filter(Boolean).join(' | ') || 'not found'} (consistent: ${r.napConsistent ? 'yes' : 'no'})`);
  if (r.rating) L.push(`- AggregateRating: ${r.rating.value}${r.rating.count ? ` from ${r.rating.count} reviews` : ''}`);
  L.push('', '## E-Commerce Schema Checklist', '', '| Page | Product | Offer | Availability | Brand | Material | BuyAction | Size table |', '|---|---|---|---|---|---|---|---|');
  const prodPages = r.pages.filter((p) => p.productLike);
  const yn = (v: any) => (v ? 'yes' : 'NO');
  for (const p of prodPages.slice(0, 40)) {
    const x = p.products[0]; const o = x?.offers[0];
    L.push(`| ${p.url} | ${yn(x)} | ${yn(o?.price && o?.currency)} | ${yn(o?.availability)} | ${yn(x?.brand)} | ${yn(x?.material)} | ${yn(p.hasBuyAction)} | ${yn(p.sizeTables)} |`);
  }
  if (!prodPages.length) L.push('| (no product pages detected) | | | | | | | |');
  L.push('', '## Prioritized Fix Guide', '');
  r.score.fixes.forEach((f, i) => L.push(`${i + 1}. **(+${f.impact} pts)** ${f.fix} _(${f.pillar})_`));
  if (!r.score.fixes.length) L.push('No fixes needed.');
  L.push('', '## Detailed Checks', '');
  for (const p of r.score.pillars) {
    L.push(`### ${p.name} (${p.score}/${p.max})`, '');
    for (const c of p.checks) L.push(`- ${c.points >= c.max ? '[x]' : '[ ]'} ${c.name}: ${c.points}/${c.max}${c.detail ? ' (' + c.detail + ')' : ''}`);
    L.push('');
  }
  return L.join('\n');
}

export function terminalSummary(r: AuditResult): string {
  const L = [`GEO/AEO Readiness: ${r.score.total}/100 (${r.score.grade})  ${r.origin}`, ''];
  for (const p of r.score.pillars) L.push(`  ${p.name.padEnd(42)} ${String(p.score).padStart(5)}/${p.max}  ${bar(p.score, p.max)}`);
  const blocked = r.robots.bots.filter((b) => b.group === 'search' && b.status === 'Blocked').map((b) => b.bot);
  L.push('', `AI search bots blocked: ${blocked.length ? blocked.join(', ') : 'none'}`, `Pages analyzed: ${r.pages.length}`, '', 'Top fixes:');
  r.score.fixes.slice(0, 5).forEach((f, i) => L.push(`  ${i + 1}. (+${f.impact}) ${f.fix}`));
  return L.join('\n');
}
