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
import { CartItem, Coupon, ProductDetails } from 'types/ecommerce';

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
  cartSubTotal: number;
  cartTotal: number;
}

export const EcommerceContext = createContext({} as EcommerceContextInterface);

const cartStorageKey = 'ccg-shop-cart';

const getInitialCartItems = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cartStorageKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const EcommerceProvider = ({ children }: PropsWithChildren) => {
  const { enqueueSnackbar } = useSnackbar();

  const [product, setProduct] = useState<CartItem | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>(getInitialCartItems);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);

  const addItemToCart = useCallback(
    (product: ProductDetails, quantity = 1) => {
      const existingItem = cartItems.find((item) => item.id === product.id);
      const addQuantity = Math.max(1, Math.floor(quantity));
      const newQuantity = existingItem ? existingItem.quantity + addQuantity : addQuantity;

      if (existingItem) {
        setCartItems((prev) =>
          prev.map((item) => (item.id === product.id ? { ...item, quantity: newQuantity } : item)),
        );
      } else {
        setCartItems((prev) => [...prev, { ...product, quantity: newQuantity, selected: true }]);
      }
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
        item.id === itemId ? { ...item, ...updatedData } : item,
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

  const cartTotal = useMemo(() => {
    return cartSubTotal - (appliedCoupon?.appliedDiscount || 0);
  }, [cartSubTotal, appliedCoupon]);

  useEffect(() => {
    setAppliedCoupon((prevCoupon) =>
      prevCoupon
        ? {
            ...prevCoupon,
            appliedDiscount:
              (appliedCoupon?.appliedDiscount || 0) > cartSubTotal ? 0 : prevCoupon.discount,
          }
        : prevCoupon,
    );
  }, [cartSubTotal]);

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
        cartSubTotal,
        cartTotal,
      }}
    >
      {children}
    </EcommerceContext>
  );
};

export const useEcommerce = () => use(EcommerceContext);

export default EcommerceProvider;
