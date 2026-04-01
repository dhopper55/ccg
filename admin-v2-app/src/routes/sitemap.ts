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
        name: 'Inventory Labels',
        key: 'inventory_labels',
        path: paths.inventoryLabels,
        pathName: 'inventory-labels',
        icon: 'material-symbols:picture-as-pdf-outline-rounded',
        active: true,
      },
      {
        name: 'Serial Decodes',
        key: 'serial_decodes',
        path: paths.serialDecodes,
        pathName: 'serial-decodes',
        icon: 'material-symbols:data-table-outline-rounded',
        active: true,
      },
      {
        name: 'Serial Pattern Text',
        key: 'serial_pattern_text',
        path: paths.serialPatternText,
        pathName: 'serial-pattern-text',
        icon: 'material-symbols:notes-rounded',
        active: true,
      },
    ],
  },
];

export default sitemap;
