export interface Env {
  DB: D1Database;
  CUSTOM_ITEMS_BUCKET?: R2Bucket;
  REVERB_API_TOKEN?: string;
  APIFY_TOKEN: string;
  APIFY_FACEBOOK_ACTOR: string;
  APIFY_CRAIGSLIST_ACTOR: string;
  SITE_BASE_URL: string;
  MAX_IMAGES: string;
  AUTH_USER: string;
  AUTH_PASS: string;
  AUTH_SECRET: string;
  ASSOCIATE_MODE_TOKEN?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_WEBHOOK_SECRET_SANDBOX?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_CO_SALES_TAX_RATE_ID?: string;
  STRIPE_TERMINAL_READER_ID?: string;
  STRIPE_TERMINAL_READER_ID_SANDBOX?: string;
  WEBHOOK_SECRET?: string;
  LISTING_JOBS: KVNamespace;
  GOOGLE_MAPS_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  REPORT_QUEUE?: Queue<{ evaluationId: number }>;
  BROWSER?: Fetcher;
  // dncbudget — see dncbudget-spec.md. PLAID_ACCESS_TOKEN_TEST is a throwaway
  // single-token secret for the Stage 1 test buttons only; real per-Item
  // tokens move into D1 (dnc_budget_plaid_items) once that table exists.
  PLAID_CLIENT_ID?: string;
  PLAID_SECRET?: string;
  PLAID_ACCESS_TOKEN_TEST?: string;
  TEXTBELT_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
}
