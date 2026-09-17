-- Affirm/Klarna charge CCG a ~6% fee; passed through to the customer as its
-- own line item when they choose the Finance checkout option.
ALTER TABLE orders ADD COLUMN finance_surcharge_cents INTEGER NOT NULL DEFAULT 0;
