import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { slugifyCategory } from 'lib/utils';
import ProductsProvider from 'components/sections/ecommerce/customer/products/providers/ProductsProvider';
import { Products } from './Products';

type CategoryNode = {
  id: number;
  name: string;
  children?: CategoryNode[];
};

function flattenCategories(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flattenCategories(node.children ?? [])]);
}

const CategoryPage = () => {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [categoryName, setCategoryName] = useState('');

  useEffect(() => {
    if (!categorySlug) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/shop/categories');
        const data = (await res.json()) as { tree?: CategoryNode[] };
        if (cancelled) return;
        const all = flattenCategories(Array.isArray(data.tree) ? data.tree : []);
        const matched = all.find((node) => slugifyCategory(node.name) === categorySlug);
        if (matched) setCategoryName(matched.name);
      } catch { /* best effort */ }
    };
    void load();
    return () => { cancelled = true; };
  }, [categorySlug]);

  useEffect(() => {
    const title = categoryName
      ? `${categoryName} | Coal Creek Guitars`
      : 'Guitars and Gear for Sale | Coal Creek Guitars';
    document.title = title;
    return () => {
      document.title = 'Guitars and Gear for Sale | Coal Creek Guitars';
    };
  }, [categoryName]);

  return (
    <ProductsProvider products={[]}>
      <Products initialCategorySlug={categorySlug} />
    </ProductsProvider>
  );
};

export default CategoryPage;
