import { SxProps } from '@mui/material';
import paths, { rootPaths } from './paths';

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
  key?: string; // used for the locale
  subheader: string;
  icon: string;
  iconSx?: SxProps;
  items: SubMenuItem[];
}

const sitemap: MenuItem[] = [
  {
    id: 'pages',
    subheader: 'Pages',
    key: 'pages',
    icon: 'material-symbols:view-quilt-outline',
    items: [
      {
        name: 'Dashboard',
        key: 'dashboard',
        path: rootPaths.root,
        pathName: 'dashboard',
        icon: 'material-symbols:dashboard-outline-rounded',
        active: true,
      },
      {
        name: 'Icon Gallery',
        key: 'icon_gallery',
        path: paths.iconGallery,
        pathName: 'icons',
        icon: 'material-symbols:imagesmode-rounded',
        active: true,
      },
    ],
  },
];

export default sitemap;
