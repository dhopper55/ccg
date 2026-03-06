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
    subheader: '',
    key: 'pages',
    icon: 'material-symbols:view-quilt-outline',
    items: [
      {
        name: 'Home',
        key: 'home',
        path: rootPaths.root,
        pathName: 'home',
        icon: 'material-symbols:data-exploration-outline-rounded',
        active: true,
      },
      {
        name: 'Listing Eval Results',
        key: 'listing_eval_results',
        path: paths.listingEvaluatorResults,
        pathName: 'listing-eval-results',
        selectionPrefix: '/listing-evaluator-item',
        icon: 'material-symbols:library-add-check-outline-rounded',
        active: true,
      },
      {
        name: 'Listing Eval',
        key: 'listing_eval',
        path: paths.listingEvaluator,
        pathName: 'listing-eval',
        icon: 'material-symbols:content-copy-outline-rounded',
        active: true,
      },
      {
        name: 'Inventory Manager',
        key: 'inventory_manager',
        path: paths.inventoryManager,
        pathName: 'inventory-manager',
        selectionPrefix: '/inventory-item',
        icon: 'material-symbols:sell',
        active: true,
      },
      {
        name: 'Logout',
        key: 'logout',
        path: paths.logout,
        pathName: 'logout',
        icon: 'material-symbols:arrow-back-rounded',
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
