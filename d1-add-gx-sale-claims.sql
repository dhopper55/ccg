-- One row per GX order whose sale is being (or has been) recorded in CCG. GX sends "Sold" and
-- "Awaiting Shipping" for the same order at about the same time; the first webhook to insert
-- the row records the sale, the other backs off and is retried by GX. A claim is released if
-- recording fails, and a claim older than a few minutes is treated as abandoned.
CREATE TABLE gx_sale_claims (
  gx_order_id INTEGER PRIMARY KEY,
  claimed_at TEXT NOT NULL
);
