-- V2 serial patterns: all 17 new brands + Washburn gap-fill
-- Run AFTER all three previous migration files have been applied.
--
-- Run from workers/listing-evaluator/ with:
--   npx wrangler d1 execute listing_evaluator --remote --file=migrations/v2-serial-patterns-new-brands.sql
--
-- Template rows decode serials directly via V2.
-- Bespoke rows (params='{}') match the regex and return null → V1 handles the decode.
-- Bespoke rows exist as documentation and to ensure the correct V1 decode path fires.

INSERT OR IGNORE INTO serial_patterns_v2 (brand, pattern_key, pattern_label, regex, template_type, params, priority) VALUES

-- ============================================================
-- ALVAREZ
-- Template: two-letter Chinese/Asian factory prefix + YYMM + sequence
-- ============================================================
('alvarez', 'alvarez-fc-factory-china-yymm-sequence', 'Alvarez FC China factory YYMM sequence', '^FC\d{9,10}$', 'prefix-yymm-seq',
 '{"prefix":"FC","prefixLen":2,"brand":"Alvarez","factory":"Fine Guitar Company, China","country":"China","yearCentury":2000}', 10),

('alvarez', 'alvarez-fg-factory-china-yymm-sequence', 'Alvarez FG Chinese partner factory YYMM sequence', '^FG\d{9,10}$', 'prefix-yymm-seq',
 '{"prefix":"FG","prefixLen":2,"brand":"Alvarez","factory":"Chinese partner factory (FG line)","country":"China","yearCentury":2000}', 20),

('alvarez', 'alvarez-st-factory-asia-yymm-sequence', 'Alvarez ST Asian partner factory YYMM sequence', '^ST\d{9,10}$', 'prefix-yymm-seq',
 '{"prefix":"ST","prefixLen":2,"brand":"Alvarez","factory":"Asian partner factory (ST line)","country":"Asia","yearCentury":2000}', 30),

-- Bespoke: single-letter prefix (dual-format: A/B routing with conditional year decode)
('alvarez', 'alvarez-modern-single-letter-standard', 'Alvarez modern single-letter standard', '^[A-Z]\d{8,9}$', 'bespoke', '{}', 40),
-- Bespoke: 8-digit numeric (dynamic century: yy<=30→2000s, yy>=85→1900s)
('alvarez', 'alvarez-numeric-8-digit', 'Alvarez 8-digit numeric (dynamic century)', '^\d{8}$', 'bespoke', '{}', 50),
-- Bespoke: long numeric 9-12 digits
('alvarez', 'alvarez-long-numeric', 'Alvarez long numeric (9-12 digits)', '^\d{9,12}$', 'bespoke', '{}', 60),
-- Bespoke: 6-7 digit (Emperor year with sequence)
('alvarez', 'alvarez-emperor-with-sequence', 'Alvarez Emperor year with sequence (6-7 digit)', '^\d{6,7}$', 'bespoke', '{}', 70),
-- Bespoke: 5-digit Yairi sequential
('alvarez', 'alvarez-yairi-sequential', 'Alvarez Yairi sequential (5-digit)', '^\d{5}$', 'bespoke', '{}', 80),
-- Bespoke: 4-digit Emperor/Showa/Heisei dating code
('alvarez', 'alvarez-emperor-dating-code', 'Alvarez Emperor/Showa/Heisei dating code (4-digit)', '^\d{4}$', 'bespoke', '{}', 90),

-- ============================================================
-- BC RICH
-- All bespoke — complex month-code maps, factory routing, and multi-format overlaps
-- ============================================================
('bcrich', 'bcrich-class-axe-ca-prefix', 'BC Rich Class Axe CA-prefix', '^CA\d{3,6}$', 'bespoke', '{}', 10),
('bcrich', 'bcrich-import-letter-nine-digit', 'BC Rich import letter 9-digit (SIFN prefix)', '^[SIFN]\d{9}$', 'bespoke', '{}', 20),
('bcrich', 'bcrich-import-letter-eight-digit', 'BC Rich import letter 8-digit (SIFN prefix)', '^[SIFN]\d{8}$', 'bespoke', '{}', 30),
('bcrich', 'bcrich-hanser-two-letter-month-plant', 'BC Rich Hanser era two-letter month+plant import', '^[ACEFGHJKLMNP][A-Z]\d{7}$', 'bespoke', '{}', 40),
('bcrich', 'bcrich-month-factory-code', 'BC Rich month+factory code (Hanser era 9-digit)', '^[ACEFGHJKLMNP][0-9]{8}$', 'bespoke', '{}', 50),
('bcrich', 'bcrich-short-month-code-import', 'BC Rich short month code import (8-digit)', '^[ACEFGHJKLMNP]\d{7}$', 'bespoke', '{}', 60),
('bcrich', 'bcrich-hanser-short-month-import', 'BC Rich Hanser short month code import (6-digit)', '^[ACEFGHJKLMNP]\d{5}$', 'bespoke', '{}', 70),
('bcrich', 'bcrich-b-prefix-month-code', 'BC Rich B-prefix month code import', '^B[ACEFGHJKLMNP]\d{8}$', 'bespoke', '{}', 80),
('bcrich', 'bcrich-f-series-pre2000', 'BC Rich F-series pre-2000 (year in 2nd digit)', '^F[7890]\d{5}$', 'bespoke', '{}', 90),
('bcrich', 'bcrich-f-six-digit', 'BC Rich F-prefix six-digit import', '^F\d{6}$', 'bespoke', '{}', 100),
('bcrich', 'bcrich-bolt-on-2000', 'BC Rich Bolt-On 2000-era (BO prefix)', '^BO\d{3}$', 'bespoke', '{}', 110),
('bcrich', 'bcrich-10-digit-numeric', 'BC Rich 10-digit numeric (Class Axe/Platinum era)', '^\d{10}$', 'bespoke', '{}', 120),
('bcrich', 'bcrich-nine-digit-numeric', 'BC Rich 9-digit numeric import', '^\d{9}$', 'bespoke', '{}', 130),
('bcrich', 'bcrich-hanser-era-8-digit', 'BC Rich Hanser era 8-digit date-stamp numeric', '^\d{8}$', 'bespoke', '{}', 140),
('bcrich', 'bcrich-nj-series-rp', 'BC Rich NJ Series R/P prefix', '^[RP]\d{6}$', 'bespoke', '{}', 150),
('bcrich', 'bcrich-class-axe-bc', 'BC Rich Class Axe BC-prefix', '^BC\d{5}$', 'bespoke', '{}', 160),
('bcrich', 'bcrich-class-axe-b-prefix', 'BC Rich Class Axe B-prefix (3-6 digit suffix)', '^B\d{3,6}$', 'bespoke', '{}', 170),
('bcrich', 'bcrich-hanser-calendar-month', 'BC Rich Hanser single-letter calendar month (A-L)', '^[A-L]\d{6}$', 'bespoke', '{}', 180),
('bcrich', 'bcrich-i-short-import', 'BC Rich I-prefix short import (6-digit)', '^I\d{5}$', 'bespoke', '{}', 190),
('bcrich', 'bcrich-7-digit-numeric', 'BC Rich 7-digit numeric import', '^\d{7}$', 'bespoke', '{}', 200),
('bcrich', 'bcrich-6-digit-numeric', 'BC Rich 6-digit numeric (early 2000s import)', '^\d{6}$', 'bespoke', '{}', 210),
('bcrich', 'bcrich-usa-5-digit-neck-through', 'BC Rich USA 5-digit neck-through (YYXXX)', '^\d{5}$', 'bespoke', '{}', 220),

-- ============================================================
-- EPIPHONE
-- Template: two-letter factory code + YYMM + sequence (fixed 2000 century)
-- ============================================================
('epiphone', 'epiphone-samick-indonesia-si-yymm-sequence', 'Epiphone Samick Indonesia SI YYMM sequence', '^SI\d{8,}$', 'prefix-yymm-seq',
 '{"prefix":"SI","prefixLen":2,"brand":"Epiphone","factory":"Samick, Indonesia","country":"Indonesia","yearCentury":2000}', 10),

('epiphone', 'epiphone-cort-indonesia-ci-yymm-sequence', 'Epiphone Cort Indonesia CI YYMM sequence', '^CI\d{8,}$', 'prefix-yymm-seq',
 '{"prefix":"CI","prefixLen":2,"brand":"Epiphone","factory":"Cort, Indonesia","country":"Indonesia","yearCentury":2000}', 20),

('epiphone', 'epiphone-daewon-china-dw-yymm-sequence', 'Epiphone DaeWon China DW YYMM sequence', '^DW\d{8,}$', 'prefix-yymm-seq',
 '{"prefix":"DW","prefixLen":2,"brand":"Epiphone","factory":"DaeWon, China","country":"China","yearCentury":2000}', 30),

('epiphone', 'epiphone-qingdao-acoustic-ea-yymm-sequence', 'Epiphone Qingdao Acoustic EA YYMM sequence', '^EA\d{8,}$', 'prefix-yymm-seq',
 '{"prefix":"EA","prefixLen":2,"brand":"Epiphone","factory":"Qingdao (Acoustic), China","country":"China","yearCentury":2000}', 40),

('epiphone', 'epiphone-qingdao-ee-yymm-sequence', 'Epiphone Qingdao EE YYMM sequence', '^EE\d{8,}$', 'prefix-yymm-seq',
 '{"prefix":"EE","prefixLen":2,"brand":"Epiphone","factory":"Qingdao, China","country":"China","yearCentury":2000}', 50),

('epiphone', 'epiphone-dongbei-ed-yymm-sequence', 'Epiphone Dongbei ED YYMM sequence', '^ED\d{8,}$', 'prefix-yymm-seq',
 '{"prefix":"ED","prefixLen":2,"brand":"Epiphone","factory":"Dongbei, China","country":"China","yearCentury":2000}', 60),

('epiphone', 'epiphone-unknown-indonesian-mc-yymm-sequence', 'Epiphone unknown Indonesian MC YYMM sequence', '^MC\d{8,}$', 'prefix-yymm-seq',
 '{"prefix":"MC","prefixLen":2,"brand":"Epiphone","factory":"Unknown Indonesian factory","country":"Indonesia","yearCentury":2000}', 70),

-- Bespoke: numeric factory format (YYMM + 2-digit factory code lookup table)
('epiphone', 'epiphone-numeric-factory-format', 'Epiphone numeric factory format (YYMM + factory code)', '^\d{10,11}$', 'bespoke', '{}', 80),
-- Bespoke: 7-digit numeric (Y+MM+seq or vintage Japan — requires conditional routing)
('epiphone', 'epiphone-1990s-7-digit-numeric', 'Epiphone 1990s 7-digit numeric', '^\d{7}$', 'bespoke', '{}', 90),
-- Bespoke: single-letter Korean factory (dynamic century: yy>=80→1900s, else 2000s)
('epiphone', 'epiphone-korea-single-letter-factory', 'Epiphone Korea single-letter factory (dynamic century)', '^[A-Z]\d{7,}$', 'bespoke', '{}', 100),
-- Bespoke: letter-year format (single digit year encoded after letter, 5-6 digit total after letter)
('epiphone', 'epiphone-letter-year-format', 'Epiphone letter-year single-digit year format', '^[A-Z]\d{5,6}$', 'bespoke', '{}', 110),
-- Bespoke: F-serial (no year encoding)
('epiphone', 'epiphone-f-serial-format', 'Epiphone F-serial format (no year)', '^F\d+$', 'bespoke', '{}', 120),
-- Bespoke: vintage 4-5 digit
('epiphone', 'epiphone-vintage-4-5-digit', 'Epiphone vintage 4-5 digit sequential', '^\d{4,5}$', 'bespoke', '{}', 130),

-- ============================================================
-- ERNIE BALL / MUSICMAN
-- All bespoke — sequential/range lookup only, no YY encoding
-- ============================================================
('ernieball', 'ernieball-majesty-m-prefix', 'Ernie Ball Majesty M-prefix (no year encoding)', '^M\d{5,6}$', 'bespoke', '{}', 10),
('ernieball', 'ernieball-h-series', 'Ernie Ball H-series (year range)', '^H\d{5}$', 'bespoke', '{}', 20),
('ernieball', 'ernieball-g-series', 'Ernie Ball G-series (year range)', '^G\d{5}$', 'bespoke', '{}', 30),
('ernieball', 'ernieball-j-series', 'Ernie Ball J-series (year range)', '^J\d{5,6}$', 'bespoke', '{}', 40),
('ernieball', 'ernieball-d-series', 'Ernie Ball D-series (year range)', '^D\d{5}$', 'bespoke', '{}', 50),
('ernieball', 'ernieball-l-series', 'Ernie Ball L-series (year range)', '^L\d{5}$', 'bespoke', '{}', 60),
('ernieball', 'ernieball-f-series', 'Ernie Ball F-series (year range)', '^F\d{5}$', 'bespoke', '{}', 70),
('ernieball', 'ernieball-s-series', 'Ernie Ball S-series (year range)', '^S\d{5}$', 'bespoke', '{}', 80),
('ernieball', 'ernieball-x-series', 'Ernie Ball X-series (year range)', '^X\d{5}$', 'bespoke', '{}', 90),
('ernieball', 'ernieball-a-series', 'Ernie Ball A-series (year range)', '^A\d{5,6}$', 'bespoke', '{}', 100),
('ernieball', 'ernieball-e-series', 'Ernie Ball E-series (year range)', '^E\d{5,6}$', 'bespoke', '{}', 110),
('ernieball', 'ernieball-b-series', 'Ernie Ball B-series (year range)', '^B\d{5,6}$', 'bespoke', '{}', 120),
('ernieball', 'ernieball-sterling-sr-indonesia', 'Ernie Ball Sterling SR-prefix Indonesia (no date encoding)', '^SR\d{5,6}$', 'bespoke', '{}', 130),
('ernieball', 'ernieball-5-digit-numeric', 'Ernie Ball 5-digit sequential (range estimate)', '^\d{5}$', 'bespoke', '{}', 140),
('ernieball', 'ernieball-6-digit-numeric', 'Ernie Ball 6-digit sequential (range estimate)', '^\d{6}$', 'bespoke', '{}', 150),

-- ============================================================
-- FENDER
-- Template: Indonesian factories — ordered most-specific prefix first
-- Template: Corona (US), Ensenada (MX), Dyna Gakki Japan (JD)
-- ============================================================
-- Indonesia ICS (3-char prefix, most specific)
('fender', 'fender-indonesia-ics-yy-sequence', 'Fender Indonesia ICS-prefix YY sequence', '^ICS\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"ICS","prefixLen":3,"brand":"Fender","factory":"Indonesian factory (Cort or other)","country":"Indonesia","yearCentury":2000}', 10),

-- Indonesia IC (2-char prefix; does not match ICS since S is a letter, not a digit)
('fender', 'fender-indonesia-ic-yy-sequence', 'Fender Indonesia IC-prefix YY sequence', '^IC\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"IC","prefixLen":2,"brand":"Fender","factory":"Indonesian factory (Cort)","country":"Indonesia","yearCentury":2000}', 20),

-- Indonesia IS (2-char prefix)
('fender', 'fender-indonesia-is-yy-sequence', 'Fender Indonesia IS-prefix YY sequence', '^IS\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"IS","prefixLen":2,"brand":"Fender","factory":"Indonesian factory (Samick)","country":"Indonesia","yearCentury":2000}', 30),

-- Indonesia I (1-char prefix; I followed immediately by digits — does not match IC/IS/ICS)
('fender', 'fender-indonesia-i-yy-sequence', 'Fender Indonesia I-prefix YY sequence', '^I\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"I","prefixLen":1,"brand":"Fender","factory":"Fender Indonesia","country":"Indonesia","yearCentury":2000}', 40),

-- Japan: Dyna Gakki / Fender Japan network (JD + YY + exactly 6-digit seq = 10 total)
('fender', 'fender-japan-jd-yy-sequence', 'Fender Japan JD Dyna Gakki YY sequence', '^JD\d{8}$', 'prefix-yy-seq',
 '{"prefix":"JD","prefixLen":2,"brand":"Fender","factory":"Dyna Gakki / Fender Japan network","country":"Japan","yearCentury":2000}', 50),

-- USA: Corona, California (US + YY + seq)
('fender', 'fender-usa-corona-yy-sequence', 'Fender USA Corona YY sequence', '^US\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"US","prefixLen":2,"brand":"Fender","factory":"Corona, California","country":"USA","yearCentury":2000}', 60),

-- Mexico: Ensenada (MX + YY + seq)
('fender', 'fender-mexico-ensenada-yy-sequence', 'Fender Mexico Ensenada YY sequence', '^MX\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"MX","prefixLen":2,"brand":"Fender","factory":"Ensenada, Mexico","country":"Mexico","yearCentury":2000}', 70),

-- Bespoke: single-digit-year prefix formats (century hard-coded in V1 decode)
('fender', 'fender-dz-single-digit-year', 'Fender DZ single-digit year (2000s)', '^DZ\d{7,9}$', 'bespoke', '{}', 80),
('fender', 'fender-mz-single-digit-year', 'Fender MZ single-digit year (2000s)', '^MZ\d{7,8}$', 'bespoke', '{}', 90),
('fender', 'fender-mn-single-digit-year', 'Fender MN single-digit year (1990s)', '^MN\d{7,8}$', 'bespoke', '{}', 100),
('fender', 'fender-z-single-digit-year', 'Fender Z single-digit year (2000s)', '^Z\d{7,8}$', 'bespoke', '{}', 110),
('fender', 'fender-n-single-digit-year', 'Fender N single-digit year (1990s)', '^N\d{7,8}$', 'bespoke', '{}', 120),
('fender', 'fender-e-single-digit-year', 'Fender E single-digit year (1980s)', '^E\d{7,8}$', 'bespoke', '{}', 130),
('fender', 'fender-s-single-digit-year', 'Fender S single-digit year (1970s-80s)', '^S\d{7,8}$', 'bespoke', '{}', 140),
-- Bespoke: other letter prefix formats
('fender', 'fender-jff-series', 'Fender JFF series Japan', '^JFF\d{6,8}$', 'bespoke', '{}', 150),
('fender', 'fender-jv-japan-vintage', 'Fender JV Japan vintage (1982-1984)', '^JV\d{5,6}$', 'bespoke', '{}', 160),
('fender', 'fender-j-prefix-japan', 'Fender J-prefix (Fender Japan general)', '^J\d{6,8}$', 'bespoke', '{}', 170),
('fender', 'fender-v-avri', 'Fender V American Vintage Reissue', '^V\d{5,6}$', 'bespoke', '{}', 180),
('fender', 'fender-japan-letter-a-h-prefix', 'Fender Japan letter A-H prefix (year range)', '^[A-H]\d{6,8}$', 'bespoke', '{}', 190),
('fender', 'fender-korea-ko-prefix', 'Fender Korea KO/K prefix', '^KO?\d{6,8}$', 'bespoke', '{}', 200),
-- Bespoke: numeric formats
('fender', 'fender-internal-part-number', 'Fender internal part number (00-prefix)', '^00\d{8}$', 'bespoke', '{}', 210),
('fender', 'fender-japan-acoustic-7-digit', 'Fender Japan acoustic label 7-digit', '^\d{7}$', 'bespoke', '{}', 220),
('fender', 'fender-vintage-5-6-digit', 'Fender vintage 5-6 digit sequential', '^\d{5,6}$', 'bespoke', '{}', 230),
('fender', 'fender-early-vintage-4-digit', 'Fender early vintage 4-digit', '^\d{4}$', 'bespoke', '{}', 240),

-- ============================================================
-- GIBSON
-- All bespoke — interleaved year digits (YDDDYRRR), day-of-year, range lookups
-- ============================================================
('gibson', 'gibson-custom-shop-zw-artist', 'Gibson Custom Shop ZW artist prefix (Zakk Wylde)', '^ZW\d{3,4}$', 'bespoke', '{}', 10),
('gibson', 'gibson-custom-shop-cs-prefix', 'Gibson Custom Shop CS prefix (single-digit year)', '^CS\d{5,6}$', 'bespoke', '{}', 20),
('gibson', 'gibson-modern-8-digit-ydddyrrr', 'Gibson modern 8-digit YDDDYRRR (interleaved year + day-of-year)', '^\d{8}$', 'bespoke', '{}', 30),
('gibson', 'gibson-modern-9-digit-ydddybrrr', 'Gibson modern 9-digit YDDDYBRRR', '^\d{9}$', 'bespoke', '{}', 40),
('gibson', 'gibson-1970s-6-digit', 'Gibson 1970s 6-digit format', '^\d{6}$', 'bespoke', '{}', 50),
('gibson', 'gibson-vintage-4-5-digit', 'Gibson vintage 4-5 digit sequential (range lookup)', '^\d{4,5}$', 'bespoke', '{}', 60),

-- ============================================================
-- GODIN
-- All bespoke — week-based fiscal year (YYWWDRRR), SKU-based, single-digit year codes
-- ============================================================
('godin', 'godin-norman-b-prefix', 'Godin Norman B-prefix (Norman brand)', '^B\d+$', 'bespoke', '{}', 10),
('godin', 'godin-factory-second-f-prefix', 'Godin factory second F-prefix', '^F\d+$', 'bespoke', '{}', 20),
('godin', 'godin-12-digit-sku-based', 'Godin 12-digit SKU-based format', '^\d{12}$', 'bespoke', '{}', 30),
('godin', 'godin-8-digit-yywwdrrr', 'Godin 8-digit YYWWDRRR (fiscal year week format)', '^\d{8}$', 'bespoke', '{}', 40),
('godin', 'godin-7-digit-y-sequential', 'Godin 7-digit Y+sequential (1990s single-digit year)', '^\d{7}$', 'bespoke', '{}', 50),
('godin', 'godin-5-digit-transitional', 'Godin 5-digit transitional format', '^\d{5}$', 'bespoke', '{}', 60),
('godin', 'godin-4-digit-sequential', 'Godin 4-digit sequential', '^\d{4}$', 'bespoke', '{}', 70),
('godin', 'godin-6-digit-pre-modern', 'Godin 6-digit pre-modern', '^\d{6}$', 'bespoke', '{}', 80),
('godin', 'godin-pre-modern-1-3-digit', 'Godin pre-modern 1-3 digit sequential', '^\d{1,3}$', 'bespoke', '{}', 90),

-- ============================================================
-- GRETSCH
-- Template: Fender era (2003+) factory code prefix + YYMM + 4-digit sequence
-- One row per factory code for correct factory/country metadata
-- ============================================================
('gretsch', 'gretsch-fender-era-jt-terada-yymm', 'Gretsch Fender era JT Terada Japan YYMM sequence', '^JT\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"JT","prefixLen":2,"brand":"Gretsch","factory":"Terada Factory, Japan","country":"Japan","yearCentury":2000}', 10),

('gretsch', 'gretsch-fender-era-jd-dyna-yymm', 'Gretsch Fender era JD Dyna Gakki Japan YYMM sequence', '^JD\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"JD","prefixLen":2,"brand":"Gretsch","factory":"Dyna Gakki Factory, Japan","country":"Japan","yearCentury":2000}', 20),

('gretsch', 'gretsch-fender-era-jf-fujigen-yymm', 'Gretsch Fender era JF Fuji-Gen Japan YYMM sequence', '^JF\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"JF","prefixLen":2,"brand":"Gretsch","factory":"Fuji-Gen Gakki Factory, Japan","country":"Japan","yearCentury":2000}', 30),

('gretsch', 'gretsch-fender-era-cs-custom-shop-yymm', 'Gretsch Fender era CS Custom Shop USA YYMM sequence', '^CS\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"CS","prefixLen":2,"brand":"Gretsch","factory":"Gretsch Custom Shop","country":"USA","yearCentury":2000}', 40),

('gretsch', 'gretsch-fender-era-cy-yako-china-yymm', 'Gretsch Fender era CY Yako China YYMM sequence', '^CY\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"CY","prefixLen":2,"brand":"Gretsch","factory":"Yako, China","country":"China","yearCentury":2000}', 50),

('gretsch', 'gretsch-fender-era-kp-peerless-korea-yymm', 'Gretsch Fender era KP Peerless Korea YYMM sequence', '^KP\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"KP","prefixLen":2,"brand":"Gretsch","factory":"Peerless Factory, South Korea","country":"South Korea","yearCentury":2000}', 60),

('gretsch', 'gretsch-fender-era-ks-samick-korea-yymm', 'Gretsch Fender era KS SPG/Samick Korea YYMM sequence', '^KS\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"KS","prefixLen":2,"brand":"Gretsch","factory":"SPG/Samick Factory, South Korea","country":"South Korea","yearCentury":2000}', 70),

-- Bespoke: Fender era with optional suffix letter (prefixLen=3; V1 handles factory detection)
('gretsch', 'gretsch-fender-era-three-char-suffix-letter', 'Gretsch Fender era factory code + suffix letter (3-char prefix)', '^(JT|JD|JF|CS|CY|KP|KS)[A-Z]\d{8}$', 'bespoke', '{}', 80),
-- Bespoke: Japan Revival (model code embedded mid-serial)
('gretsch', 'gretsch-japan-revival-model-code', 'Gretsch Japan Revival model code mid-serial format', '^\d{6}-?\d{3}$', 'bespoke', '{}', 90),
-- Bespoke: Baldwin hyphen format
('gretsch', 'gretsch-baldwin-hyphen-format', 'Gretsch Baldwin hyphen format', '^\d{1,2}-\d{3}$', 'bespoke', '{}', 100),
-- Bespoke: Baldwin date-coded or sequential 5-6 digit
('gretsch', 'gretsch-baldwin-sequential', 'Gretsch Baldwin sequential (5-6 digit)', '^\d{5,6}$', 'bespoke', '{}', 110),
-- Bespoke: pre-Baldwin sequential 3-4 digit
('gretsch', 'gretsch-pre-baldwin-sequential', 'Gretsch pre-Baldwin sequential (3-4 digit)', '^\d{3,4}$', 'bespoke', '{}', 120),

-- ============================================================
-- GUILD
-- Template: Zaozhuang China Z-prefix (2000s only, yearCentury=2000)
-- Template: Indonesia Samick SI-prefix (2000s)
-- Template: GAD 10-digit neck block code (YYMM + batch + unit)
-- ============================================================
('guild', 'guild-zaozhuang-china-z-yy-sequence', 'Guild Zaozhuang China Z-prefix YY sequence', '^Z\d{6,10}$', 'prefix-yy-seq',
 '{"prefix":"Z","prefixLen":1,"brand":"Guild","factory":"Zaozhuang Saehan, China","country":"China","yearCentury":2000}', 10),

('guild', 'guild-indonesia-samick-si-yy-sequence', 'Guild Indonesia Samick SI-prefix YY sequence', '^SI\d{6,10}$', 'prefix-yy-seq',
 '{"prefix":"SI","prefixLen":2,"brand":"Guild","factory":"Indonesia (Samick)","country":"Indonesia","yearCentury":2000}', 20),

('guild', 'guild-gad-10-digit-yymm-sequence', 'Guild GAD 10-digit neck block YYMM sequence', '^\d{10}$', 'numeric-yymm-seq',
 '{"yearStart":0,"monthStart":2,"seqStart":4,"brand":"Guild","factory":"Guild GAD Chinese import production","country":"China","yearCentury":2000}', 30),

-- Bespoke: letter-based formats (year letter + Julian day, or no year)
('guild', 'guild-tacoma-t-prefix', 'Guild Tacoma T-prefix (year letter + Julian day)', '^T[A-Z]\d{6}$', 'bespoke', '{}', 40),
('guild', 'guild-new-hartford-n-prefix', 'Guild New Hartford N-prefix (year letter + Julian day)', '^N[A-Z]\d{6}$', 'bespoke', '{}', 50),
('guild', 'guild-corona-c-prefix', 'Guild Corona C-prefix (no year encoding)', '^C[A-Z]?\d{5,8}$', 'bespoke', '{}', 60),
('guild', 'guild-korea-y-dynamic-century', 'Guild Korea Y-prefix (dynamic century)', '^Y\d{6,10}$', 'bespoke', '{}', 70),
('guild', 'guild-korea-ks-prefix', 'Guild Korea KS-prefix (no year)', '^KS\d{6,10}$', 'bespoke', '{}', 80),
('guild', 'guild-gad-prefix-text', 'Guild GAD prefix series (no date encoding)', '^GAD\d+$', 'bespoke', '{}', 90),
('guild', 'guild-model-prefix-two-letter', 'Guild two-letter model prefix format', '^[A-Z]{2}\d{5,8}$', 'bespoke', '{}', 100),
('guild', 'guild-sequential-5-6-digit', 'Guild sequential 5-6 digit (range lookup)', '^\d{5,6}$', 'bespoke', '{}', 110),
('guild', 'guild-long-numeric-7-9-digit', 'Guild long numeric 7-9 digit', '^\d{7,9}$', 'bespoke', '{}', 120),

-- ============================================================
-- MARTIN
-- All bespoke — pure sequential range lookup (1898–present), no YY encoding
-- ============================================================
('martin', 'martin-all-numeric-sequential', 'Martin all-numeric sequential (range lookup table)', '^\d+$', 'bespoke', '{}', 10),

-- ============================================================
-- OVATION
-- All bespoke — range lookups, import estimates, complex routing
-- ============================================================
('ovation', 'ovation-sn-prefix-usa', 'Ovation SN-prefix USA', '^SN\d{6}$', 'bespoke', '{}', 10),
('ovation', 'ovation-letter-prefix-3-6-digit', 'Ovation letter A-L prefix 3-6 digit (range lookup)', '^[A-L]\d{3,6}$', 'bespoke', '{}', 20),
('ovation', 'ovation-3-digit', 'Ovation 3-digit early format', '^\d{3}$', 'bespoke', '{}', 30),
('ovation', 'ovation-4-digit', 'Ovation 4-digit format', '^\d{4}$', 'bespoke', '{}', 40),
('ovation', 'ovation-5-digit', 'Ovation 5-digit format', '^\d{5}$', 'bespoke', '{}', 50),
('ovation', 'ovation-6-digit-usa', 'Ovation 6-digit USA (range lookup)', '^\d{6}$', 'bespoke', '{}', 60),
('ovation', 'ovation-korea-21-prefix', 'Ovation Korea 21-prefix import', '^21\d{5}$', 'bespoke', '{}', 70),
('ovation', 'ovation-7-10-digit-import', 'Ovation 7-10 digit import (rough year estimate)', '^\d{7,10}$', 'bespoke', '{}', 80),
('ovation', 'ovation-import-with-prefix', 'Ovation import with 1-3 letter prefix', '^[A-Z]{1,3}\d{6,10}$', 'bespoke', '{}', 90),

-- ============================================================
-- PRS
-- Template: Acoustic A-prefix + YY + sequence (2000s only)
-- Template: USA set-neck 2008+ (first 2 digits = YY, 08-49 range)
-- ============================================================
('prs', 'prs-acoustic-a-yy-sequence', 'PRS Acoustic A-prefix YY sequence', '^A\d{5,}$', 'prefix-yy-seq',
 '{"prefix":"A","prefixLen":1,"brand":"PRS","factory":"PRS Guitars factory, Stevensville, Maryland","country":"USA","model":"Acoustic Guitar","yearCentury":2000}', 10),

-- USA set-neck 2008+ (YY in first 2 digits = 08-49 = 2008-2049; no month encoding)
('prs', 'prs-usa-2008-plus-yy-sequence', 'PRS USA set-neck 2008+ YY sequence', '^(?:0[89]|[1-4]\d)\d{5,}$', 'numeric-yymm-seq',
 '{"yearStart":0,"seqStart":2,"brand":"PRS","factory":"PRS Guitars factory, Stevensville, Maryland","country":"USA","yearCentury":2000}', 20),

-- Bespoke: various PRS series
('prs', 'prs-s2-series', 'PRS S2 series (sequential, no year encoding)', '^S2\d{6}$', 'bespoke', '{}', 30),
('prs', 'prs-se-cort-factory', 'PRS SE Cort factory (CTC/CTI + letter year code)', '^CT[CI][A-Z]\d+$', 'bespoke', '{}', 40),
('prs', 'prs-se-korea-letter-year', 'PRS SE Korea (letter year code, 4-6 digit)', '^[A-Z]\d{4,6}$', 'bespoke', '{}', 50),
('prs', 'prs-ce-prefix', 'PRS CE prefix (no YY encoding)', '^CE\d+$', 'bespoke', '{}', 60),
('prs', 'prs-ec-eg-prefix', 'PRS EC/EG prefix (no YY encoding)', '^EC\d+$', 'bespoke', '{}', 70),
('prs', 'prs-swamp-ash-sa-prefix', 'PRS Swamp Ash SA prefix (no YY encoding)', '^SA\d+$', 'bespoke', '{}', 80),
('prs', 'prs-electric-bass-eb-prefix', 'PRS Electric Bass EB prefix (no YY encoding)', '^EB\d+$', 'bespoke', '{}', 90),
('prs', 'prs-usa-set-neck-vintage', 'PRS USA set-neck vintage 5-7 digit (pre-2008, range or single-digit year)', '^\d{5,7}$', 'bespoke', '{}', 100),
('prs', 'prs-ce-year-digit-prefix', 'PRS CE with leading year digit', '^[0-9]CE\d+$', 'bespoke', '{}', 110),
-- Legacy model digit prefixes
('prs', 'prs-ce-old-7-prefix', 'PRS CE Old 7-prefix bolt-on', '^7\d{4,}$', 'bespoke', '{}', 120),
('prs', 'prs-eg-old-5-prefix', 'PRS EG Old 5-prefix', '^5\d{4,}$', 'bespoke', '{}', 130),
('prs', 'prs-swamp-ash-old-8-prefix', 'PRS Swamp Ash Old 8-prefix', '^8\d{4,}$', 'bespoke', '{}', 140),
('prs', 'prs-bolt-on-bass-4-prefix', 'PRS Bolt-On Bass 4-prefix', '^4\d{4,}$', 'bespoke', '{}', 150),
('prs', 'prs-set-neck-bass-9-prefix', 'PRS Set-Neck Bass 9-prefix', '^9\d{4,}$', 'bespoke', '{}', 160),

-- ============================================================
-- RICKENBACKER
-- All bespoke — week-based (YYWWNNN), letter year/month codes, complex routing
-- ============================================================
('rickenbacker', 'rickenbacker-modern-7-8-digit-yyww', 'Rickenbacker modern 7-8 digit (YYWWNNN week format)', '^\d{7,8}$', 'bespoke', '{}', 10),
('rickenbacker', 'rickenbacker-two-letter-prefix', 'Rickenbacker two-letter prefix (letter year/month codes)', '^[A-Z]{2}\d{2,4}$', 'bespoke', '{}', 20),
('rickenbacker', 'rickenbacker-reversed-format', 'Rickenbacker reversed A-L letter format (month=letter, year=digit)', '^[A-L][0-9]\d{2,4}$', 'bespoke', '{}', 30),
('rickenbacker', 'rickenbacker-transitional', 'Rickenbacker M-X transitional format', '^[M-X][01]\d{2,4}$', 'bespoke', '{}', 40),
('rickenbacker', 'rickenbacker-early-solidbody', 'Rickenbacker early solidbody (model+type+year prefix)', '^(4|6|65|8|85)[CBMV][4-9]\d{2,4}$', 'bespoke', '{}', 50),
('rickenbacker', 'rickenbacker-short-scale-v', 'Rickenbacker short scale V-prefix', '^V[4-9]\d{2,4}$', 'bespoke', '{}', 60),
('rickenbacker', 'rickenbacker-hollowbody', 'Rickenbacker hollowbody TVR prefix', '^[23][TVR]\d{2,4}$', 'bespoke', '{}', 70),
('rickenbacker', 'rickenbacker-cm-prefix', 'Rickenbacker CM prefix format', '^CM\d{2,5}$', 'bespoke', '{}', 80),
('rickenbacker', 'rickenbacker-sequential-only', 'Rickenbacker sequential only (3-5 digit)', '^\d{3,5}$', 'bespoke', '{}', 90),

-- ============================================================
-- SQUIER
-- Template: Indonesian factory prefixes (fixed 2000 century)
-- Template: China factory prefixes with fixed 2000 century
-- Template: China 9-digit numeric YYMM+seq
-- ============================================================

-- Indonesia Cort (ICS > ICF/ICO > IC — most specific prefix tried first)
('squier', 'squier-indonesia-ics-yy-sequence', 'Squier Indonesia ICS Cort YY sequence', '^ICS\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"ICS","prefixLen":3,"brand":"Squier","factory":"Cort, Indonesia","country":"Indonesia","yearCentury":2000}', 10),

('squier', 'squier-indonesia-icf-yy-sequence', 'Squier Indonesia ICF Cort YY sequence', '^ICF\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"ICF","prefixLen":3,"brand":"Squier","factory":"Cort, Indonesia","country":"Indonesia","yearCentury":2000}', 20),

('squier', 'squier-indonesia-ico-yy-sequence', 'Squier Indonesia ICO Cort YY sequence', '^ICO\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"ICO","prefixLen":3,"brand":"Squier","factory":"Cort, Indonesia","country":"Indonesia","yearCentury":2000}', 30),

('squier', 'squier-indonesia-ic-yy-sequence', 'Squier Indonesia IC Cort YY sequence', '^IC\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"IC","prefixLen":2,"brand":"Squier","factory":"Cort, Indonesia","country":"Indonesia","yearCentury":2000}', 40),

-- Indonesia Samick (IS, SI)
('squier', 'squier-indonesia-is-yy-sequence', 'Squier Indonesia IS Samick YY sequence', '^IS\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"IS","prefixLen":2,"brand":"Squier","factory":"Samick, Indonesia","country":"Indonesia","yearCentury":2000}', 50),

('squier', 'squier-indonesia-si-yy-sequence', 'Squier Indonesia SI Samick YY sequence', '^SI\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"SI","prefixLen":2,"brand":"Squier","factory":"Samick, Indonesia","country":"Indonesia","yearCentury":2000}', 60),

-- China factories with fixed 2000 century
('squier', 'squier-china-css-samick-yy-sequence', 'Squier China CSS Samick YY sequence', '^CSS\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"CSS","prefixLen":3,"brand":"Squier","factory":"Samick, China","country":"China","yearCentury":2000}', 70),

('squier', 'squier-china-cgs-grand-reward-yy-sequence', 'Squier China CGS Grand Reward YY sequence', '^CGS\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"CGS","prefixLen":3,"brand":"Squier","factory":"Grand Reward, China","country":"China","yearCentury":2000}', 80),

('squier', 'squier-china-cgr-grand-reward-yy-sequence', 'Squier China CGR Grand Reward YY sequence', '^CGR\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"CGR","prefixLen":3,"brand":"Squier","factory":"Grand Reward, China","country":"China","yearCentury":2000}', 90),

('squier', 'squier-china-cgt-grand-reward-yy-sequence', 'Squier China CGT Grand Reward YY sequence', '^CGT\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"CGT","prefixLen":3,"brand":"Squier","factory":"Grand Reward, China","country":"China","yearCentury":2000}', 100),

('squier', 'squier-china-cob-cortek-yy-sequence', 'Squier China COB Cor-Tek YY sequence', '^COB\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"COB","prefixLen":3,"brand":"Squier","factory":"Cor-Tek (Cort), China","country":"China","yearCentury":2000}', 110),

('squier', 'squier-china-cos-cortek-yy-sequence', 'Squier China COS Cor-Tek YY sequence', '^COS\d{2}\d+$', 'prefix-yy-seq',
 '{"prefix":"COS","prefixLen":3,"brand":"Squier","factory":"Cor-Tek (Cort), China","country":"China","yearCentury":2000}', 120),

-- China C single-prefix Yako early 2000s (C + YY + 4-6 digit seq; does not match CSS/CGS/etc because those have letters after C)
('squier', 'squier-china-c-single-prefix-yy-sequence', 'Squier China C single-prefix Yako YY sequence', '^C\d{2}\d{4,6}$', 'prefix-yy-seq',
 '{"prefix":"C","prefixLen":1,"brand":"Squier","factory":"Yako / Chinese Squier production","country":"China","yearCentury":2000}', 130),

-- China SE Strat Pack 9-digit YYMM+seq (numeric-yymm-seq, yearCentury=2000)
('squier', 'squier-china-9-digit-yymm-sequence', 'Squier China 9-digit YYMM sequence (SE/Strat Pack)', '^\d{9}$', 'numeric-yymm-seq',
 '{"yearStart":0,"monthStart":2,"seqStart":4,"brand":"Squier","factory":"China (SE/Strat Pack production)","country":"China","model":"Squier Strat SE (Special Edition)","yearCentury":2000}', 140),

-- Bespoke: Japan series
('squier', 'squier-japan-jv-vintage', 'Squier Japan JV vintage (1982-1984, FujiGen)', '^JV\d{5,6}$', 'bespoke', '{}', 150),
('squier', 'squier-japan-sq-series', 'Squier Japan SQ series (1983-1984, FujiGen)', '^SQ\d{5,6}$', 'bespoke', '{}', 160),
('squier', 'squier-e-prefix-ambiguous', 'Squier E-prefix (Japan/USA/Korea — ambiguous, check label)', '^E\d{6,7}$', 'bespoke', '{}', 170),
('squier', 'squier-japan-letter-prefix', 'Squier Japan CIJ letter prefix A-U (year range)', '^[A-U]\d{6,7}$', 'bespoke', '{}', 180),
-- Bespoke: Korea (dynamic century or fixed 1990s decade)
('squier', 'squier-korea-vn-1990s', 'Squier Korea VN Sunghan (fixed 199X decade)', '^VN\d{6,7}$', 'bespoke', '{}', 190),
('squier', 'squier-korea-kc-dynamic-century', 'Squier Korea KC Cor-Tek (dynamic century: yy>=90→1900s)', '^KC\d{8}$', 'bespoke', '{}', 200),
('squier', 'squier-korea-kv-dynamic-century', 'Squier Korea KV Sunghan (dynamic century: yy>=90→1900s)', '^KV\d{8}$', 'bespoke', '{}', 210),
('squier', 'squier-korea-cn-1990s', 'Squier Korea CN Cor-Tek (fixed 199X decade)', '^CN\d{6,7}$', 'bespoke', '{}', 220),
('squier', 'squier-korea-s-samick', 'Squier Korea S Samick (year range estimate)', '^S\d{6,7}$', 'bespoke', '{}', 230),
('squier', 'squier-korea-m-prefix', 'Squier Korea M-prefix (early 1990s, year range)', '^M\d{7}$', 'bespoke', '{}', 240),
-- Bespoke: Indonesia (non-template)
('squier', 'squier-indonesia-iss-samick', 'Squier Indonesia ISS Samick (no year encoding)', '^ISS\d{6}$', 'bespoke', '{}', 250),
('squier', 'squier-indonesia-ics-letter-2021plus', 'Squier Indonesia ICS+letter (2021+ month letter code)', '^ICS[A-L]\d{2}\d+$', 'bespoke', '{}', 260),
-- Bespoke: China (non-template: dynamic century or month letter codes)
('squier', 'squier-china-cyk-yako-month-letter', 'Squier China CYK Yako month letter (2020+)', '^CYK[A-L]\d{2}\d+$', 'bespoke', '{}', 270),
('squier', 'squier-china-cmc-muse-month-letter', 'Squier China CMC Muse factory month letter (2020+)', '^CMC[A-L]\d{2}\d+$', 'bespoke', '{}', 280),
('squier', 'squier-china-cy-yako-dynamic-century', 'Squier China CY Yako (dynamic century: yy>=90→1900s)', '^CY\d{2}\d+$', 'bespoke', '{}', 290),
('squier', 'squier-china-yn-yako', 'Squier China YN Yako (ambiguous year interpretation)', '^YN\d{6,7}$', 'bespoke', '{}', 300),
('squier', 'squier-china-cxs-axl', 'Squier China CXS AXL factory (MMYY+seq)', '^CXS\d{2}\d{2}\d+$', 'bespoke', '{}', 310),
('squier', 'squier-china-cae-axl', 'Squier China CA/CAE AXL factory', '^CAE?\d{2}\d+$', 'bespoke', '{}', 320),
('squier', 'squier-china-nc-1990s', 'Squier China NC mid-1990s (single digit year)', '^NC\d{6}$', 'bespoke', '{}', 330),
-- Bespoke: Mexico (single digit year)
('squier', 'squier-mexico-mn-1990s', 'Squier Mexico MN (single digit year, 1990s)', '^MN\d+$', 'bespoke', '{}', 340),
('squier', 'squier-mexico-mz-2000s', 'Squier Mexico MZ (single digit year, 2000s)', '^MZ\d+$', 'bespoke', '{}', 350),
-- Bespoke: USA N prefix (rare, single digit year)
('squier', 'squier-usa-n-prefix', 'Squier USA N-prefix (single digit year, rare)', '^N\d{6,7}$', 'bespoke', '{}', 360),
-- Bespoke: Korea numeric-only (first digit = year digit estimate)
('squier', 'squier-korea-numeric-6-7-digit', 'Squier Korea numeric 6-7 digit (first digit = year estimate)', '^\d{6,7}$', 'bespoke', '{}', 370),
-- Bespoke: 8-digit numeric (V1 explicitly returns an error for this format)
('squier', 'squier-8-digit-numeric-unsupported', 'Squier 8-digit numeric (not a standard Squier format)', '^\d{8}$', 'bespoke', '{}', 380),

-- ============================================================
-- TAKAMINE
-- Template: Samick Indonesia/Korea/China SI/SK/SC prefix + YYMM + seq (2000s)
-- Bespoke: all numeric formats (complex year offset from 1962 or Korean G series)
-- ============================================================
('takamine', 'takamine-samick-indonesia-si-yymm-sequence', 'Takamine Samick Indonesia SI YYMM sequence', '^SI\d{6,10}$', 'prefix-yymm-seq',
 '{"prefix":"SI","prefixLen":2,"brand":"Takamine","factory":"Samick factory, Indonesia","country":"Indonesia","yearCentury":2000}', 10),

('takamine', 'takamine-samick-korea-sk-yymm-sequence', 'Takamine Samick Korea SK YYMM sequence', '^SK\d{6,10}$', 'prefix-yymm-seq',
 '{"prefix":"SK","prefixLen":2,"brand":"Takamine","factory":"Samick factory, South Korea","country":"South Korea","yearCentury":2000}', 20),

('takamine', 'takamine-samick-china-sc-yymm-sequence', 'Takamine Samick China SC YYMM sequence', '^SC\d{6,10}$', 'prefix-yymm-seq',
 '{"prefix":"SC","prefixLen":2,"brand":"Takamine","factory":"Samick factory, China","country":"China","yearCentury":2000}', 30),

-- Bespoke: numeric formats (post-2012 uses offset from 1962; pre-2012 uses offset or Korean G series)
('takamine', 'takamine-10-digit-numeric', 'Takamine 10-digit numeric (complex year offset from 1962)', '^\d{10}$', 'bespoke', '{}', 40),
('takamine', 'takamine-9-digit-numeric', 'Takamine 9-digit numeric', '^\d{9}$', 'bespoke', '{}', 50),
('takamine', 'takamine-8-digit-numeric', 'Takamine 8-digit numeric (post-2012 offset decode)', '^\d{8}$', 'bespoke', '{}', 60),
('takamine', 'takamine-7-digit-numeric', 'Takamine 7-digit numeric', '^\d{7}$', 'bespoke', '{}', 70),
('takamine', 'takamine-6-digit-korean-g-series', 'Takamine 6-digit Korean G series', '^\d{6}$', 'bespoke', '{}', 80),
-- Bespoke: generic alphanumeric (single letter prefix)
('takamine', 'takamine-generic-alphanumeric', 'Takamine generic alphanumeric (letter prefix)', '^[A-Z]\d+$', 'bespoke', '{}', 90),

-- ============================================================
-- TAYLOR
-- All bespoke — factory code + interleaved year digits (pos 1 and 7), MMDD, day-of-year
-- ============================================================
('taylor', 'taylor-10-digit-modern', 'Taylor 10-digit modern (factory+interleaved year+MMDD+seq)', '^\d{10}$', 'bespoke', '{}', 10),
('taylor', 'taylor-11-digit-legacy-or-extended', 'Taylor 11-digit legacy YYYYMMDD or extended modern', '^\d{11}$', 'bespoke', '{}', 20),
('taylor', 'taylor-9-digit-1993-1999', 'Taylor 9-digit (1993-1999 YYMMDD+series+seq)', '^\d{9}$', 'bespoke', '{}', 30),
('taylor', 'taylor-early-5-8-digit', 'Taylor early 5-8 digit (sequential range estimate)', '^\d{5,8}$', 'bespoke', '{}', 40),

-- ============================================================
-- YAMAHA
-- All bespoke — letter-code year system (H=1, I=2... Q=0), Tenryu offset years,
--               day-of-year encoding, Korea/China year letter maps
-- ============================================================
('yamaha', 'yamaha-japan-custom-shop-2004', 'Yamaha Japan Custom Shop 2004 format (3-letter+3-digit+letter)', '^[A-Z]{3}\d{3}[A-Z]$', 'bespoke', '{}', 10),
('yamaha', 'yamaha-japan-custom-shop-1997', 'Yamaha Japan Custom Shop 1997 format (2-letter+3-digit)', '^[A-Z]{2}\d{3}$', 'bespoke', '{}', 20),
('yamaha', 'yamaha-japan-custom-shop-1991', 'Yamaha Japan Custom Shop 1991 format (2-letter+3-digit+letter)', '^[A-Z]{2}\d{3}[A-Z]$', 'bespoke', '{}', 30),
('yamaha', 'yamaha-japan-electric-1997', 'Yamaha Japan electric 1997 format (digit+2-letter+4-digit)', '^\d[A-Z]{2}\d{4}$', 'bespoke', '{}', 40),
('yamaha', 'yamaha-japan-electric-1994', 'Yamaha Japan electric 1994 format (digit+2-letter+3-digit)', '^\d[A-Z]{2}\d{3}$', 'bespoke', '{}', 50),
('yamaha', 'yamaha-japan-electric-1989', 'Yamaha Japan electric 1989 format (4-letter+3-digit)', '^[A-Z]{4}\d{3}$', 'bespoke', '{}', 60),
('yamaha', 'yamaha-japan-electric-1986', 'Yamaha Japan electric 1986 format (digit+letter+5-digit)', '^\d[A-Z]\d{5}$', 'bespoke', '{}', 70),
('yamaha', 'yamaha-japan-electric-1984', 'Yamaha Japan electric 1984 format (2-letter+4-digit)', '^[A-Z]{2}\d{4}$', 'bespoke', '{}', 80),
('yamaha', 'yamaha-tenryu-1969-6-digit', 'Yamaha Tenryu 1969+ 6-digit (dynamic century, letter year code)', '^\d{6}$', 'bespoke', '{}', 90),
('yamaha', 'yamaha-tenryu-1946-5-digit', 'Yamaha Tenryu 1946+ 5-digit', '^\d{5}$', 'bespoke', '{}', 100),
('yamaha', 'yamaha-standard-extended', 'Yamaha Standard Extended format (2-letter+7-digit)', '^[A-Z]{2}\d{7}$', 'bespoke', '{}', 110),
('yamaha', 'yamaha-standard-format', 'Yamaha Standard format (2-letter+5-digit)', '^[A-Z]{2}\d{5}$', 'bespoke', '{}', 120),
('yamaha', 'yamaha-letter-zero-letter-6-digit', 'Yamaha letter+O/0+letter+6-digit format', '^[A-Z][O0][A-Z]\d{6}$', 'bespoke', '{}', 130),
('yamaha', 'yamaha-taiwan-2002-format', 'Yamaha Taiwan 2002+ format (3-letter+6-digit)', '^[A-Z]{3}\d{6}$', 'bespoke', '{}', 140),
-- Indonesia (letter-code year system or YYMMDD+unit encoding)
('yamaha', 'yamaha-indonesia-2000-10-digit', 'Yamaha Indonesia 2000+ 10-digit (YYMMDD+unit, dynamic century)', '^\d{10}$', 'bespoke', '{}', 150),
('yamaha', 'yamaha-indonesia-1997-9-digit', 'Yamaha Indonesia 1997 9-digit', '^\d{9}$', 'bespoke', '{}', 160),
('yamaha', 'yamaha-indonesia-1990-8-digit', 'Yamaha Indonesia 1990 8-digit', '^\d{8}$', 'bespoke', '{}', 170),
('yamaha', 'yamaha-korea-china-2003', 'Yamaha Korea/China 2003 format (3-letter+4-digit+letter)', '^[A-Z]{3}\d{4}[A-Z]$', 'bespoke', '{}', 180),

-- ============================================================
-- WASHBURN — gap-fill rows (supplements existing 14 rows in D1)
-- Existing rows cover: BC template (priority 10), 10-digit 1990s template (20),
--   I-year-letter (30), 6-digit Japan (40), K/M/R/N late-80s (50-80),
--   two-char factory YYMM/YY (90/95), UO/SI/OC/SC YYWW units (100-130).
-- ============================================================

-- Samick Indonesia SI + 8-9 digit suffix (10-11 chars total)
-- Note: existing 'washburn-modern-2-letter-si-yyww-unit' covers SI+7-digit (YYWW unit)
('washburn', 'washburn-samick-indonesia-si-yymm-long', 'Washburn Samick Indonesia SI YYMM (8-9 digit suffix)', '^SI\d{8,9}$', 'bespoke', '{}', 140),

-- Single-letter prefix factories (dynamic century: yy>=70→1900+yy, yy<=30→2000+yy)
('washburn', 'washburn-samick-korea-s-yymm', 'Washburn Samick Korea S-prefix (dynamic century YYMM)', '^S\d{7,9}$', 'bespoke', '{}', 150),
('washburn', 'washburn-china-g-yymm', 'Washburn China G-prefix (dynamic century YYMM)', '^G\d{7,9}$', 'bespoke', '{}', 160),
('washburn', 'washburn-cort-c-yymm', 'Washburn Cort C-prefix (dynamic century YYMM)', '^C\d{7,9}$', 'bespoke', '{}', 170),
('washburn', 'washburn-yako-y-yymm', 'Washburn Yako Y-prefix (dynamic century YYMM)', '^Y\d{7,9}$', 'bespoke', '{}', 180),
('washburn', 'washburn-zaozhuang-z-yymm', 'Washburn Zaozhuang Z-prefix (dynamic century YYMM)', '^Z\d{7,9}$', 'bespoke', '{}', 190),
-- Indonesia I-prefix (non-letter-code variant — digits only after I)
('washburn', 'washburn-indonesia-i-yymm', 'Washburn Indonesia I-prefix (non-letter-code, dynamic century YYMM)', '^I\d{7,9}$', 'bespoke', '{}', 200),
-- General letter prefix (1-3 letters + 8-10 digits — decodeLetterPrefix handles OC/SC/N/YBJ etc.)
('washburn', 'washburn-general-letter-prefix', 'Washburn general 1-3 letter prefix (8-10 digit suffix)', '^[A-Z]{1,3}\d{8,10}$', 'bespoke', '{}', 210),
-- Modern numeric 8-12 digits (decodeModernNumeric)
('washburn', 'washburn-modern-numeric-8-plus', 'Washburn modern numeric 8-12 digits', '^\d{8,12}$', 'bespoke', '{}', 220),
-- 7-digit numeric (decode7Digit)
('washburn', 'washburn-7-digit-numeric', 'Washburn 7-digit numeric (1990s format)', '^\d{7}$', 'bespoke', '{}', 230),
-- Short 4-5 digit (decodeShort — 1970s-early 1980s)
('washburn', 'washburn-short-4-5-digit', 'Washburn short 4-5 digit (1970s-early 1980s)', '^\d{4,5}$', 'bespoke', '{}', 240);
