-- Per-category sale description postfixes. The existing sale_description_postfix column is the
-- Guitar/Bass one; these three start as copies of it.
ALTER TABLE sys_info ADD COLUMN sale_description_postfix_pedal TEXT;
ALTER TABLE sys_info ADD COLUMN sale_description_postfix_amp TEXT;
ALTER TABLE sys_info ADD COLUMN sale_description_postfix_generic TEXT;
UPDATE sys_info SET
  sale_description_postfix_pedal = sale_description_postfix,
  sale_description_postfix_amp = sale_description_postfix,
  sale_description_postfix_generic = sale_description_postfix;
