import { useEffect } from 'react';

const preloadCache = new Set<string>();

function preloadUrl(url: string): void {
  if (preloadCache.has(url)) return;
  preloadCache.add(url);
  const img = new Image();
  img.src = url;
}

export function usePreloadAssets(urls: string[]) {
  useEffect(() => {
    urls.forEach(preloadUrl);
  }, []);
}
