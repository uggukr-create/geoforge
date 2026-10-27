export type BotStatus = 'Allowed' | 'Blocked' | 'Unspecified';
export type BotGroup = 'search' | 'training';
export interface BotRule { bot: string; vendor: string; group: BotGroup; status: BotStatus }
export interface RobotsAnalysis { found: boolean; bots: BotRule[]; sitemaps: string[]; issues: string[] }

export type Tier = 1 | 2 | 3;
export interface OfferInfo { price?: string; currency?: string; availability?: string }
export interface ProductInfo { name?: string; brand?: string; material?: string; color?: string; sku?: string; url?: string; offers: OfferInfo[] }
export interface SocialLink { platform: string; url: string }
export interface NapData { name?: string; address?: string; phone?: string; email?: string }
export interface HeadingInfo { level: number; text: string; isQuestion: boolean; hasBluf: boolean }
export interface FaqItem { q: string; a: string }

export interface PageData {
  url: string;
  status: number;
  responseMs: number;
  https: boolean;
  mixedContent: boolean;
  hasViewport: boolean;
  xRobotsTag?: string;
  title: string;
  description: string;
  h1: string;
  tier: Tier;
  markdown: string;
  tokens: number;
  htmlChars: number;
  headings: HeadingInfo[];
  questionCount: number;
  blufCount: number;
  tables: number;
  sizeTables: number;
  lists: number;
  internalLinks: number;
  images: number;
  imagesWithAlt: number;
  videoCount: number;
  schemaTypes: string[];
  hasBuyAction: boolean;
  products: ProductInfo[];
  productLike: boolean;
  faqs: FaqItem[];
  hasFaqSchema: boolean;
  social: SocialLink[];
  nap: NapData;
  jsonld: any[];
  summary: string;
}

export interface Check { name: string; points: number; max: number; detail?: string; fix?: string }
export interface Pillar { id: string; name: string; score: number; max: number; checks: Check[] }
export interface Fix { pillar: string; impact: number; fix: string }
export interface GeoScore { total: number; grade: string; pillars: Pillar[]; fixes: Fix[] }

export interface AuditResult {
  target: string;
  origin: string;
  siteName: string;
  generatedAt: string;
  robots: RobotsAnalysis;
  hasSitemap: boolean;
  hasLlmsTxt: boolean;
  pages: PageData[];
  social: SocialLink[];
  unlinkedSocial: SocialLink[];
  existingSameAs: string[];
  nap: NapData;
  napConsistent: boolean;
  rating?: { value: string; count?: string };
  score: GeoScore;
}

export interface BuildOptions { allowTraining?: boolean; maxIndexTokens?: number; maxFullTokens?: number }
export interface AuditOptions { maxPages?: number; concurrency?: number; userAgent?: string; fetcher?: import('./crawler/fetcher.js').Fetcher }
