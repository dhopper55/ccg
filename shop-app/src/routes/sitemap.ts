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
    id: 'pages',
    subheader: '',
    key: 'pages',
    icon: 'material-symbols:view-quilt-outline',
    items: [
      {
        name: 'Home',
        key: 'home',
        path: 'https://www.coalcreekguitars.com',
        pathName: 'home',
        icon: 'material-symbols:home-outline-rounded',
        active: true,
      },
      {
        name: 'Serial Number Decoders',
        key: 'serial_decoders',
        path: 'https://www.coalcreekguitars.com/decoders/guitar-serial-decoder-lookup',
        pathName: 'serial-decoders',
        icon: 'material-symbols:qr-code-2-rounded',
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
