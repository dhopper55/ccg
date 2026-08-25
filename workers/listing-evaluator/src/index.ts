import type { Env } from './env.js';
import { SHOP_BASE_PATH, SUPPORTED_ORIGINS } from './constants.js';
import { jsonResponse } from './utils/misc.js';

// Auth
import {
  withCors,
  requireAuth,
  isPublicApiPath,
} from './auth/middleware.js';
import {
  handleLogin,
  handleSession,
  handleLogout,
} from './auth/handlers.js';

// Serial
import {
  handleSerialDecodeEvent,
  handleDecodeRequest,
  handleDecodeEmailRequest,
} from './serial/handlers.js';
import {
  handleAdminV2SerialPatternTextList,
  handleAdminV2SerialPatternTextSave,
  handleAdminV2SerialPatternContextGenerate,
} from './admin/serial-patterns.js';
import {
  handleAdminV2SerialDecodes,
  handleAdminV2SerialDecodeBrandResponses,
  handleAdminV2SerialDecodeLookupVolume,
  handleAdminV2SerialDecodeDailyVolume,
  handleAdminV2SerialDecodeDevHandoff,
  handleAdminV2SerialDecodeEvaluatedUpdate,
  handleAdminV2SerialDecodeRunAnalysis,
  handleAdminV2SerialDecodeDelete,
} from './admin/serial-decodes-handlers.js';

// Listings
import {
  handleList,
  handleGetListing,
  handleArchiveListing,
  handleSaveListing,
  handleGetListingDebug,
  handleReprocessListing,
  handleMapListings,
  handleMapsConfig,
  handlePurgeOldListings,
  handleAdminV2GetListing,
  handleAdminV2ListingAiAnalysisSave,
} from './listings/handlers.js';
import { handleCustomListingSubmit } from './listings/handlers2.js';
import { handleSubmit } from './listings/submit.js';
import {
  handleCustomImage,
  handleListingImage,
  handleImageProxy,
} from './listings/images.js';

// Inventory
import {
  handleInventoryList,
  handleInventorySummary,
  handleInventoryNextCcgNumber,
} from './inventory/handlers.js';
import {
  handleInventoryCreate,
  handleInventoryGet,
  handleInventoryPackageCreate,
} from './inventory/crud.js';
import {
  handleInventoryUpdate,
  handleInventoryDelete,
} from './inventory/crud2.js';
import {
  handleInventoryImage,
  handleInventoryImageUpload,
  handleInventoryImageImport,
} from './inventory/images.js';
import {
  handleAdminV2InventoryCategories,
  handleAdminV2InventoryCategoryCreate,
  handleAdminV2InventoryCategoryUpdate,
  handleAdminV2InventoryCategoryDelete,
} from './inventory/categories.js';
import {
  handleAdminV2PurchaseLots,
  handleAdminV2PurchaseLotCreate,
  handleAdminV2PurchaseLotUpdate,
  handleAdminV2PurchaseLotItems,
} from './inventory/purchased-lots.js';
import {
  handleAdminV2InventorySubscriptions,
  handleAdminV2InventoryCustomTemplate,
  handleAdminV2InventoryUnmarkAll,
  handleAdminV2InventoryBackfillBarcodes,
  handleAdminV2InventoryMergeMarked,
  handleAdminV2InventoryMarkUpdate,
  handleAdminV2InventoryClearTagReprint,
  handleAdminV2InventoryLabelsPdf,
  handleAdminV2InventoryLabelsPdfPost,
} from './admin/inventory.js';

// Orders
import {
  handleAdminV2Orders,
  handleAdminV2OrderDetail,
  handleAdminV2OrderStatusFlagsUpdate,
  handleAdminV2OrderRefund,
  handleAdminV2OrderRollback,
  handleAdminV2ReconcileStripeCheckoutOrders,
} from './orders/handlers.js';
import { handleStripeWebhook } from './orders/webhook.js';
import { handleAdminV2OrderConfirmationEmailTest, handleAdminV2BrevoMarketingSubscribe, handlePublicEmailSignup } from './orders/email.js';
import { handleAdminV2OrderAccountFunds } from './orders/funds.js';

// Shop
import {
  handleShopCategories,
  handleShopProducts,
  handleShopProductSearch,
  handleShopProductDetailBySlug,
  handleShopProductDetail,
  handleShopSettings,
  handleShopNewsletterSubscribe,
} from './shop/handlers.js';
import {
  handleSitemap,
  handleRobotsTxt,
  handleShopPageRequest,
} from './shop/sitemap.js';
import {
  handleGoogleMerchantFeed,
  handleShopReceiptTemplate,
} from './shop/merchant.js';
import { handleShopSitemapProducts } from './shop/sitemap.js';
import {
  handleShopAssociateModeStatus,
  handleShopAssociateModeEnable,
  handleShopAssociateModeDisable,
} from './shop/associate.js';
import { handleShopAnalyticsEvent } from './shop/analytics.js';
import {
  handleShopCreateCheckoutSession,
  handleShopCreateCashOrder,
  handleShopOrderReceipt,
} from './shop/checkout.js';
import {
  handleShopCreateTerminalPayment,
  handleShopTerminalPaymentStatus,
  handleShopTerminalPaymentCancel,
} from './shop/checkout-terminal.js';

// Payment Links
import {
  handleAdminV2PaymentLinks,
  handleAdminV2PaymentLinkMarkedItems,
  handleAdminV2PaymentLinkCreate,
  handleAdminV2PaymentLinkDeactivate,
} from './payment-links/handlers.js';

// MFR Orders
import {
  handleAdminV2MfrOrders,
  handleAdminV2MfrOrderCreate,
  handleAdminV2MfrOrderFiles,
  handleAdminV2MfrOrderFileUpload,
  handleAdminV2MfrOrderFileOpen,
  handleAdminV2MfrOrderFileDelete,
} from './mfr-orders/handlers.js';

// Advertising Flyers
import {
  handleAdminV2AdvertisingFlyersList,
  handleAdminV2AdvertisingFlyersLookup,
  handleAdminV2AdvertisingFlyersCreate,
  handleAdminV2AdvertisingFlyersDelete,
  handleAdminV2AdvertisingFlyersUpdate,
} from './admin/advertising-flyers.js';

// System
import {
  handleAdminV2StripeConfig,
  handleAdminV2StripeConfigUpdate,
  handleAdminV2V2DecodeConfig,
  handleAdminV2V2DecodeConfigUpdate,
  handleAdminV2SystemSettings,
  handleAdminV2SystemSettingsUpdate,
} from './system/handlers.js';

// dncbudget System panel — see dncbudget-spec.md §9
import {
  handleDncBudgetSystemPlaidTransactions,
  handleDncBudgetSystemSmsQuota,
  handleDncBudgetSystemSendTestSms,
  handleDncBudgetSystemRunSync,
} from './dncbudget/system-routes.js';

// dncbudget data layer — see dncbudget-spec.md §9
import {
  handleDncBudgetMonthsList,
  handleDncBudgetSetTotalIn,
  handleDncBudgetTransactionsList,
  handleDncBudgetTransactionPatch,
  handleDncBudgetTransactionIgnore,
  handleDncBudgetMarkExpected,
  handleDncBudgetLogCharge,
  handleDncBudgetCategoriesList,
  handleDncBudgetCategoryCreate,
} from './dncbudget/data-routes.js';

// Admin Dashboard
import {
  handleAdminV2DashboardSummary,
  handleAdminV2DashboardProfitTrend,
  handleAdminV2DashboardInventoryAging,
  handleAdminV2DashboardInventoryByCategory,
  handleAdminV2DashboardRecentSales,
  handleAdminV2DashboardOldestInventory,
} from './admin/dashboard-handlers.js';

// Admin Analytics
import {
  handleAdminV2ActivityLog,
  handleAdminV2ShopStatistics,
  handleAdminV2ShopStatisticDelete,
} from './admin/analytics.js';

// Admin Search
import { handleAdminV2Search } from './admin/search.js';

// UPC
import {
  handleAdminV2UpcLookup,
  handleAdminV2BarcodeLookup,
} from './upc/handlers.js';

// Guitar Eval
import {
  handlePublicGuitarEvalReport,
  handleAdminV2ValueReports,
  handleAdminV2ValueReportItem,
  handleAdminV2ValueReportFulfilledUpdate,
  handleAdminV2ValueReportDelete,
  handleAdminV2GenerateReport,
  handleAdminV2ValueReportSendAltEmail,
  handleAdminV2ValueReportGeneratePdf,
} from './guitar-eval/handlers.js';
import {
  handleGuitarEvaluationSubmit,
  handleGuitarEvaluationUpdate,
  handleGuitarEvaluationUploadImages,
  handleGuitarEvaluationImage,
  handleGuitarEvaluationPaymentIntent,
  handleGuitarEvaluationConfirmPayment,
  handleGuitarEvaluationValidateCoupon,
  handleGuitarEvaluationStatus,
} from './guitar-eval/payment.js';
import { runGuitarEvalReportGeneration } from './guitar-eval/report.js';
import {
  handleAdminV2AuthenticityDraftSave,
  handleAdminV2AuthenticityPreview,
  handleAdminV2AuthenticitySend,
  handleAdminV2AuthenticityAiPolish,
  handleAdminV2AuthenticityParseChecklist,
} from './guitar-eval/authenticity-report.js';

// Apify
import {
  handleWebhook,
  handleYoutubeVideos,
} from './apify/handlers.js';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request, env);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/sitemap.xml' && (request.method === 'GET' || request.method === 'HEAD')) {
      return handleSitemap(env);
    }

    if (path === '/robots.txt' && (request.method === 'GET' || request.method === 'HEAD')) {
      return handleRobotsTxt();
    }

    if (
      (path === SHOP_BASE_PATH || path.startsWith(`${SHOP_BASE_PATH}/`)) &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      return handleShopPageRequest(request, env);
    }

    if (path === '/api/login' && request.method === 'POST') {
      const response = await handleLogin(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/session' && request.method === 'GET') {
      const response = await handleSession(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/logout' && request.method === 'POST') {
      const response = await handleLogout();
      return withCors(response, request, env);
    }

    if (path === '/api/stripe/webhook' && request.method === 'POST') {
      return handleStripeWebhook(request, env);
    }

    if (path === '/api/stripe/webhook/sandbox' && request.method === 'POST') {
      return handleStripeWebhook(request, env, true);
    }

    const guitarEvalReportMatch = path.match(/^\/api\/guitar-eval-report\/([0-9a-f-]+)$/i);
    if (guitarEvalReportMatch && request.method === 'GET') {
      return handlePublicGuitarEvalReport(guitarEvalReportMatch[1], env);
    }

    if (path === '/api/email-signup' && request.method === 'POST') {
      const response = await handlePublicEmailSignup(request, env);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/') && !isPublicApiPath(path)) {
      const authResponse = await requireAuth(request, env, path);
      if (authResponse) {
        return withCors(authResponse, request, env);
      }
    }

    // Public shop endpoints
    if (path === '/api/shop/associate-mode' && request.method === 'GET') {
      const response = await handleShopAssociateModeStatus(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/associate-mode' && request.method === 'POST') {
      const response = await handleShopAssociateModeEnable(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/associate-mode' && request.method === 'DELETE') {
      const response = handleShopAssociateModeDisable();
      return withCors(response, request, env);
    }

    if (path === '/api/shop/settings' && request.method === 'GET') {
      const response = await handleShopSettings(env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/categories' && request.method === 'GET') {
      const response = await handleShopCategories(env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/products' && request.method === 'GET') {
      const response = await handleShopProducts(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/product-search' && request.method === 'GET') {
      const response = await handleShopProductSearch(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/sitemap-products' && request.method === 'GET') {
      const response = await handleShopSitemapProducts(env);
      return withCors(response, request, env);
    }

    if (
      (path === '/api/shop/google-merchant-feed.xml' || path === '/google-merchant-feed.xml') &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      const response = await handleGoogleMerchantFeed(env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/analytics/event' && request.method === 'POST') {
      const response = await handleShopAnalyticsEvent(request, env);
      return withCors(response, request, env);
    }

    const shopReceiptTemplateMatch = path.match(/^\/api\/shop\/receipt-templates\/([^/]+)$/);
    if (shopReceiptTemplateMatch && request.method === 'GET') {
      const templateCode = decodeURIComponent(shopReceiptTemplateMatch[1]);
      const response = await handleShopReceiptTemplate(templateCode, env);
      return withCors(response, request, env);
    }

    const shopProductBySlugMatch = path.match(/^\/api\/shop\/products\/by-slug\/([^/]+)$/);
    if (shopProductBySlugMatch && request.method === 'GET') {
      const slug = decodeURIComponent(shopProductBySlugMatch[1]);
      const response = await handleShopProductDetailBySlug(slug, request, env);
      return withCors(response, request, env);
    }

    const shopProductDetailMatch = path.match(/^\/api\/shop\/products\/(\d+)$/);
    if (shopProductDetailMatch && request.method === 'GET') {
      const response = await handleShopProductDetail(Number(shopProductDetailMatch[1]), request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/newsletter' && request.method === 'POST') {
      const response = await handleShopNewsletterSubscribe(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/guitar-evaluation' && request.method === 'POST') {
      const response = await handleGuitarEvaluationSubmit(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/guitar-evaluation/payment-intent' && request.method === 'POST') {
      const response = await handleGuitarEvaluationPaymentIntent(request, env);
      return withCors(response, request, env);
    }
    if (path === '/api/guitar-evaluation/confirm-payment' && request.method === 'POST') {
      const response = await handleGuitarEvaluationConfirmPayment(request, env);
      return withCors(response, request, env);
    }
    if (path === '/api/guitar-evaluation/validate-coupon' && request.method === 'POST') {
      const response = await handleGuitarEvaluationValidateCoupon(request, env);
      return withCors(response, request, env);
    }

    const guitarEvalUploadMatch = path.match(/^\/api\/guitar-evaluation\/(\d+)\/upload-images$/);
    if (guitarEvalUploadMatch && request.method === 'POST') {
      const response = await handleGuitarEvaluationUploadImages(request, guitarEvalUploadMatch[1], env);
      return withCors(response, request, env);
    }

    const guitarEvalUpdateMatch = path.match(/^\/api\/guitar-evaluation\/(\d+)$/);
    if (guitarEvalUpdateMatch && request.method === 'PATCH') {
      const response = await handleGuitarEvaluationUpdate(request, guitarEvalUpdateMatch[1], env);
      return withCors(response, request, env);
    }

    const guitarEvalStatusMatch = path.match(/^\/api\/guitar-evaluation\/(\d+)\/status$/);
    if (guitarEvalStatusMatch && request.method === 'GET') {
      const response = await handleGuitarEvaluationStatus(guitarEvalStatusMatch[1], env);
      return withCors(response, request, env);
    }

    if (path === '/api/guitar-evaluation-image' && request.method === 'GET') {
      const response = await handleGuitarEvaluationImage(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/youtube/videos' && request.method === 'GET') {
      const response = await handleYoutubeVideos();
      return withCors(response, request, env);
    }

    if (path === '/api/shop/orders/create-checkout-session' && request.method === 'POST') {
      const response = await handleShopCreateCheckoutSession(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/orders/create-terminal-payment' && request.method === 'POST') {
      const response = await handleShopCreateTerminalPayment(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/shop/orders/create-cash-order' && request.method === 'POST') {
      const response = await handleShopCreateCashOrder(request, env);
      return withCors(response, request, env);
    }

    const shopTerminalPaymentCancelMatch = path.match(/^\/api\/shop\/orders\/([^/]+)\/terminal-payment\/cancel$/);
    if (shopTerminalPaymentCancelMatch && request.method === 'POST') {
      const orderId = decodeURIComponent(shopTerminalPaymentCancelMatch[1]);
      const response = await handleShopTerminalPaymentCancel(orderId, request, env);
      return withCors(response, request, env);
    }

    const shopTerminalPaymentMatch = path.match(/^\/api\/shop\/orders\/([^/]+)\/terminal-payment$/);
    if (shopTerminalPaymentMatch && request.method === 'GET') {
      const orderId = decodeURIComponent(shopTerminalPaymentMatch[1]);
      const response = await handleShopTerminalPaymentStatus(orderId, request, env);
      return withCors(response, request, env);
    }

    const shopOrderReceiptMatch = path.match(/^\/api\/shop\/orders\/([^/]+)\/receipt$/);
    if (shopOrderReceiptMatch && request.method === 'GET') {
      const orderId = decodeURIComponent(shopOrderReceiptMatch[1]);
      const response = await handleShopOrderReceipt(orderId, request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/submit' && request.method === 'POST') {
      const response = await handleSubmit(request, env, ctx);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/custom' && request.method === 'POST') {
      const response = await handleCustomListingSubmit(request, env, ctx);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/custom-image' && request.method === 'GET') {
      const response = await handleCustomImage(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/serial-decodes' && request.method === 'POST') {
      const response = await handleSerialDecodeEvent(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/decode' && request.method === 'POST') {
      const response = await handleDecodeRequest(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/decode/email' && request.method === 'POST') {
      const response = await handleDecodeEmailRequest(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/webhook' && request.method === 'POST') {
      const response = await handleWebhook(request, env, ctx);
      return withCors(response, request, env);
    }

    if (path === '/api/listings' && request.method === 'GET') {
      const response = await handleList(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/map' && request.method === 'GET') {
      const response = await handleMapListings(env);
      return withCors(response, request, env);
    }

    if (path === '/api/maps-config' && request.method === 'GET') {
      const response = await handleMapsConfig(env);
      return withCors(response, request, env);
    }

    if (path === '/api/image' && request.method === 'GET') {
      const response = await handleImageProxy(request, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/archive') && path.startsWith('/api/listings/') && request.method === 'POST') {
      const response = await handleArchiveListing(request, env, path);
      return withCors(response, request, env);
    }

    if (path.endsWith('/save') && path.startsWith('/api/listings/') && request.method === 'POST') {
      const response = await handleSaveListing(request, env, path);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/listings/') && path.endsWith('/debug') && request.method === 'GET') {
      const response = await handleGetListingDebug(request, env, path);
      return withCors(response, request, env);
    }

    if (path === '/api/listings/reprocess' && request.method === 'POST') {
      const response = await handleReprocessListing(request, env);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/listings/') && request.method === 'GET') {
      const response = await handleGetListing(request, env, path);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory' && request.method === 'GET') {
      const response = await handleInventoryList(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory' && request.method === 'POST') {
      const response = await handleInventoryCreate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory/summary' && request.method === 'GET') {
      const response = await handleInventorySummary(env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory/next-ccg-number' && request.method === 'GET') {
      const response = await handleInventoryNextCcgNumber(env);
      return withCors(response, request, env);
    }

    if (path === '/api/dncbudget/system/plaid-transactions' && request.method === 'GET') {
      const response = await handleDncBudgetSystemPlaidTransactions(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/dncbudget/system/sms-quota' && request.method === 'GET') {
      const response = await handleDncBudgetSystemSmsQuota(env);
      return withCors(response, request, env);
    }

    if (path === '/api/dncbudget/system/send-test-sms' && request.method === 'POST') {
      const response = await handleDncBudgetSystemSendTestSms(env);
      return withCors(response, request, env);
    }

    if (path === '/api/dncbudget/system/run-sync' && request.method === 'POST') {
      const response = await handleDncBudgetSystemRunSync(env);
      return withCors(response, request, env);
    }

    if (path === '/api/dncbudget/months' && request.method === 'GET') {
      const response = await handleDncBudgetMonthsList(env);
      return withCors(response, request, env);
    }

    const dncBudgetTotalInMatch = path.match(/^\/api\/dncbudget\/months\/(\d{4}-\d{2})\/total-in$/);
    if (dncBudgetTotalInMatch && request.method === 'POST') {
      const response = await handleDncBudgetSetTotalIn(request, env, dncBudgetTotalInMatch[1]);
      return withCors(response, request, env);
    }

    if (path === '/api/dncbudget/transactions' && request.method === 'GET') {
      const month = new URL(request.url).searchParams.get('month');
      if (!month) {
        return withCors(jsonResponse({ ok: false, error: 'month query param is required' }, 400), request, env);
      }
      const response = await handleDncBudgetTransactionsList(env, month);
      return withCors(response, request, env);
    }

    if (path === '/api/dncbudget/transactions/log-charge' && request.method === 'POST') {
      const response = await handleDncBudgetLogCharge(request, env);
      return withCors(response, request, env);
    }

    const dncBudgetIgnoreMatch = path.match(/^\/api\/dncbudget\/transactions\/([^/]+)\/ignore$/);
    if (dncBudgetIgnoreMatch && request.method === 'POST') {
      const response = await handleDncBudgetTransactionIgnore(env, dncBudgetIgnoreMatch[1]);
      return withCors(response, request, env);
    }

    const dncBudgetMarkExpectedMatch = path.match(/^\/api\/dncbudget\/transactions\/([^/]+)\/mark-expected$/);
    if (dncBudgetMarkExpectedMatch && request.method === 'POST') {
      const response = await handleDncBudgetMarkExpected(request, env, dncBudgetMarkExpectedMatch[1]);
      return withCors(response, request, env);
    }

    const dncBudgetTxnPatchMatch = path.match(/^\/api\/dncbudget\/transactions\/([^/]+)$/);
    if (dncBudgetTxnPatchMatch && request.method === 'PATCH') {
      const response = await handleDncBudgetTransactionPatch(request, env, dncBudgetTxnPatchMatch[1]);
      return withCors(response, request, env);
    }

    if (path === '/api/dncbudget/categories' && request.method === 'GET') {
      const response = await handleDncBudgetCategoriesList(env);
      return withCors(response, request, env);
    }

    if (path === '/api/dncbudget/categories' && request.method === 'POST') {
      const response = await handleDncBudgetCategoryCreate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/summary' && request.method === 'GET') {
      const response = await handleAdminV2DashboardSummary(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/profit-trend' && request.method === 'GET') {
      const response = await handleAdminV2DashboardProfitTrend(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/inventory-aging' && request.method === 'GET') {
      const response = await handleAdminV2DashboardInventoryAging(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/inventory-by-category' && request.method === 'GET') {
      const response = await handleAdminV2DashboardInventoryByCategory(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/recent-sales' && request.method === 'GET') {
      const response = await handleAdminV2DashboardRecentSales(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/dashboard/oldest-inventory' && request.method === 'GET') {
      const response = await handleAdminV2DashboardOldestInventory(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-decodes' && request.method === 'GET') {
      const response = await handleAdminV2SerialDecodes(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-decodes/brand-responses' && request.method === 'GET') {
      const response = await handleAdminV2SerialDecodeBrandResponses(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-decodes/lookup-volume' && request.method === 'GET') {
      const response = await handleAdminV2SerialDecodeLookupVolume(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-decodes/daily-volume' && request.method === 'GET') {
      const response = await handleAdminV2SerialDecodeDailyVolume(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-decodes/dev-handoff' && request.method === 'GET') {
      const response = await handleAdminV2SerialDecodeDevHandoff(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-pattern-text' && request.method === 'GET') {
      const response = await handleAdminV2SerialPatternTextList(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-pattern-text' && request.method === 'POST') {
      const response = await handleAdminV2SerialPatternTextSave(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/search' && request.method === 'GET') {
      const response = await handleAdminV2Search(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/barcode-lookup' && request.method === 'GET') {
      const response = await handleAdminV2BarcodeLookup(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/upc-lookup' && request.method === 'GET') {
      const response = await handleAdminV2UpcLookup(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/serial-contexts/generate' && request.method === 'POST') {
      const response = await handleAdminV2SerialPatternContextGenerate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/activity-log' && request.method === 'GET') {
      const response = await handleAdminV2ActivityLog(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/shop-statistics' && request.method === 'GET') {
      const response = await handleAdminV2ShopStatistics(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/orders' && request.method === 'GET') {
      const response = await handleAdminV2Orders(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/orders/reconcile-stripe-checkout' && request.method === 'POST') {
      const response = await handleAdminV2ReconcileStripeCheckoutOrders(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/mfr-orders' && request.method === 'GET') {
      const response = await handleAdminV2MfrOrders(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/mfr-orders' && request.method === 'POST') {
      const response = await handleAdminV2MfrOrderCreate(request, env);
      return withCors(response, request, env);
    }

    const adminV2MfrOrderFilesMatch = path.match(/^\/api\/admin-v2\/mfr-orders\/(\d+)\/files$/);
    if (adminV2MfrOrderFilesMatch && request.method === 'GET') {
      const response = await handleAdminV2MfrOrderFiles(Number(adminV2MfrOrderFilesMatch[1]), env);
      return withCors(response, request, env);
    }

    if (adminV2MfrOrderFilesMatch && request.method === 'POST') {
      const response = await handleAdminV2MfrOrderFileUpload(request, Number(adminV2MfrOrderFilesMatch[1]), env);
      return withCors(response, request, env);
    }

    const adminV2MfrOrderFileMatch = path.match(/^\/api\/admin-v2\/mfr-orders\/files\/([^/]+)$/);
    if (adminV2MfrOrderFileMatch && request.method === 'GET') {
      const response = await handleAdminV2MfrOrderFileOpen(decodeURIComponent(adminV2MfrOrderFileMatch[1]), env);
      return withCors(response, request, env);
    }

    if (adminV2MfrOrderFileMatch && request.method === 'DELETE') {
      const response = await handleAdminV2MfrOrderFileDelete(decodeURIComponent(adminV2MfrOrderFileMatch[1]), env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/payment-links' && request.method === 'GET') {
      const response = await handleAdminV2PaymentLinks(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/stripe-config' && request.method === 'GET') {
      const response = await handleAdminV2StripeConfig(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/stripe-config' && request.method === 'POST') {
      const response = await handleAdminV2StripeConfigUpdate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/v2-decode-config' && request.method === 'GET') {
      const response = await handleAdminV2V2DecodeConfig(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/v2-decode-config' && request.method === 'POST') {
      const response = await handleAdminV2V2DecodeConfigUpdate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/system-settings' && request.method === 'GET') {
      const response = await handleAdminV2SystemSettings(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/system-settings' && request.method === 'POST') {
      const response = await handleAdminV2SystemSettingsUpdate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/order-confirmation-email/test' && request.method === 'POST') {
      const response = await handleAdminV2OrderConfirmationEmailTest(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/marketing/subscribe' && request.method === 'POST') {
      const response = await handleAdminV2BrevoMarketingSubscribe(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/payment-links/marked-items' && request.method === 'GET') {
      const response = await handleAdminV2PaymentLinkMarkedItems(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/payment-links' && request.method === 'POST') {
      const response = await handleAdminV2PaymentLinkCreate(request, env);
      return withCors(response, request, env);
    }

    const adminV2PaymentLinkDeactivateMatch = path.match(/^\/api\/admin-v2\/payment-links\/([^/]+)\/deactivate$/);
    if (adminV2PaymentLinkDeactivateMatch && request.method === 'POST') {
      const response = await handleAdminV2PaymentLinkDeactivate(decodeURIComponent(adminV2PaymentLinkDeactivateMatch[1]), env);
      return withCors(response, request, env);
    }

    const adminV2OrderMatch = path.match(/^\/api\/admin-v2\/orders\/([^/]+)$/);
    if (adminV2OrderMatch && request.method === 'GET') {
      const response = await handleAdminV2OrderDetail(decodeURIComponent(adminV2OrderMatch[1]), env);
      return withCors(response, request, env);
    }

    const adminV2OrderStatusFlagsMatch = path.match(/^\/api\/admin-v2\/orders\/([^/]+)\/status-flags$/);
    if (adminV2OrderStatusFlagsMatch && request.method === 'POST') {
      const response = await handleAdminV2OrderStatusFlagsUpdate(
        request,
        decodeURIComponent(adminV2OrderStatusFlagsMatch[1]),
        env,
      );
      return withCors(response, request, env);
    }

    const adminV2OrderAccountFundsMatch = path.match(/^\/api\/admin-v2\/orders\/([^/]+)\/account-funds$/);
    if (adminV2OrderAccountFundsMatch && request.method === 'POST') {
      const response = await handleAdminV2OrderAccountFunds(
        request,
        decodeURIComponent(adminV2OrderAccountFundsMatch[1]),
        env,
      );
      return withCors(response, request, env);
    }

    const adminV2OrderRefundMatch = path.match(/^\/api\/admin-v2\/orders\/([^/]+)\/refund$/);
    if (adminV2OrderRefundMatch && request.method === 'POST') {
      const response = await handleAdminV2OrderRefund(decodeURIComponent(adminV2OrderRefundMatch[1]), env);
      return withCors(response, request, env);
    }

    const adminV2OrderRollbackMatch = path.match(/^\/api\/admin-v2\/orders\/([^/]+)\/rollback$/);
    if (adminV2OrderRollbackMatch && request.method === 'POST') {
      const response = await handleAdminV2OrderRollback(decodeURIComponent(adminV2OrderRollbackMatch[1]), env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/value-reports' && request.method === 'GET') {
      const response = await handleAdminV2ValueReports(request, env);
      return withCors(response, request, env);
    }

    const adminV2ValueReportItemMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)$/);
    if (adminV2ValueReportItemMatch && request.method === 'GET') {
      const response = await handleAdminV2ValueReportItem(adminV2ValueReportItemMatch[1], env);
      return withCors(response, request, env);
    }

    const adminV2ValueReportFulfilledMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)\/fulfilled$/);
    if (adminV2ValueReportFulfilledMatch && request.method === 'POST') {
      const response = await handleAdminV2ValueReportFulfilledUpdate(adminV2ValueReportFulfilledMatch[1], request, env);
      return withCors(response, request, env);
    }

    const adminV2ValueReportDeleteMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)\/delete$/);
    if (adminV2ValueReportDeleteMatch && request.method === 'POST') {
      const response = await handleAdminV2ValueReportDelete(adminV2ValueReportDeleteMatch[1], env);
      return withCors(response, request, env);
    }

    const adminV2ValueReportGenerateMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)\/generate-report$/);
    if (adminV2ValueReportGenerateMatch && request.method === 'POST') {
      const response = await handleAdminV2GenerateReport(adminV2ValueReportGenerateMatch[1], env, ctx);
      return withCors(response, request, env);
    }

    const adminV2ValueReportSendAltEmailMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)\/send-alt-email$/);
    if (adminV2ValueReportSendAltEmailMatch && request.method === 'POST') {
      const response = await handleAdminV2ValueReportSendAltEmail(adminV2ValueReportSendAltEmailMatch[1], request, env);
      return withCors(response, request, env);
    }

    const adminV2ValueReportGeneratePdfMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)\/generate-pdf$/);
    if (adminV2ValueReportGeneratePdfMatch && request.method === 'POST') {
      const response = await handleAdminV2ValueReportGeneratePdf(adminV2ValueReportGeneratePdfMatch[1], env);
      return withCors(response, request, env);
    }

    const adminV2AuthDraftMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)\/authenticity-draft$/);
    if (adminV2AuthDraftMatch && request.method === 'POST') {
      const response = await handleAdminV2AuthenticityDraftSave(adminV2AuthDraftMatch[1], request, env);
      return withCors(response, request, env);
    }

    const adminV2AuthPreviewMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)\/authenticity-preview$/);
    if (adminV2AuthPreviewMatch && request.method === 'POST') {
      const response = await handleAdminV2AuthenticityPreview(adminV2AuthPreviewMatch[1], request, env);
      return withCors(response, request, env);
    }

    const adminV2AuthSendMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)\/authenticity-send$/);
    if (adminV2AuthSendMatch && request.method === 'POST') {
      const response = await handleAdminV2AuthenticitySend(adminV2AuthSendMatch[1], request, env);
      return withCors(response, request, env);
    }

    const adminV2AuthAiPolishMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)\/authenticity-ai-polish$/);
    if (adminV2AuthAiPolishMatch && request.method === 'POST') {
      const response = await handleAdminV2AuthenticityAiPolish(adminV2AuthAiPolishMatch[1], request, env);
      return withCors(response, request, env);
    }

    const adminV2AuthParseChecklistMatch = path.match(/^\/api\/admin-v2\/value-reports\/(\d+)\/authenticity-parse-checklist$/);
    if (adminV2AuthParseChecklistMatch && request.method === 'POST') {
      const response = await handleAdminV2AuthenticityParseChecklist(adminV2AuthParseChecklistMatch[1], request, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/evaluated') && path.startsWith('/api/admin-v2/serial-decodes/') && request.method === 'POST') {
      const response = await handleAdminV2SerialDecodeEvaluatedUpdate(request, path, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/run-analysis') && path.startsWith('/api/admin-v2/serial-decodes/') && request.method === 'POST') {
      const response = await handleAdminV2SerialDecodeRunAnalysis(path, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/delete') && path.startsWith('/api/admin-v2/serial-decodes/') && request.method === 'POST') {
      const response = await handleAdminV2SerialDecodeDelete(path, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/delete') && path.startsWith('/api/admin-v2/shop-statistics/') && request.method === 'POST') {
      const response = await handleAdminV2ShopStatisticDelete(path, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/labels.pdf' && request.method === 'GET') {
      const response = await handleAdminV2InventoryLabelsPdf(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/labels.pdf' && request.method === 'POST') {
      const response = await handleAdminV2InventoryLabelsPdfPost(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/categories' && request.method === 'GET') {
      const response = await handleAdminV2InventoryCategories(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/categories' && request.method === 'POST') {
      const response = await handleAdminV2InventoryCategoryCreate(request, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/update') && path.startsWith('/api/admin-v2/inventory/categories/') && request.method === 'POST') {
      const response = await handleAdminV2InventoryCategoryUpdate(request, path, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/delete') && path.startsWith('/api/admin-v2/inventory/categories/') && request.method === 'POST') {
      const response = await handleAdminV2InventoryCategoryDelete(path, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/purchased-lots' && request.method === 'GET') {
      const response = await handleAdminV2PurchaseLots(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/purchased-lots' && request.method === 'POST') {
      const response = await handleAdminV2PurchaseLotCreate(request, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/update') && path.startsWith('/api/admin-v2/purchased-lots/') && request.method === 'POST') {
      const response = await handleAdminV2PurchaseLotUpdate(request, path, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/items') && path.startsWith('/api/admin-v2/purchased-lots/') && request.method === 'GET') {
      const response = await handleAdminV2PurchaseLotItems(path, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/subscriptions' && request.method === 'GET') {
      const response = await handleAdminV2InventorySubscriptions(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/custom-template' && request.method === 'GET') {
      const response = await handleAdminV2InventoryCustomTemplate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/unmark-all' && request.method === 'POST') {
      const response = await handleAdminV2InventoryUnmarkAll(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/merge-marked' && request.method === 'POST') {
      const response = await handleAdminV2InventoryMergeMarked(env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/inventory/backfill-barcodes' && request.method === 'POST') {
      const response = await handleAdminV2InventoryBackfillBarcodes(env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/mark') && path.startsWith('/api/admin-v2/inventory/') && request.method === 'POST') {
      const response = await handleAdminV2InventoryMarkUpdate(request, path, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/clear-tag-reprint') && path.startsWith('/api/admin-v2/inventory/') && request.method === 'POST') {
      const response = await handleAdminV2InventoryClearTagReprint(path, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/listings/purge-old' && request.method === 'POST') {
      const response = await handlePurgeOldListings(env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/ai-analysis') && path.startsWith('/api/admin-v2/listings/') && request.method === 'POST') {
      const response = await handleAdminV2ListingAiAnalysisSave(request, env, path);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/admin-v2/listings/') && request.method === 'GET') {
      const response = await handleAdminV2GetListing(env, path);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory/package-create' && request.method === 'POST') {
      const response = await handleInventoryPackageCreate(env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory-image' && request.method === 'GET') {
      const response = await handleInventoryImage(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/listing-image' && request.method === 'GET') {
      const response = await handleListingImage(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory/upload-image' && request.method === 'POST') {
      const response = await handleInventoryImageUpload(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/inventory/import-image' && request.method === 'POST') {
      const response = await handleInventoryImageImport(request, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/update') && path.startsWith('/api/inventory/') && request.method === 'POST') {
      const response = await handleInventoryUpdate(request, path, env);
      return withCors(response, request, env);
    }

    if (path.endsWith('/delete') && path.startsWith('/api/inventory/') && request.method === 'POST') {
      const response = await handleInventoryDelete(request, path, env);
      return withCors(response, request, env);
    }

    if (path.startsWith('/api/inventory/') && request.method === 'GET') {
      const response = await handleInventoryGet(path, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/advertising-flyers' && request.method === 'GET') {
      const response = await handleAdminV2AdvertisingFlyersList(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/advertising-flyers' && request.method === 'POST') {
      const response = await handleAdminV2AdvertisingFlyersCreate(request, env);
      return withCors(response, request, env);
    }

    if (path === '/api/admin-v2/advertising-flyers/lookup' && request.method === 'POST') {
      const response = await handleAdminV2AdvertisingFlyersLookup(request, env);
      return withCors(response, request, env);
    }

    const advertisingFlyerItemMatch = path.match(/^\/api\/admin-v2\/advertising-flyers\/(\d+)$/);
    if (advertisingFlyerItemMatch && request.method === 'PATCH') {
      const response = await handleAdminV2AdvertisingFlyersUpdate(path, request, env);
      return withCors(response, request, env);
    }
    if (advertisingFlyerItemMatch && request.method === 'DELETE') {
      const response = await handleAdminV2AdvertisingFlyersDelete(path, env);
      return withCors(response, request, env);
    }

    return withCors(new Response('Not found', { status: 404 }), request, env);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    return;
  },
  async queue(batch: MessageBatch<{ evaluationId: number }>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      await runGuitarEvalReportGeneration(message.body.evaluationId, env);
      message.ack();
    }
  },
};
