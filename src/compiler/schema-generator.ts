import type { AuditResult } from '../types.js';
import { canonicalUrl, isOrgNode, typesOf } from '../extractor/entity-graph.js';

export function buildSchemaGraph(r: AuditResult): any {
  const existingOrg = r.pages.flatMap((p) => p.jsonld).find(isOrgNode) ?? {};
  const sameAs = new Map<string, string>();
  [...r.existingSameAs, ...r.social.map((s) => s.url)].forEach((u) => { if (!sameAs.has(canonicalUrl(u))) sameAs.set(canonicalUrl(u), u); });

  const org: any = { '@type': 'Organization', '@id': `${r.origin}/#organization`, name: r.nap.name || r.siteName, url: r.origin };
  if (existingOrg.logo) org.logo = existingOrg.logo;
  if (r.nap.phone) org.telephone = r.nap.phone;
  if (r.nap.email) org.email = r.nap.email;
  if (existingOrg.address && typeof existingOrg.address === 'object') org.address = existingOrg.address;
  else if (r.nap.address) org.address = { '@type': 'PostalAddress', streetAddress: r.nap.address };
  if (sameAs.size) org.sameAs = [...sameAs.values()];
  const rating = r.pages.flatMap((p) => p.jsonld).find((n) => n && n.aggregateRating)?.aggregateRating;
  if (rating) org.aggregateRating = rating;

  const site: any = { '@type': 'WebSite', '@id': `${r.origin}/#website`, url: r.origin, name: r.siteName, publisher: { '@id': org['@id'] } };

  const graph: any[] = [org, site];

  const faqs = [...new Map(r.pages.flatMap((p) => p.faqs).map((f) => [f.q, f])).values()].slice(0, 10);
  if (faqs.length) {
    graph.push({ '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }

  const prods = r.pages.flatMap((p) => p.products.map((x) => ({ x, url: p.url }))).filter(({ x }) => x.name).slice(0, 5);
  for (const { x, url } of prods) {
    const o = x.offers[0];
    const product: any = { '@type': 'Product', '@id': `${url}#product`, name: x.name, url };
    if (x.brand) product.brand = { '@type': 'Brand', name: x.brand };
    if (x.material) product.material = x.material;
    if (x.color) product.color = x.color;
    if (x.sku) product.sku = x.sku;
    if (o?.price && o.currency) {
      product.offers = {
        '@type': 'Offer', price: o.price, priceCurrency: o.currency, url,
        ...(o.availability ? { availability: `https://schema.org/${o.availability}` } : {}),
        potentialAction: { '@type': 'BuyAction', target: url }
      };
    }
    graph.push(product);
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export function buildSchemaFile(r: AuditResult): string {
  const json = JSON.stringify(buildSchemaGraph(r), null, 2);
  return `<script type="application/ld+json">\n${json}\n</script>\n`;
}
export { typesOf };
