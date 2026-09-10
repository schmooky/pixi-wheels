import { PIXI_WHEELS_VERSION } from './version.ts';

export const SITE = {
  name: 'pixi-wheels',
  url: 'https://pixi-wheels.pages.dev',
  author: 'pixi-wheels contributors',
  githubRepo: 'https://github.com/igaming-bulochka/pixi-wheels',
  tagline: 'Open-source bonus wheel engine for PixiJS v8',
  description:
    'Open-source bonus wheel engine for PixiJS v8. Fluent builder, typed events, velocity-matched stops, anticipation and near-miss styles, dynamic sectors, rings and subwheels, pointer flap physics, idle spin, and a headless testing harness. MIT licensed.',
  twitter: '',
  defaultImage: '/og.png',
};

/** Every route shares one OG card. */
export function ogUrlForPath(_pathname: string | undefined): string {
  return SITE.defaultImage;
}

export interface PageSeo {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  article?: {
    section?: string;
    tags?: string[];
    publishedTime?: string;
    modifiedTime?: string;
  };
  jsonLd?: unknown[];
  noIndex?: boolean;
}

export function canonical(path: string | undefined): string {
  if (!path) return SITE.url;
  return new URL(path, SITE.url).toString();
}

export function imageUrl(image: string | undefined): string {
  return new URL(image ?? SITE.defaultImage, SITE.url).toString();
}

export function softwareApplicationLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.name,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web Browser',
    description: SITE.description,
    url: SITE.url,
    downloadUrl: 'https://www.npmjs.com/package/pixi-wheels',
    softwareVersion: PIXI_WHEELS_VERSION,
    license: 'https://opensource.org/licenses/MIT',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Organization', name: SITE.author, url: SITE.githubRepo },
    codeRepository: SITE.githubRepo,
    programmingLanguage: 'TypeScript',
    requirements: 'PixiJS v8',
  };
}

export function softwareSourceCodeLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareSourceCode',
    name: SITE.name,
    description: SITE.description,
    codeRepository: SITE.githubRepo,
    programmingLanguage: 'TypeScript',
    runtimePlatform: 'Web Browser',
    license: 'https://opensource.org/licenses/MIT',
    url: SITE.url,
    version: PIXI_WHEELS_VERSION,
  };
}

export function articleLd(p: { title: string; description: string; path: string; image?: string }): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: p.title,
    description: p.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical(p.path) },
    image: imageUrl(p.image),
    author: { '@type': 'Organization', name: SITE.author, url: SITE.githubRepo },
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      logo: { '@type': 'ImageObject', url: imageUrl('/logo.svg') },
    },
  };
}

export function breadcrumbLd(crumbs: Array<{ name: string; url: string }>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(c.url, SITE.url).toString(),
    })),
  };
}

export function webSiteLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
    description: SITE.tagline,
    publisher: { '@type': 'Organization', name: SITE.name, url: SITE.githubRepo },
  };
}
