import {
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useSnackbar } from 'notistack';
import { trackShopAnalyticsEvent } from 'lib/shopAnalytics';
import { CartItem, Coupon, ProductDetails } from 'types/ecommerce';
import { useAssociateMode } from 'providers/AssociateModeProvider';

interface EcommerceContextInterface {
  product: CartItem | null;
  setProduct: Dispatch<SetStateAction<CartItem | null>>;
  cartItems: CartItem[];
  setCartItems: Dispatch<SetStateAction<CartItem[]>>;
  addItemToCart: (product: ProductDetails, quantity?: number) => void;
  removeItemFromCart: (productId: number) => void;
  updateCartItem: (itemId: number, updatedData: Partial<CartItem>) => void;
  appliedCoupon: Coupon | null;
  setAppliedCoupon: Dispatch<SetStateAction<Coupon | null>>;
  associateDiscount: number;
  setAssociateDiscount: Dispatch<SetStateAction<number>>;
  taxIncluded: boolean;
  setTaxIncluded: Dispatch<SetStateAction<boolean>>;
  cartSubTotal: number;
  cartTax: number;
  cartTaxRate: number;
  cartShipping: number;
  cartShippingLabel: '$6.00' | 'FREE' | 'IN-STORE' | '$0.00';
  cartShippingAddressRequired: boolean;
  cartHasLocalPickupOnlyItems: boolean;
  cartTotal: number;
}

export const EcommerceContext = createContext({} as EcommerceContextInterface);

const cartStorageKey = 'ccg-shop-cart';
const salesTaxRate = 0.0805;
const flatRateShipping = 6;
const freeShippingThreshold = 75;

const getInitialCartItems = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cartStorageKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const hydrateCartShippingFlags = async (items: CartItem[], signal: AbortSignal) => {
  const itemsMissingShipping = items.filter((item) => typeof item.allowShipping !== 'boolean');
  if (itemsMissingShipping.length === 0) return null;

  const updates = await Promise.all(
    itemsMissingShipping.map(async (item) => {
      try {
        const response = await fetch(`/api/shop/products/${encodeURIComponent(item.id)}`, {
          credentials: 'same-origin',
          signal,
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as { record?: { allowShipping?: boolean } };
        if (typeof payload.record?.allowShipping !== 'boolean') return null;
        return [item.id, payload.record.allowShipping] as const;
      } catch {
        return null;
      }
    }),
  );

  const shippingById = new Map(updates.filter((update): update is readonly [number, boolean] => update != null));
  return shippingById.size > 0 ? shippingById : null;
};

const EcommerceProvider = ({ children }: PropsWithChildren) => {
  const { enqueueSnackbar } = useSnackbar();
  const { isAssociateMode } = useAssociateMode();

  const [product, setProduct] = useState<CartItem | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>(getInitialCartItems);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [associateDiscount, setAssociateDiscount] = useState(0);
  const [taxIncluded, setTaxIncluded] = useState(false);

  const addItemToCart = useCallback(
    (product: ProductDetails, quantity = 1) => {
      const maxQuantity = Math.max(0, Number(product.stock || 0));
      if (maxQuantity <= 0) {
        enqueueSnackbar('This item is currently out of stock.', { variant: 'warning' });
        return;
      }
      const existingItem = cartItems.find((item) => item.id === product.id);
      const addQuantity = Math.max(1, Math.floor(quantity));
      const newQuantity = Math.min(
        existingItem ? existingItem.quantity + addQuantity : addQuantity,
        maxQuantity,
      );

      if (existingItem) {
        setCartItems((prev) =>
          prev.map((item) => (item.id === product.id ? { ...item, quantity: newQuantity } : item)),
        );
      } else {
        setCartItems((prev) => [...prev, { ...product, quantity: newQuantity, selected: true }]);
      }
      trackShopAnalyticsEvent({
        eventType: 'add_to_cart',
        inventoryItemId: product.id,
        metadata: {
          title: product.name,
          quantity: addQuantity,
          cartQuantity: newQuantity,
          price: product.price.discounted,
        },
      });
      enqueueSnackbar('Added to the cart successfully!', { variant: 'success' });
    },
    [cartItems],
  );

  const removeItemFromCart = useCallback(
    (productId: number) => {
      setCartItems(cartItems.filter((item) => item.id !== productId));
    },
    [cartItems],
  );

  const updateCartItem = useCallback(
    (itemId: number, updatedData: Partial<CartItem>) => {
      const updatedItems = cartItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...updatedData,
              quantity: updatedData.quantity
                ? Math.min(Math.max(1, updatedData.quantity), Math.max(1, Number(item.stock || 1)))
                : item.quantity,
            }
          : item,
      );
      setCartItems(updatedItems);
    },
    [cartItems],
  );

  const cartSubTotal = useMemo(
    () =>
      cartItems
        .filter((item) => item.selected)
        .reduce((acc, item) => {
          acc += item.price.discounted * item.quantity;

          return acc;
        }, 0),
    [cartItems],
  );

  const effectiveDiscount = associateDiscount > 0 ? associateDiscount : appliedCoupon?.appliedDiscount || 0;

  const cartShippingDetails = useMemo(() => {
    const selectedItems = cartItems.filter((item) => item.selected);
    const hasShippableItems = selectedItems.some((item) => Boolean(item.allowShipping));
    if (isAssociateMode) {
      return {
        amount: 0,
        label: 'IN-STORE' as const,
        addressRequired: false,
      };
    }
    if (!hasShippableItems) {
      return {
        amount: 0,
        label: '$0.00' as const,
        addressRequired: false,
      };
    }
    const thresholdSubtotal = Math.max(0, cartSubTotal - effectiveDiscount);
    if (thresholdSubtotal >= freeShippingThreshold) {
      return {
        amount: 0,
        label: 'FREE' as const,
        addressRequired: true,
      };
    }
    return {
      amount: flatRateShipping,
      label: '$6.00' as const,
      addressRequired: true,
    };
  }, [cartItems, cartSubTotal, effectiveDiscount, isAssociateMode]);

  const cartHasLocalPickupOnlyItems = useMemo(
    () => cartItems.some((item) => item.selected && item.allowShipping === false),
    [cartItems],
  );

  const cartTax = useMemo(() => {
    if (taxIncluded) return 0;
    const taxableTotal = Math.max(0, cartSubTotal - effectiveDiscount + cartShippingDetails.amount);
    return Math.round(taxableTotal * salesTaxRate * 100) / 100;
  }, [cartSubTotal, effectiveDiscount, cartShippingDetails.amount, taxIncluded]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubTotal - effectiveDiscount + cartShippingDetails.amount) + cartTax;
  }, [cartSubTotal, effectiveDiscount, cartShippingDetails.amount, cartTax]);

  useEffect(() => {
    setAppliedCoupon((prevCoupon) =>
      prevCoupon
        ? {
            ...prevCoupon,
            appliedDiscount:
              cartSubTotal > 0 ? Math.min(prevCoupon.discount, cartSubTotal) : 0,
          }
        : prevCoupon,
    );
  }, [cartSubTotal]);

  useEffect(() => {
    setAssociateDiscount((currentDiscount) =>
      cartSubTotal > 0 ? Math.min(currentDiscount, cartSubTotal) : 0,
    );
  }, [cartSubTotal]);

  useEffect(() => {
    const controller = new AbortController();
    void hydrateCartShippingFlags(cartItems, controller.signal).then((shippingById) => {
      if (!shippingById || controller.signal.aborted) return;
      setCartItems((currentItems) =>
        currentItems.map((item) =>
          shippingById.has(item.id)
            ? { ...item, allowShipping: shippingById.get(item.id) }
            : item,
        ),
      );
    });
    return () => controller.abort();
  }, [cartItems]);

  useEffect(() => {
    window.localStorage.setItem(cartStorageKey, JSON.stringify(cartItems));
  }, [cartItems]);

  return (
    <EcommerceContext
      value={{
        product,
        setProduct,
        cartItems,
        setCartItems,
        addItemToCart,
        removeItemFromCart,
        updateCartItem,
        appliedCoupon,
        setAppliedCoupon,
        associateDiscount,
        setAssociateDiscount,
        taxIncluded,
        setTaxIncluded,
        cartSubTotal,
        cartTax,
        cartTaxRate: salesTaxRate,
        cartShipping: cartShippingDetails.amount,
        cartShippingLabel: cartShippingDetails.label,
        cartShippingAddressRequired: cartShippingDetails.addressRequired,
        cartHasLocalPickupOnlyItems,
        cartTotal,
      }}
    >
      {children}
    </EcommerceContext>
  );
};

export const useEcommerce = () => use(EcommerceContext);

export default EcommerceProvider;
