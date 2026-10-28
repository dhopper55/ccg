// Sweetwater Gear Exchange (GX) display helpers shared by the inventory and order screens.

export const GX_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  pending_admin_review: 'In GX review',
  published: 'Live',
  sold: 'Sold',
};

export function gxStatusLabel(status: string | null | undefined): string {
  return GX_STATUS_LABEL[status || ''] || status || 'Linked';
}

// GX listing page (the seller sees the same page with edit controls). GX's URL is
// /used/listings/{id}-used-{title with brand, slugged}, e.g.
// /used/listings/543242-used-gator-gbe-elect-electric-guitar-gig-bag-10mm-padded-new.
// GX prefixes the brand to the title unless the title already starts with it.
export function getGxListingUrl(gxListingId: number | string, title = '', brand = ''): string {
  const titleWithBrand = brand && !title.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${title}` : title;
  const slug = `used ${titleWithBrand}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const id = encodeURIComponent(String(gxListingId));
  return `https://www.sweetwater.com/used/listings/${titleWithBrand.trim() ? `${id}-${slug}` : id}`;
}
