// Reverb API integration for Coal Creek Guitars listings
export {};

interface ReverbListing {
  id: number;
  title: string;
  price: {
    amount: string;
    currency: string;
    symbol: string;
  };
  photos: Array<{
    _links: {
      large_crop: { href: string };
      small_crop: { href: string };
      full: { href: string };
    };
  }>;
  _links: {
    web: { href: string };
  };
}

interface ReverbResponse {
  listings: ReverbListing[];
  total: number;
}

const REVERB_API_TOKEN = '91712608fefe08e6915c2d781519411af3bdd750818a8edc94d94e14a3d7c491';
const REVERB_API_URL = 'https://api.reverb.com/api/my/listings';

async function fetchListings(): Promise<ReverbListing[]> {
  const response = await fetch(REVERB_API_URL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/hal+json',
      'Accept': 'application/hal+json',
      'Accept-Version': '3.0',
      'Authorization': `Bearer ${REVERB_API_TOKEN}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch listings: ${response.status} ${response.statusText}`);
  }

  const data: ReverbResponse = await response.json();
  return data.listings || [];
}

function formatPrice(price: ReverbListing['price']): string {
  const amount = parseFloat(price.amount);
  if (!Number.isFinite(amount)) {
    return price.symbol ? `${price.symbol}${price.amount}` : `$${price.amount}`;
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    const formattedAmount = amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return price.symbol ? `${price.symbol}${formattedAmount}` : `$${formattedAmount}`;
  }
}

function getShippingAmount(listing: ReverbListing): number | null {
  const shipping = (listing as { shipping?: any }).shipping;
  if (!shipping) return null;

  if (shipping.rate?.amount) {
    return parseFloat(shipping.rate.amount);
  }

  if (shipping.cost?.amount) {
    return parseFloat(shipping.cost.amount);
  }

  if (shipping.price?.amount) {
    return parseFloat(shipping.price.amount);
  }

  if (Array.isArray(shipping.rates)) {
    const preferredRate =
      shipping.rates.find((rate: any) => rate.region_code === 'US_CON' || rate.region_code === 'US') ||
      shipping.rates[0];

    if (preferredRate?.rate?.amount) {
      return parseFloat(preferredRate.rate.amount);
    }
  }

  return null;
}

function createListingCard(listing: ReverbListing): HTMLElement {
  const card = document.createElement('a');
  card.className = 'listing-card';
  card.href = listing._links.web.href;
  card.target = '_blank';
  card.rel = 'noopener noreferrer';

  // Get the image URL (prefer large_crop, fallback to small_crop or full)
  let imageUrl = '';
  if (listing.photos && listing.photos.length > 0) {
    const photo = listing.photos[0];
    imageUrl = photo._links.large_crop?.href ||
               photo._links.small_crop?.href ||
               photo._links.full?.href || '';
  }

  // Format price
  const priceDisplay = formatPrice(listing.price);
  const shippingAmount = getShippingAmount(listing);
  const shippingDisplay = shippingAmount === 0 ? '<p class="listing-shipping">Free Shipping</p>' : '';

  card.innerHTML = `
    <div class="listing-image">
      ${imageUrl
        ? `<img src="${imageUrl}" alt="${listing.title}" loading="lazy">`
        : `<div class="listing-placeholder"><span>No Image</span></div>`
      }
    </div>
    <div class="listing-info">
      <h3 class="listing-title">${listing.title}</h3>
      <div class="listing-price-group">
        <p class="listing-price">${priceDisplay}</p>
        ${shippingDisplay}
      </div>
    </div>
  `;

  return card;
}

function showError(message: string): void {
  const errorEl = document.getElementById('listings-error');
  const loadingEl = document.getElementById('listings-loading');

  if (loadingEl) loadingEl.classList.add('hidden');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }
}

function showEmpty(): void {
  const emptyEl = document.getElementById('listings-empty');
  const loadingEl = document.getElementById('listings-loading');

  if (loadingEl) loadingEl.classList.add('hidden');
  if (emptyEl) emptyEl.classList.remove('hidden');
}

function renderListings(listings: ReverbListing[]): void {
  const gridEl = document.getElementById('listings-grid');
  const loadingEl = document.getElementById('listings-loading');

  if (loadingEl) loadingEl.classList.add('hidden');

  if (!gridEl) return;

  if (listings.length === 0) {
    showEmpty();
    return;
  }

  gridEl.innerHTML = '';
  listings.forEach(listing => {
    const card = createListingCard(listing);
    gridEl.appendChild(card);
  });
}

function sortListingsByPrice(listings: ReverbListing[]): ReverbListing[] {
  return [...listings].sort((a, b) => {
    const aPrice = parseFloat(a.price.amount);
    const bPrice = parseFloat(b.price.amount);
    return bPrice - aPrice;
  });
}

// Initialize on page load
async function init(): Promise<void> {
  try {
    const listings = await fetchListings();
    const sortedListings = sortListingsByPrice(listings);
    renderListings(sortedListings);
  } catch (error) {
    console.error('Error fetching Reverb listings:', error);
    showError('Unable to load listings. Please try again later.');
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
