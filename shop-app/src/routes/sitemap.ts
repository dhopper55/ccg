import { SxProps } from '@mui/material';

export interface SubMenuItem {
  name: string;
  pathName: string;
  key?: string;
  selectionPrefix?: string;
  path?: string;
  active?: boolean;
  icon?: string;
  iconSx?: SxProps;
  items?: SubMenuItem[];
}

export interface MenuItem {
  id: string;
  key?: string;
  subheader: string;
  icon: string;
  iconSx?: SxProps;
  items: SubMenuItem[];
}

const sitemap: MenuItem[] = [
  {
    id: 'shop',
    subheader: 'Shop',
    icon: 'material-symbols:storefront-outline-rounded',
    items: [
      {
        name: 'Guitars & Gear for Sale',
        key: 'inventory',
        path: 'https://www.coalcreekguitars.com/guitars-and-gear-for-sale/',
        pathName: 'inventory',
        icon: 'material-symbols:storefront-outline-rounded',
        active: true,
      },
      {
        name: 'Financing',
        key: 'financing',
        path: 'https://www.coalcreekguitars.com/musical-gear-financing/',
        pathName: 'financing',
        icon: 'material-symbols:payments-outline-rounded',
        active: true,
      },
    ],
  },
  {
    id: 'sell',
    subheader: 'Sell or Consign',
    icon: 'material-symbols:sell-outline',
    items: [
      {
        name: 'We Buy Used Gear',
        key: 'we_buy',
        path: 'https://www.coalcreekguitars.com/we-buy-music-gear-denver-englewood/',
        pathName: 'we-buy',
        icon: 'material-symbols:sell-outline',
        active: true,
      },
      {
        name: 'Consignment',
        key: 'consignment',
        path: 'https://www.coalcreekguitars.com/denver-area-music-gear-consignment/',
        pathName: 'consignment',
        icon: 'material-symbols:handshake-outline-rounded',
        active: true,
      },
    ],
  },
  {
    id: 'services',
    subheader: 'Services',
    icon: 'material-symbols:build-outline-rounded',
    items: [
      {
        name: 'Repair Services & Pricing',
        key: 'repair',
        path: 'https://www.coalcreekguitars.com/guitar-repair-services-pricing/',
        pathName: 'repair',
        icon: 'material-symbols:build-outline-rounded',
        active: true,
      },
      {
        name: "What's My Guitar Worth?",
        key: 'valuations',
        path: 'https://www.coalcreekguitars.com/guitar-value-report-evaluation/',
        pathName: 'valuations',
        icon: 'material-symbols:price-check-rounded',
        active: true,
      },
      {
        name: 'Guitar Authenticity Report',
        key: 'authenticity',
        path: 'https://www.coalcreekguitars.com/guitar-authenticity-report/',
        pathName: 'authenticity',
        icon: 'material-symbols:verified-user-outline-rounded',
        active: true,
      },
      {
        name: 'Serial Number Decoders',
        key: 'serial_decoders',
        path: 'https://www.coalcreekguitars.com/decoders/guitar-serial-decoder-lookup/',
        pathName: 'serial-decoders',
        icon: 'material-symbols:qr-code-2-rounded',
        active: true,
      },
    ],
  },
  {
    id: 'about',
    subheader: 'Coal Creek Guitars',
    icon: 'material-symbols:home-outline-rounded',
    items: [
      {
        name: 'Home',
        key: 'home',
        path: 'https://www.coalcreekguitars.com/',
        pathName: 'home',
        icon: 'material-symbols:home-outline-rounded',
        active: true,
      },
      {
        name: 'About Us',
        key: 'about_us',
        path: 'https://www.coalcreekguitars.com/about-us',
        pathName: 'about-us',
        icon: 'material-symbols:info-outline-rounded',
        active: true,
      },
      {
        name: 'Our Neighborhood',
        key: 'neighborhood',
        path: 'https://www.coalcreekguitars.com/ccg-englewood-broadway-gothic-theatre-history',
        pathName: 'neighborhood',
        icon: 'material-symbols:location-on-outline',
        active: true,
      },
      {
        name: 'FAQ',
        key: 'faq',
        path: 'https://www.coalcreekguitars.com/faq/',
        pathName: 'faq',
        icon: 'material-symbols:help-outline-rounded',
        active: true,
      },
      {
        name: 'Contact Us',
        key: 'contact_us',
        path: 'https://www.coalcreekguitars.com/contact-us',
        pathName: 'contact-us',
        icon: 'material-symbols:mail-outline-rounded',
        active: true,
      },
    ],
  },
];

export default sitemap;
