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
  associateDiscount: number;
  setAssociateDiscount: Dispatch<SetStateAction<number>>;
  taxIncluded: boolean;
  setTaxIncluded: Dispatch<SetStateAction<boolean>>;
  cartSubTotal: number;
  cartTax: number;
  cartTaxRate: number;
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

const EcommerceProvider = ({ children }: PropsWithChildren) => {
  const { enqueueSnackbar } = useSnackbar();

  const [product, setProduct] = useState<CartItem | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>(getInitialCartItems);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [associateDiscount, setAssociateDiscount] = useState(0);
  const [taxIncluded, setTaxIncluded] = useState(false);

  const addItemToCart = useCallback(
    (product: ProductDetails, quantity = 1) => {
      const existingItem = cartItems.find((item) => item.id === product.id);
      const addQuantity = Math.max(1, Math.floor(quantity));
      const maxQuantity = Math.max(1, Number(product.stock || 1));
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

  const cartTax = useMemo(() => {
    if (taxIncluded) return 0;
    const effectiveDiscount = associateDiscount > 0 ? associateDiscount : appliedCoupon?.appliedDiscount || 0;
    const taxableTotal = Math.max(0, cartSubTotal - effectiveDiscount);
    return Math.round(taxableTotal * salesTaxRate * 100) / 100;
  }, [cartSubTotal, appliedCoupon, associateDiscount, taxIncluded]);

  const cartTotal = useMemo(() => {
    const effectiveDiscount = associateDiscount > 0 ? associateDiscount : appliedCoupon?.appliedDiscount || 0;
    return Math.max(0, cartSubTotal - effectiveDiscount) + cartTax;
  }, [cartSubTotal, appliedCoupon, associateDiscount, cartTax]);

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
        cartTotal,
      }}
    >
      {children}
    </EcommerceContext>
  );
};

export const useEcommerce = () => use(EcommerceContext);

export default EcommerceProvider;
