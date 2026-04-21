import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://ainovel.waitli.top').replace(/\/+$/, '');

type SeoOptions = {
  title: string;
  description: string;
  lang?: string;
  path?: string;
  noindex?: boolean;
  enableHreflang?: boolean;
};

function normalizeLang(lang?: string): 'zh' | 'en' {
  return String(lang || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function trimDescription(text: string): string {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 160) return cleaned;
  return `${cleaned.slice(0, 157)}...`;
}

function toAbsoluteUrl(pathname: string, lang: 'zh' | 'en'): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const url = new URL(normalizedPath, SITE_URL);
  url.searchParams.set('lang', lang);
  return url.toString();
}

function upsertMetaByName(name: string, content: string): void {
  let tag = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string): void {
  let tag = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertAlternate(hreflang: string, href: string): void {
  let link = document.head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('data-seo-managed', '1');
    link.setAttribute('hreflang', hreflang);
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function clearManagedAlternates(): void {
  const links = document.head.querySelectorAll('link[rel="alternate"][data-seo-managed="1"]');
  links.forEach((node) => node.remove());
}

export function useSeo({
  title,
  description,
  lang,
  path,
  noindex = false,
  enableHreflang = true,
}: SeoOptions): void {
  const location = useLocation();
  const normalizedLang = normalizeLang(lang);
  const pathname = path || location.pathname || '/';

  useEffect(() => {
    const safeTitle = title.trim() || 'AI Novel Platform';
    const safeDescription = trimDescription(description || 'Reader-driven AI novel creation platform.');
    const canonicalUrl = toAbsoluteUrl(pathname, normalizedLang);

    document.title = safeTitle;
    document.documentElement.lang = normalizedLang === 'zh' ? 'zh-CN' : 'en';

    upsertMetaByName('description', safeDescription);
    upsertMetaByName('robots', noindex ? 'noindex,nofollow' : 'index,follow');
    upsertMetaByProperty('og:title', safeTitle);
    upsertMetaByProperty('og:description', safeDescription);
    upsertMetaByProperty('og:type', 'website');
    upsertMetaByProperty('og:url', canonicalUrl);
    upsertCanonical(canonicalUrl);

    clearManagedAlternates();
    if (enableHreflang && !noindex) {
      const enHref = toAbsoluteUrl(pathname, 'en');
      const zhHref = toAbsoluteUrl(pathname, 'zh');
      upsertAlternate('en', enHref);
      upsertAlternate('zh-CN', zhHref);
      upsertAlternate('x-default', enHref);
    }
  }, [title, description, normalizedLang, pathname, noindex, enableHreflang]);
}
