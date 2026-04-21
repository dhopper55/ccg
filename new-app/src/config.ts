import { mainDrawerWidth } from 'lib/constants';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemePreset =
  | 'default-light'
  | 'default-dark'
  | 'luxury'
  | 'retro'
  | 'arctic'
  | 'nature'
  | 'ember'
  | 'dracula'
  | 'midnight';

export type NavigationMenuType = 'sidenav' | 'topnav' | 'combo';
export type SidenavType = 'default' | 'stacked' | 'slim';
export type TopnavType = 'default' | 'stacked' | 'slim';
export type TextDirection = 'ltr' | 'rtl';
export type NavColor = 'default' | 'vibrant';
export type SupportedLocales = 'en-US' | 'fr-FR' | 'bn-BD' | 'zh-CN' | 'hi-IN' | 'ar-SA';

export const fontFamilies = ['Plus Jakarta Sans', 'Inter', 'Roboto', 'DM Sans'] as const;

export type FontFamily = (typeof fontFamilies)[number];

export interface Config {
  assetsDir: string;
  textDirection: TextDirection;
  navigationMenuType: NavigationMenuType;
  sidenavType: SidenavType;
  sidenavCollapsed: boolean;
  topnavType: TopnavType;
  navColor: NavColor;
  openNavbarDrawer: boolean;
  drawerWidth: number;
  locale: SupportedLocales;
  themePreset: ThemePreset;
  primaryColor?: string | null;
  fontFamily: FontFamily;
  fontSize: number;
}

export const initialConfig: Config = {
  assetsDir: import.meta.env.VITE_ASSET_BASE_URL ?? '',
  textDirection: 'ltr',
  navigationMenuType: 'sidenav',
  sidenavType: 'default',
  sidenavCollapsed: false,
  topnavType: 'default',
  navColor: 'default',
  openNavbarDrawer: false,
  drawerWidth: mainDrawerWidth.full,
  locale: 'en-US',
  themePreset: 'default-dark',
  primaryColor: null,
  fontFamily: fontFamilies[0],
  fontSize: 16,
};

export const defaultJwtAuthCredentials = {
  email: 'demo@aurora.com',
  password: 'password123',
};
