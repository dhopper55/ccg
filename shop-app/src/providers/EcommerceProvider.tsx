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
  taxIncluded: boolean;
  setTaxIncluded: (value: boolean) => void;
  otdMode: boolean;
  setOtdMode: (on: boolean) => void;
  otdEligible: boolean;
  otdExpensiveItemId: number | null;
  otdAdjustmentCents: number;
  cartSubTotal: number;
  cartTax: number;
  cartTaxRate: number;
  cartShippingLabel: 'FREE' | 'IN-STORE';
  cartShippingAddressRequired: boolean;
  cartHasLocalPickupOnlyItems: boolean;
  cartTotal: number;
}

export const EcommerceContext = createContext({} as EcommerceContextInterface);

const cartStorageKey = 'ccg-shop-cart';
const salesTaxRate = 0.0805;

const getInitialCartItems = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cartStorageKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const hydrateCartFlags = async (items: CartItem[], signal: AbortSignal) => {
  const itemsMissingFlags = items.filter(
    (item) => typeof item.allowShipping !== 'boolean' || typeof item.salesTaxIncluded !== 'boolean',
  );
  if (itemsMissingFlags.length === 0) return null;

  const updates = await Promise.all(
    itemsMissingFlags.map(async (item) => {
      try {
        const response = await fetch(`/api/shop/products/${encodeURIComponent(item.id)}`, {
          credentials: 'same-origin',
          signal,
        });
        if (!response.ok) return null;
        const payload = (await response.json()) as { record?: { allowShipping?: boolean; salesTaxIncluded?: boolean } };
        const { allowShipping, salesTaxIncluded } = payload.record ?? {};
        if (typeof allowShipping !== 'boolean' && typeof salesTaxIncluded !== 'boolean') return null;
        return [item.id, { allowShipping, salesTaxIncluded }] as const;
      } catch {
        return null;
      }
    }),
  );

  const flagsById = new Map(updates.filter((u): u is readonly [number, { allowShipping?: boolean; salesTaxIncluded?: boolean }] => u != null));
  return flagsById.size > 0 ? flagsById : null;
};

const EcommerceProvider = ({ children }: PropsWithChildren) => {
  const { enqueueSnackbar } = useSnackbar();
  const { isAssociateMode } = useAssociateMode();

  const [product, setProduct] = useState<CartItem | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>(getInitialCartItems);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [taxIncluded, setTaxIncludedState] = useState(false);
  const [otdMode, setOtdModeState] = useState(false);

  const setTaxIncluded = (value: boolean) => {
    setTaxIncludedState(value);
    if (value) setOtdModeState(false);
  };

  const setOtdMode = (on: boolean) => {
    setOtdModeState(on);
    if (on) setTaxIncludedState(false);
  };

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

  const originalCartSubTotal = useMemo(
    () =>
      cartItems
        .filter((item) => item.selected)
        .reduce((acc, item) => acc + item.price.discounted * item.quantity, 0),
    [cartItems],
  );

  const otdEligible = useMemo(
    () => cartItems.some((item) => item.selected && item.price.discounted > 100),
    [cartItems],
  );

  const otdExpensiveItemId = useMemo(() => {
    if (!otdMode || !otdEligible) return null;
    const selected = cartItems.filter((item) => item.selected);
    if (!selected.length) return null;
    return selected.reduce((best, item) =>
      item.price.discounted > best.price.discounted ? item : best,
    ).id;
  }, [otdMode, otdEligible, cartItems]);

  const otdAdjustmentCents = useMemo(() => {
    if (!otdMode || !otdEligible) return 0;
    // Only back out tax from taxable items (salesTaxIncluded=false)
    const taxableOrigCents = cartItems
      .filter((item) => item.selected && !item.salesTaxIncluded)
      .reduce((sum, item) => sum + Math.round(item.price.discounted * 100) * item.quantity, 0);
    return taxableOrigCents - Math.round(taxableOrigCents / (1 + salesTaxRate));
  }, [otdMode, otdEligible, cartItems]);

  const cartSubTotal = useMemo(() => {
    if (!otdMode || !otdEligible) return originalCartSubTotal;
    return (Math.round(originalCartSubTotal * 100) - otdAdjustmentCents) / 100;
  }, [otdMode, otdEligible, originalCartSubTotal, otdAdjustmentCents]);

  const effectiveDiscount = appliedCoupon?.appliedDiscount || 0;

  const cartShippingDetails = useMemo(() => {
    const selectedItems = cartItems.filter((item) => item.selected);
    const hasShippableItems = selectedItems.some((item) => Boolean(item.allowShipping));
    if (isAssociateMode || !hasShippableItems) {
      return {
        amount: 0,
        label: 'IN-STORE' as const,
        addressRequired: false,
      };
    }
    return {
      amount: 0,
      label: 'FREE' as const,
      addressRequired: true,
    };
  }, [cartItems, isAssociateMode]);

  const cartHasLocalPickupOnlyItems = useMemo(
    () => cartItems.some((item) => item.selected && item.allowShipping === false),
    [cartItems],
  );

  const cartTax = useMemo(() => {
    if (taxIncluded) return 0;
    // Only tax items where salesTaxIncluded is not true
    const taxableSubtotal = cartItems
      .filter((item) => item.selected && !item.salesTaxIncluded)
      .reduce((sum, item) => sum + item.price.discounted * item.quantity, 0);
    // Pro-rate discount across taxable items
    const taxableDiscount = originalCartSubTotal > 0
      ? effectiveDiscount * (taxableSubtotal / originalCartSubTotal)
      : 0;
    const taxableTotal = Math.max(0, taxableSubtotal - taxableDiscount + cartShippingDetails.amount);
    return Math.round(taxableTotal * salesTaxRate * 100) / 100;
  }, [cartItems, originalCartSubTotal, effectiveDiscount, cartShippingDetails.amount, taxIncluded]);

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
    if (!otdEligible) setOtdModeState(false);
  }, [otdEligible]);

  useEffect(() => {
    const controller = new AbortController();
    void hydrateCartFlags(cartItems, controller.signal).then((flagsById) => {
      if (!flagsById || controller.signal.aborted) return;
      setCartItems((currentItems) =>
        currentItems.map((item) => {
          const flags = flagsById.get(item.id);
          if (!flags) return item;
          return {
            ...item,
            ...(typeof flags.allowShipping === 'boolean' && { allowShipping: flags.allowShipping }),
            ...(typeof flags.salesTaxIncluded === 'boolean' && { salesTaxIncluded: flags.salesTaxIncluded }),
          };
        }),
      );
    });
    return () => controller.abort();
  }, [cartItems]);

  // Always re-fetch salesTaxIncluded from the server when the cart item set changes so admin
  // changes take effect on the next page load without requiring items to be re-added.
  const cartItemIdKey = cartItems.map((item) => item.id).join(',');
  useEffect(() => {
    if (!cartItemIdKey) return;
    const controller = new AbortController();
    const snapshot = cartItems;
    Promise.all(
      snapshot.map(async (item) => {
        try {
          const response = await fetch(`/api/shop/products/${encodeURIComponent(item.id)}`, {
            credentials: 'same-origin',
            signal: controller.signal,
          });
          if (!response.ok) return null;
          const payload = (await response.json()) as { record?: { salesTaxIncluded?: boolean } };
          const { salesTaxIncluded } = payload.record ?? {};
          if (typeof salesTaxIncluded !== 'boolean') return null;
          return [item.id, salesTaxIncluded] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const taxById = new Map(results.filter((r): r is readonly [number, boolean] => r != null));
      if (taxById.size === 0) return;
      setCartItems((current) =>
        current.map((item) => {
          const next = taxById.get(item.id);
          if (typeof next !== 'boolean' || item.salesTaxIncluded === next) return item;
          return { ...item, salesTaxIncluded: next };
        }),
      );
    });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItemIdKey]);

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
        taxIncluded,
        setTaxIncluded,
        otdMode,
        setOtdMode,
        otdEligible,
        otdExpensiveItemId,
        otdAdjustmentCents,
        cartSubTotal,
        cartTax,
        cartTaxRate: salesTaxRate,
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
