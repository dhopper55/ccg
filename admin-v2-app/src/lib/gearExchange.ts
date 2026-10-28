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

// GX listing page (the seller sees the same page with edit controls).
export function getGxListingUrl(gxListingId: number | string): string {
  return `https://www.sweetwater.com/used/listings/${encodeURIComponent(String(gxListingId))}`;
}
