import { SyntheticEvent, useEffect, useRef, useState } from 'react';
import { Box, Divider, Paper, Tab, Tabs, Toolbar } from '@mui/material';
import { productSpecifications } from 'data/e-commerce/products';
import ProductDescription from './ProductDescription';
import ProductSpecification from './ProductSpecification';

interface ProductInformationProps {
  description?: string;
}

const ProductInformation = ({ description }: ProductInformationProps) => {
  const [activeTab, setActiveTab] = useState('desc');

  const refs = {
    desc: useRef<HTMLDivElement | null>(null),
    specs: useRef<HTMLDivElement | null>(null),
  };
  const tabsRef = useRef<HTMLDivElement | null>(null);

  const handleScroll = () => {
    const tabBottom = tabsRef.current?.getBoundingClientRect().bottom || 0;
    const scrollPos = window.scrollY + tabBottom + 40;
    const specsOffset = refs.specs.current?.offsetTop || 0;
    setActiveTab(scrollPos >= specsOffset ? 'specs' : 'desc');
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleTabChange = (event: SyntheticEvent, newValue: string) => {
    setActiveTab(newValue);
    const top =
      (refs[newValue as keyof typeof refs].current?.offsetTop || 0) -
      (tabsRef.current?.offsetHeight || 0) -
      160;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <Paper sx={{ p: { xs: 3, md: 5 } }}>
      <Box
        ref={tabsRef}
        sx={(theme) => ({
          width: 1,
          position: 'sticky',
          zIndex: 10,
          py: 1,
          top: theme.mixins.ecommerceTopbar,
          bgcolor: 'background.default',
        })}
      >
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="product information tabs">
          <Tab value="desc" label="Description" />
          <Tab value="specs" label="Specification" />
        </Tabs>
      </Box>
      <Toolbar sx={{ minHeight: { xs: 40 } }} />
      <div ref={refs.desc}>
        <ProductDescription description={description} />
      </div>
      <Divider sx={{ my: 5 }} />
      <div ref={refs.specs}>
        <ProductSpecification specifications={productSpecifications} />
      </div>
    </Paper>
  );
};

export default ProductInformation;
