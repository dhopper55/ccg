// Lets the header's filter button open the product list's filter drawer. The header lives in
// the layout and the drawer in the Products page, so the page registers an opener while it is
// mounted; elsewhere (product pages, cart) the header falls back to the category drawer.
let opener: (() => void) | null = null;

export const registerShopFilterOpener = (open: () => void) => {
  opener = open;
  return () => {
    if (opener === open) opener = null;
  };
};

/** Opens the product filters if a product list is on screen; returns false otherwise. */
export const openShopFilters = () => {
  if (!opener) return false;
  opener();
  return true;
};
