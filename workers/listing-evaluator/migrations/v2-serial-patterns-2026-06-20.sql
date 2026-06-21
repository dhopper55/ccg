-- V2 serial patterns: bespoke rows for 10 newly-supported V1 serial formats
-- Added 2026-06-20 after fixing V1 decoders for customer-reported failures (round 2).
--
-- Run from workers/listing-evaluator/ with:
--   npx wrangler d1 execute listing_evaluator --remote --file=migrations/v2-serial-patterns-2026-06-20.sql
--
-- All rows use template_type='bespoke': the regex matches and returns null → V1 handles the decode.

INSERT OR IGNORE INTO serial_patterns_v2 (brand, pattern_key, pattern_label, regex, template_type, params, priority) VALUES

-- ============================================================
-- ALVAREZ: Two-letter factory prefix (8-digit suffix support)
-- ============================================================
-- Bespoke: CC/FC/etc. + YYMMXXXXXXXX (8-10 digit suffix; previously only 9-10 were covered)
('alvarez', 'alvarez-modern-two-letter-prefix-yymm', 'Alvarez modern two-letter factory prefix YYMM', '^[A-Z]{2}\d{8,10}$', 'bespoke', '{}', 50),

-- ============================================================
-- BC RICH: B-prefix with trailing letter suffix
-- ============================================================
-- Bespoke: B + 2-6 digits + 1 letter (Class Axe/Korean import, e.g. B164U)
('bcrich', 'bcrich-b-prefix-trailing-letter-import', 'BC Rich B-prefix import with trailing letter suffix', '^B\d{2,6}[A-Z]$', 'bespoke', '{}', 222),

-- ============================================================
-- CHARVEL: IMC Fort Worth address stamp (TX + 5-digit zip)
-- ============================================================
-- Bespoke: TX76113 = IMC Inc. Fort Worth TX zip code on Chushin-built Japanese neck plates (1986-1991)
('charvel', 'charvel-imc-address-tx-mark', 'Charvel IMC address mark (TX + 5-digit zip)', '^TX\d{5}$', 'bespoke', '{}', 10),

-- ============================================================
-- ESP: CI and IM Indonesia LTD factory prefixes
-- ============================================================
-- Bespoke: CI + 7-9 digits = Cort/Cor-Tek Indonesia ESP LTD (e.g. CI25100523)
('esp', 'esp-ltd-indonesia-ci-cort-yymm-sequence', 'ESP LTD Indonesia Cort CI + YYMM + sequence', '^CI\d{7,9}$', 'bespoke', '{}', 90),
-- Bespoke: IM + 7-9 digits = Cor-Tek/Cort Indonesia ESP LTD (e.g. IM24120398)
('esp', 'esp-ltd-indonesia-im-cort-yymm-sequence', 'ESP LTD Indonesia Cort IM + YYMM + sequence', '^IM\d{7,9}$', 'bespoke', '{}', 88);
