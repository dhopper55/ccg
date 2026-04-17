'use client';

import { ChangeEvent } from 'react';
import {
  Box,
  Button,
  InputAdornment,
  Stack,
  Toolbar,
  inputBaseClasses,
} from '@mui/material';
import MuiAppBar from '@mui/material/AppBar';
import Grid from '@mui/material/Grid';
import { useSearchParams } from 'react-router';
import SearchTextField from 'layouts/main-layout/common/search-box/SearchTextField';
import { useBreakpoints } from 'providers/BreakpointsProvider';
import { useSettingsContext } from 'providers/SettingsProvider';
import IconifyIcon from 'components/base/IconifyIcon';
import Logo from 'components/common/Logo';

const PrimaryAppbar = ({ children }: { children: React.ReactNode }) => {
  const { up } = useBreakpoints();
  const { handleDrawerToggle } = useSettingsContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchValue = searchParams.get('search') ?? '';

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    const value = event.target.value;
    if (value.trim()) {
      nextSearchParams.set('search', value);
    } else {
      nextSearchParams.delete('search');
    }
    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <MuiAppBar>
      <Toolbar
        component="nav"
        variant="appbar"
        sx={{ px: { xs: 3, md: 5 }, py: { xs: 1, md: 0 }, minHeight: { md: 78 } }}
      >
        <Grid
          container
          spacing={{ xs: 1, md: 2 }}
          sx={{
            width: 1,
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Grid size="auto">
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                color="neutral"
                variant="soft"
                shape="circle"
                aria-label="open drawer"
                onClick={handleDrawerToggle}
              >
                <IconifyIcon icon="material-symbols:menu-rounded" sx={{ fontSize: 20 }} />
              </Button>
              <Logo showName={up('sm')} />
            </Stack>
          </Grid>
          <Grid
            sx={{ flexGrow: { xs: 1 } }}
            size={{
              xs: 12,
              md: 'auto',
            }}
          >
            <Stack
              spacing={{ xs: 1, lg: 2 }}
              sx={{
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Stack spacing={0.5} sx={{ width: 1, maxWidth: { lg: 602 } }}>
                <Box
                  sx={({ vars }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    width: 1,
                    borderRadius: 6,
                    backgroundColor: 'action.hover',
                    overflow: 'hidden',
                    transition: 'background-color .1s ease, border-color .1s ease',
                    border: '1px solid transparent',
                    '&:has(form:hover):not(:has(form:focus-within))': {
                      backgroundColor: 'background.elevation3',
                    },
                    [`&:has(.${inputBaseClasses.root}.${inputBaseClasses.focused})`]: {
                      backgroundColor: 'primary.lighter',
                      borderColor: 'primary.main',
                    },
                  })}
                >
                  <SearchTextField
                    component="form"
                    value={searchValue}
                    onChange={handleSearchChange}
                    onSubmit={(event) => event.preventDefault()}
                    sx={{
                      flexGrow: 1,
                      [`& .${inputBaseClasses.root}`]: {
                        p: 0,
                        borderRadius: 0,
                        border: 'none',
                        '&:after': { display: 'none' },
                        '&.Mui-focused': { boxShadow: 'none' },
                        '&.Mui-focused:hover': { bgcolor: 'transparent !important' },
                        '&.Mui-active': { bgcolor: 'transparent !important' },
                      },
                      [`& .${inputBaseClasses.input}`]: {
                        pl: '16px !important',
                      },
                    }}
                    placeholder="Search product"
                    slotProps={{
                      input: {
                        inputProps: { style: { fontSize: 14 } },
                        startAdornment: null,
                        endAdornment: (
                          <InputAdornment position="end" sx={{ mr: 2 }}>
                            <IconifyIcon
                              icon="material-symbols:search-rounded"
                              sx={{ fontSize: 20, color: 'text.secondary' }}
                            />
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Box>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </Toolbar>
      {children}
    </MuiAppBar>
  );
};

export default PrimaryAppbar;
