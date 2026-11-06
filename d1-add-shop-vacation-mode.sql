-- Vacation mode for the online shop: when on, online customers can't add items
-- to the cart or check out, including Local Pickup Only items. In-store (associate
-- mode) sales are unaffected. Toggled in Admin > System Settings.
-- Apply before using the toggle; until then the Worker treats vacation mode as off.
ALTER TABLE sys_info ADD COLUMN shop_vacation_mode INTEGER NOT NULL DEFAULT 0;
