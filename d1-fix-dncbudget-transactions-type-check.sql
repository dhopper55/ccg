CREATE TABLE dnc_budget_transactions_new (
  id TEXT PRIMARY KEY,
  plaid_transaction_id TEXT,
  account_id TEXT NOT NULL REFERENCES dnc_budget_accounts(id),
  posted_date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  merchant TEXT,
  type TEXT NOT NULL DEFAULT 'unclassified' CHECK (type IN ('unclassified','recurring','discretionary','transfer','income','refund','other','ignored')),
  category_id TEXT REFERENCES dnc_budget_categories(id),
  recurring_bill_id TEXT REFERENCES dnc_budget_recurring_bills(id),
  created_at TEXT NOT NULL
);

INSERT INTO dnc_budget_transactions_new SELECT * FROM dnc_budget_transactions;

DROP TABLE dnc_budget_transactions;

ALTER TABLE dnc_budget_transactions_new RENAME TO dnc_budget_transactions;

CREATE UNIQUE INDEX dnc_budget_transactions_plaid_txn_uq ON dnc_budget_transactions(plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL;
CREATE INDEX dnc_budget_transactions_posted_date_idx ON dnc_budget_transactions(posted_date);
