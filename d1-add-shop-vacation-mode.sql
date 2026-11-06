-- Vacation mode for the online shop: when on, online customers can't add shippable
-- items to the cart or check out with them. In-store (associate mode) sales and
-- Local Pickup Only items are unaffected. Toggled in Admin > System Settings.
-- Apply before using the toggle; until then the Worker treats vacation mode as off.
ALTER TABLE sys_info ADD COLUMN shop_vacation_mode INTEGER NOT NULL DEFAULT 0;
