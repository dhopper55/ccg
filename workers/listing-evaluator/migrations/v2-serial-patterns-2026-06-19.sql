-- V2 serial patterns: bespoke rows for 13 newly-supported V1 serial formats
-- Added 2026-06-19 after fixing V1 decoders for customer-reported failures.
--
-- Run from workers/listing-evaluator/ with:
--   npx wrangler d1 execute listing_evaluator --remote --file=migrations/v2-serial-patterns-2026-06-19.sql
--
-- All rows use template_type='bespoke': the regex matches and returns null → V1 handles the decode.
-- Ovation (14100207) and Takamine (91216031) are NOT listed here because existing bespoke rows
-- already cover their regexes (ovation-7-10-digit-import: ^\d{7,10}$ and
-- takamine-8-digit-numeric: ^\d{8}$).

INSERT OR IGNORE INTO serial_patterns_v2 (brand, pattern_key, pattern_label, regex, template_type, params, priority) VALUES

-- ============================================================
-- BC RICH: 4-digit early USA + BW-prefix Korean import
-- ============================================================
-- Bespoke: 4-digit hand-crafted USA sequential (1970s–early 1980s, Los Angeles)
('bcrich', 'bcrich-early-usa-4-digit-sequential', 'BC Rich early USA 4-digit sequential (1970s–1980s)', '^\d{4}$', 'bespoke', '{}', 230),
-- Bespoke: BW-prefix Korean import (Class Axe era or specific Korean contractor)
('bcrich', 'bcrich-bw-prefix-import', 'BC Rich BW-prefix Korean import (1980s)', '^BW\d{2,6}$', 'bespoke', '{}', 225),

-- ============================================================
-- CORT: IE-prefix 10-digit (2022+ runs) + F-prefix Indonesian factory
-- ============================================================
-- Bespoke: IE prefix Indonesian Cor-Tek (8–10 digit; original bespoke row was 8–9 only)
('cort', 'cort-ie-prefix-yymm-sequence', 'Cort IE-prefix Indonesian YYMM sequence (8–10 digit)', '^IE\d{8,10}$', 'bespoke', '{}', 200),
-- Bespoke: F prefix Indonesian factory + YY + sequence (e.g. F034130 = 2003)
('cort', 'cort-indonesia-f-prefix-yy-sequence', 'Cort Indonesia F-prefix YY sequence', '^F\d{6}$', 'bespoke', '{}', 205),

-- ============================================================
-- DEAN: C-prefix Cort Korea (YY + batch + sequence)
-- ============================================================
-- Bespoke: C + YY + batch + sequence (e.g. C2122845 = Cort 2021, batch 22, seq 845)
('dean', 'dean-cort-korea-c-yy-batch-sequence', 'Dean Cort Korea C-prefix YY batch sequence', '^C\d{7}$', 'bespoke', '{}', 105),

-- ============================================================
-- EPIPHONE: MIRC 311-prefix Gibson refurbishment
-- ============================================================
-- Bespoke: 311 + 6 digits = Gibson MIRC (Manufacturer's Inspection and Repair Center)
('epiphone', 'epiphone-mirc-311-refurb', 'Epiphone MIRC 311-prefix refurbishment', '^311\d{6}$', 'bespoke', '{}', 75),

-- ============================================================
-- ESP: Kiso Custom Shop special format (K + 8 digits + letter + 2 digits)
-- ============================================================
-- Bespoke: ESP Custom Shop Japan special format K09164080W15 = 2009 Kiso
('esp', 'esp-kiso-custom-k-yy-special', 'ESP Kiso Custom Shop K-YY special format', '^K\d{8}[A-Z]\d{2}$', 'bespoke', '{}', 85),

-- ============================================================
-- JACKSON: NJHK 4-letter prefix Korea Sung-Eum (YY + sequence)
-- ============================================================
-- Bespoke: NJHK + YY + 6-digit sequence (e.g. NJHK08007429 = Sung-Eum Korea 2008)
-- Must come before the generic 3-letter prefix handler in priority
('jackson', 'jackson-njhk-korea-yy-sequence', 'Jackson NJHK Korea YY sequence', '^NJHK\d{8}$', 'bespoke', '{}', 5),

-- ============================================================
-- PRS: SE CTI-numeric (Cort Indonesia without letter year code)
-- ============================================================
-- Bespoke: CTI + 5+ numeric digits (no letter year — e.g. CTI02544 = Cort Indonesia 2002)
-- Must come before the existing prs-se-cort-factory row (CT[CI][A-Z]\d+) in priority
('prs', 'prs-se-cort-indonesia-cti-numeric-year', 'PRS SE Cort Indonesia CTI numeric year sequence', '^CTI\d{5,}$', 'bespoke', '{}', 35),

-- ============================================================
-- SCHECTER: U-prefix Unsung Korea (YY + MM + sequence)
-- ============================================================
-- Bespoke: U + YYMM + sequence (e.g. u080901104 = Unsung 2008, September)
('schecter', 'schecter-u-unsung-korea-yymm-sequence', 'Schecter Unsung Korea U-prefix YYMM sequence', '^U\d{9}$', 'bespoke', '{}', 140);
