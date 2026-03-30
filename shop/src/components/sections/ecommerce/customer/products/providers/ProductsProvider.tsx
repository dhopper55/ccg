import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { FieldValues, FormProvider, useForm } from 'react-hook-form';
import { ProductDetails } from 'types/ecommerce';

interface ProductsContextInterface {
  filterItems: { value: string; filter: string }[];
  visibleProducts: ProductDetails[];
  handleDeleteFilterItem: (item: { value: string; filter: string }) => void;
  handleResetFilters: () => void;
  handleProductsSort: (sortBy: string) => void;
}

export const ProductsContext = createContext({} as ProductsContextInterface);

const defaultFilterValues = {
  availability: [],
  sale: 'all',
  material: [],
  category: [],
  features: [],
  priceRange: [0, 5000],
};

const ProductsProvider = ({
  children,
  products,
}: PropsWithChildren<{ products: ProductDetails[] }>) => {
  const [visibleProducts, setVisibleProducts] = useState<ProductDetails[]>(products);
  const methods = useForm({
    defaultValues: defaultFilterValues,
  });
  const { setValue, getValues, reset, watch, handleSubmit } = methods;
  const formValues = getValues();

  const filterItems = useMemo(() => {
    return Object.keys(formValues).reduce(
      (acc: { value: string; filter: string }[], key) => {
        if (key === 'priceRange') {
          return acc;
        }

        if (Array.isArray(formValues[key])) {
          formValues[key].forEach((element: string) => {
            acc.push({
              value: element,
              filter: key,
            });
          });
          return acc;
        }

        if (typeof formValues[key] === 'string' && formValues[key] && formValues[key] !== 'all') {
          acc.push({
            value: formValues[key],
            filter: key,
          });
        }

        return acc;
      },
      [] as { value: string; filter: string }[],
    );
  }, [formValues]);

  const handleDeleteFilterItem = useCallback(
    (item: { value: string; filter: string }) => {
      if (!Array.isArray(formValues[item.filter])) {
        setValue(item.filter, item.filter === 'sale' ? 'all' : '');
        return;
      }

      setValue(
        item.filter,
        formValues[item.filter].filter((value: string) => value !== item.value),
      );
    },
    [formValues],
  );

  const handleProductsSort = useCallback(
    (sortBy: string) => {
      switch (sortBy) {
        case 'recommended':
          onSubmit(formValues);
          break;
        case 'lowToHight':
          setVisibleProducts((prev) =>
            [...prev].sort((a, b) => a.price.discounted - b.price.discounted),
          );
          break;
        case 'highToLow':
          setVisibleProducts((prev) =>
            [...prev].sort((a, b) => b.price.discounted - a.price.discounted),
          );
          break;
        case 'highestRated':
          setVisibleProducts((prev) => [...prev].sort((a, b) => b.ratings - a.ratings));
          break;
        default:
          onSubmit(formValues);
      }
    },
    [formValues],
  );

  const handleResetFilters = useCallback(() => {
    reset(defaultFilterValues);
  }, [reset]);

  const onSubmit = (data: FieldValues) => {
    const filteredProducts = products.filter((product) => {
      return Object.keys(data).every((key) => {
        if (key === 'priceRange') {
          const [min, max] = data[key];

          return product.price.discounted >= min && product.price.discounted <= max;
        }

        if (key === 'sale') {
          if (data[key] === 'all') {
            return true;
          }

          const isOnSale = product.price.regular > product.price.discounted;
          return data[key] === 'on-sale' ? isOnSale : !isOnSale;
        }

        if (Array.isArray(data[key])) {
          if (data[key].length === 0) {
            return true;
          }

          const productValues = product[key as keyof ProductDetails] as string[];

          return productValues.some((value: string) => data[key].includes(value));
        }

        return true;
      });
    });

    setVisibleProducts(filteredProducts);
  };

  useEffect(() => {
    setVisibleProducts(products);
  }, [products]);

  useEffect(() => {
    const subscription = watch(() => handleSubmit(onSubmit));

    return () => subscription.unsubscribe();
  }, [handleSubmit, watch]);

  return (
    <ProductsContext
      value={{
        filterItems,
        visibleProducts,
        handleDeleteFilterItem,
        handleResetFilters,
        handleProductsSort,
      }}
    >
      <FormProvider {...methods}>{children}</FormProvider>
    </ProductsContext>
  );
};

export const useProducts = () => useContext(ProductsContext);

export default ProductsProvider;
