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
        path: rootPaths.root,
        pathName: 'home',
        icon: 'material-symbols:data-exploration-outline-rounded',
        active: true,
      },
      {
        name: 'Evals',
        key: 'evals',
        pathName: 'evals',
        icon: 'material-symbols:library-add-check-outline-rounded',
        active: true,
        items: [
          {
            name: 'Listing Eval',
            key: 'listing_eval',
            path: paths.listingEvaluator,
            pathName: 'listing-eval',
            icon: 'material-symbols:content-copy-outline-rounded',
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
        ],
      },
      {
        name: 'Products/Inventory',
        key: 'products_inventory',
        pathName: 'products-inventory',
        icon: 'material-symbols:sell',
        active: true,
        items: [
          {
            name: 'Manage',
            key: 'inventory_manage',
            path: paths.inventoryManager,
            pathName: 'inventory-manager',
            selectionPrefix: '/inventory-item',
            icon: 'material-symbols:sell',
            active: true,
          },
          {
            name: 'Categories',
            key: 'inventory_categories',
            path: paths.inventoryCategoryManager,
            pathName: 'inventory-category-manager',
            icon: 'material-symbols:data-table-outline-rounded',
            active: true,
          },
          {
            name: 'Labels',
            key: 'inventory_labels',
            path: paths.inventoryLabels,
            pathName: 'inventory-labels',
            icon: 'material-symbols:picture-as-pdf-outline-rounded',
            active: true,
          },
        ],
      },
      {
        name: 'Orders',
        key: 'orders',
        pathName: 'orders',
        icon: 'material-symbols:orders-outline-rounded',
        active: true,
        items: [
          {
            name: 'Payment Links',
            key: 'payment_links',
            path: paths.paymentLinks,
            pathName: 'payment-links',
            icon: 'material-symbols:link-rounded',
            active: true,
          },
          {
            name: 'Customer Orders',
            key: 'customer_orders',
            path: paths.orderManager,
            pathName: 'order-manager',
            selectionPrefix: '/order-manager-item',
            icon: 'material-symbols:orders-outline-rounded',
            active: true,
          },
          {
            name: 'Mfr. Orders',
            key: 'mfr_orders',
            path: paths.mfrOrders,
            pathName: 'mfr-orders',
            icon: 'material-symbols:description-outline-rounded',
            active: true,
          },
        ],
      },
      {
        name: 'Serial Numbers',
        key: 'serial_numbers',
        pathName: 'serial-numbers',
        icon: 'material-symbols:qr-code-scanner-rounded',
        active: true,
        items: [
          {
            name: 'Decodes',
            key: 'serial_decodes',
            path: paths.serialDecodes,
            pathName: 'serial-decodes',
            icon: 'material-symbols:data-table-outline-rounded',
            active: true,
          },
          {
            name: 'Pattern Text',
            key: 'serial_pattern_text',
            path: paths.serialPatternText,
            pathName: 'serial-pattern-text',
            icon: 'material-symbols:notes-rounded',
            active: true,
          },
          {
            name: 'Value Reports',
            key: 'value_reports',
            path: paths.valueReports,
            pathName: 'value-reports',
            icon: 'material-symbols:attach-money',
            active: true,
          },
        ],
      },
      {
        name: 'Shop Statistics',
        key: 'shop_statistics',
        path: paths.shopStatistics,
        pathName: 'shop-statistics',
        icon: 'material-symbols:bar-chart-4-bars-rounded',
        active: true,
      },
      {
        name: 'System Settings',
        key: 'system_settings',
        path: paths.systemSettings,
        pathName: 'system-settings',
        icon: 'material-symbols:settings-outline',
        active: true,
      },
    ],
  },
];

export default sitemap;
