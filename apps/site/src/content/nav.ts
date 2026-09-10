export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const GUIDES_NAV: NavSection[] = [
  {
    title: 'Start here',
    items: [
      { label: 'Getting started', href: '/guides/getting-started/' },
      { label: 'Your first wheel', href: '/guides/your-first-wheel/' },
    ],
  },
  {
    title: 'Building blocks',
    items: [
      { label: 'Spin lifecycle', href: '/guides/spin-lifecycle/' },
      { label: 'Sections and arcs', href: '/guides/sections/' },
      { label: 'Landing and settle', href: '/guides/landing/' },
      { label: 'Anticipation', href: '/guides/anticipation/' },
      { label: 'Dynamic sections', href: '/guides/dynamic-sections/' },
      { label: 'Rings and subwheels', href: '/guides/rings/' },
      { label: 'Pointers', href: '/guides/pointers/' },
      { label: 'Idle spin', href: '/guides/idle/' },
      { label: 'Skins, textures and Spine', href: '/guides/skins/' },
      { label: 'Server adapters', href: '/guides/adapters/' },
      { label: 'Events and audio', href: '/guides/events-and-audio/' },
      { label: 'Configs and templates', href: '/guides/configs/' },
    ],
  },
  {
    title: 'For authors',
    items: [
      { label: 'Testing', href: '/guides/testing/' },
      { label: 'Debugging', href: '/guides/debugging/' },
      { label: 'Studio', href: '/guides/studio/' },
    ],
  },
];

export const WIKI_NAV: NavSection[] = [
  {
    title: 'API guides',
    items: [
      { label: 'Builder', href: '/docs/api-builder/' },
      { label: 'Wheel and Ring', href: '/docs/api-wheel/' },
      { label: 'Events', href: '/docs/api-events/' },
      { label: 'Spin profiles', href: '/docs/api-profiles/' },
    ],
  },
  {
    title: 'Full reference',
    items: [
      { label: 'API index (TypeDoc)', href: '/api/' },
      { label: 'Glossary', href: '/docs/glossary/' },
      { label: 'Changelog', href: '/changelog/' },
    ],
  },
];
