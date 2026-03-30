import { PropsWithChildren, useEffect, useRef } from 'react';
import { Box, Stack } from '@mui/material';
import useSettingsPanelMountEffect from 'hooks/useSettingsPanelMountEffect';
import EcommerceProvider from 'providers/EcommerceProvider';
import { useSettingsContext } from 'providers/SettingsProvider';
import { mutate } from 'swr';
import EcommerceFooter from './EcommerceFooter';
import EcommerceAppbar from './app-bar';

const EcommerceLayout = ({ children }: PropsWithChildren) => {
  const {
    config: { navColor },
    setConfig,
  } = useSettingsContext();

  const navColorRef = useRef(navColor);

  useSettingsPanelMountEffect({
    disableNavigationMenuSection: true,
    disableSidenavShapeSection: true,
    disableTopShapeSection: true,
    disableNavColorSection: true,
  });

  useEffect(() => {
    setConfig({
      navColor: 'default',
    });

    return () => {
      setConfig({
        navColor: navColorRef.current,
      });
      // Clear the cache when the user navigates to a different layout
      mutate((key: any) => Array.isArray(key) && key[0].startsWith('e-commerce'), undefined, {
        revalidate: true,
      });
    };
  }, []);

  return (
    <EcommerceProvider>
      <Box sx={{ width: 1 }}>
        <Stack
          direction="column"
          sx={{
            p: 0,
            minHeight: '100vh',
            width: 1,
          }}
        >
          <EcommerceAppbar />
          <Stack direction="column" component="main" sx={{ flex: 1 }}>
            {children}
          </Stack>
          <EcommerceFooter />
        </Stack>
      </Box>
    </EcommerceProvider>
  );
};

export default EcommerceLayout;
