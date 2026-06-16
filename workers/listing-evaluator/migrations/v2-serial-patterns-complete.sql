-- V2 serial patterns: complete coverage for all 9 brands
-- Supplements v2-serial-patterns-seed.sql and v2-serial-patterns-full.sql
-- Run AFTER the previous two migration files.
--
-- Run from workers/listing-evaluator/ with:
--   npx wrangler d1 execute listing_evaluator --remote --file=migrations/v2-serial-patterns-complete.sql
--
-- Template rows decode serials directly.
-- Bespoke rows (params='{}') match the regex and return null → V1 handles them.
-- Bespoke rows serve as documentation and ensure the correct V1 path fires.

INSERT OR IGNORE INTO serial_patterns_v2 (brand, pattern_key, pattern_label, regex, template_type, params, priority) VALUES

-- ============================================================
-- SCHECTER — remaining patterns (bespoke)
-- ============================================================
('schecter', 'schecter-import-a-yy-sequence', 'Schecter import A-prefix YY sequence', '^A\d{7,8}$', 'bespoke', '{}', 90),
('schecter', 'schecter-long-numeric-import-yy-sequence', 'Schecter long numeric import YY sequence', '^\d{10,12}$', 'bespoke', '{}', 100),
('schecter', 'schecter-korea-legacy-6-digit', 'Schecter Korea legacy 6-digit', '^\d{6}$', 'bespoke', '{}', 110),
('schecter', 'schecter-usa-5-digit-yy-sequence', 'Schecter USA 5-digit YY sequence', '^\d{5}$', 'bespoke', '{}', 120),
('schecter', 'schecter-vintage-van-nuys-s-sequence', 'Schecter vintage Van Nuys S sequence', '^S\d{3,6}$', 'bespoke', '{}', 130),

-- ============================================================
-- KRAMER — SJ and MusicYo-S are template-able; rest bespoke
-- ============================================================
('kramer', 'kramer-sj-saemyung-china-yymm-sequence', 'Kramer SJ Saemyung China YYMM sequence', '^SJ\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"SJ","prefixLen":2,"brand":"Kramer","factory":"Saemyung, China","country":"China","model":"MusicYo/Gibson-era import, commonly Striker or Pacer Classic family","yearCentury":2000}', 20),

('kramer', 'kramer-musicyo-striker-s-yy-sequence', 'Kramer MusicYo Striker S-prefix YY sequence', '^S\d{5}$', 'prefix-yy-seq',
 '{"prefix":"S","prefixLen":1,"brand":"Kramer","factory":"MusicYo/Gibson-era import production","country":"South Korea or China","model":"Striker Series","yearCentury":2000}', 30),

('kramer', 'kramer-vintage-5-digit-plate', 'Kramer vintage 5-digit plate', '^\d{5}$', 'bespoke', '{}', 90),
('kramer', 'kramer-h-prefix-japan-esp-1990-1991', 'Kramer H-prefix Japan ESP 1990-1991', '^H\d{3,6}$', 'bespoke', '{}', 100),
('kramer', 'kramer-plain-4-digit-plate-unverified', 'Kramer plain 4-digit plate (unverified)', '^\d{4}$', 'bespoke', '{}', 110),
('kramer', 'kramer-sb-striker-1980s-sequential', 'Kramer SB Striker 1980s sequential', '^SB\d{3,6}$', 'bespoke', '{}', 120),
('kramer', 'kramer-sc-japan-focus-striker-4-digit', 'Kramer SC Japan Focus/Striker 4-digit', '^SC\d{4}$', 'bespoke', '{}', 130),
('kramer', 'kramer-sd-samick-korea-striker-sequence', 'Kramer SD Samick Korea Striker sequence', '^SD\d{4,6}$', 'bespoke', '{}', 140),
('kramer', 'kramer-se-samick-korea-4-digit', 'Kramer SE Samick Korea 4-digit', '^SE\d{4}$', 'bespoke', '{}', 150),
('kramer', 'kramer-sp-korean-striker-1980s', 'Kramer SP Korean Striker 1980s', '^SP\d{4,6}$', 'bespoke', '{}', 160),
('kramer', 'kramer-vintage-1980s-s-striker-sequential', 'Kramer vintage 1980s S Striker sequential', '^S[6-9]\d{4}$', 'bespoke', '{}', 170),
('kramer', 'kramer-modern-gibson-era-9-digit-factory-yym-sequence', 'Kramer modern Gibson-era 9-digit factory YYM sequence', '^\d{9}$', 'bespoke', '{}', 180),
('kramer', 'kramer-modern-gibson-era-11-digit-yymm-factory-sequence', 'Kramer modern Gibson-era 11-digit YYMM factory sequence', '^\d{11}$', 'bespoke', '{}', 190),

-- ============================================================
-- ESP — early EII is template-able; all others bespoke
-- ============================================================
('esp', 'esp-eii-early-es-yy-sequence', 'ESP early E-II ES + YY + sequence (2013-2015)', '^ES1[3-5]\d{5}$', 'prefix-yy-seq',
 '{"prefix":"ES","prefixLen":2,"brand":"ESP","factory":"ESP Japan (Tokyo)","country":"Japan","model":"E-II Series","yearCentury":2000}', 20),

('esp', 'esp-ambiguous-6-digit-all-numeric', 'ESP ambiguous 6-digit all-numeric', '^\d{6}$', 'bespoke', '{}', 90),
('esp', 'esp-ambiguous-e-prefix-6-digit-eii-ltd', 'ESP ambiguous E-prefix 6-digit (E-II or LTD)', '^E\d{6}$', 'bespoke', '{}', 100),
('esp', 'esp-edwards-ed-yy-sequence', 'ESP Edwards ED-prefix YYWWDN format', '^ED\d{6,7}$', 'bespoke', '{}', 110),
('esp', 'esp-japan-yy-batch-sequence-8digit', 'ESP Japan 8-digit YY + batch code + sequence', '^\d{8}$', 'bespoke', '{}', 120),
('esp', 'esp-late-1990s-yymm-sequence-8digit', 'ESP late-1990s/early-2000s YYMM 8-digit', '^\d{8}$', 'bespoke', '{}', 125),
('esp', 'esp-ltd-china-gtone-gc-yy-week-sequence', 'ESP LTD China G-Tone GC YY week sequence', '^GC\d{7}$', 'bespoke', '{}', 130),
('esp', 'esp-ltd-china-single-c-yy-week-sequence', 'ESP LTD China single-C YY week sequence', '^C\d{9}$', 'bespoke', '{}', 140),
('esp', 'esp-ltd-early-korea-u-sequential', 'ESP LTD early Korea U sequential', '^U\d{6}$', 'bespoke', '{}', 150),
('esp', 'esp-ltd-korea-peerless-r-yy-week-sequence', 'ESP LTD Korea Peerless R YY week sequence', '^R\d{7}$', 'bespoke', '{}', 160),
('esp', 'esp-ltd-korea-wmi-w-yy-week-sequence', 'ESP LTD Korea WMI W YY week sequence', '^W\d{9}$', 'bespoke', '{}', 170),
('esp', 'esp-ltd-numeric-9digit-yy-ww-d-sequence', 'ESP LTD 9-digit YY+WW+D sequence', '^\d{9}$', 'bespoke', '{}', 180),
('esp', 'esp-ltd-transitional-yy-week-sequence', 'ESP LTD transitional YY week sequence', '^\d{7}$', 'bespoke', '{}', 190),
('esp', 'esp-vintage-4-digit-custom-shop', 'ESP vintage 4-digit custom shop', '^\d{4}$', 'bespoke', '{}', 200),
('esp', 'esp-vintage-japan-5-digit', 'ESP vintage Japan 5-digit', '^\d{5}$', 'bespoke', '{}', 210),

-- ============================================================
-- DEAN — D and Z are template-able; rest bespoke
-- ============================================================
('dean', 'dean-asian-partner-d-yymm-sequence', 'Dean Asian partner D-prefix YYMM sequence', '^D\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"D","prefixLen":1,"brand":"Dean","factory":"Asian partner import production line","country":"China, South Korea, or Indonesia","yearCentury":2000}', 20),

('dean', 'dean-china-z-yy-sequence', 'Dean China Z-prefix YY sequence', '^Z\d{7,8}$', 'prefix-yy-seq',
 '{"prefix":"Z","prefixLen":1,"brand":"Dean","factory":"China import production line","country":"China","yearCentury":2000}', 30),

('dean', 'dean-legacy-korea-e-single-year-digit', 'Dean legacy Korea E single year digit', '^E[7-9]\d{5}$', 'bespoke', '{}', 90),
('dean', 'dean-five-digit-sequential-czech-or-usa', 'Dean 5-digit sequential Czech or USA', '^\d{5,6}$', 'bespoke', '{}', 100),

-- ============================================================
-- CORT — additional template-able patterns
-- ============================================================
('cort', 'cort-china-single-letter-c-yymm-sequence', 'Cort China single-letter C YYMM sequence', '^C\d{8,9}$', 'prefix-yymm-seq',
 '{"prefix":"C","prefixLen":1,"brand":"Cort","factory":"Cor-Tek factory, China","country":"China","yearCentury":2000}', 90),

('cort', 'cort-ia-indonesia-yymm-sequence', 'Cort IA Indonesia YYMM sequence', '^IA\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"IA","prefixLen":2,"brand":"Cort","factory":"PT Cort Indonesia, Surabaya (factory line A)","country":"Indonesia","yearCentury":2000}', 100),

('cort', 'cort-indonesia-single-i-yymm-sequence', 'Cort Indonesia single-letter I YYMM sequence', '^I\d{9}$', 'prefix-yymm-seq',
 '{"prefix":"I","prefixLen":1,"brand":"Cort","factory":"PT Cort Indonesia (Cor-Tek)","country":"Indonesia","yearCentury":2000}', 110),

('cort', 'cort-early-1990s-7-digit-yy-sequence', 'Cort early 1990s 7-digit YY sequence', '^9[0-5]\d{5}$', 'numeric-yymm-seq',
 '{"yearStart":0,"seqStart":2,"brand":"Cort","factory":"Cort Korea (Incheon or Daejeon)","country":"South Korea","yearCentury":1900}', 120),

('cort', 'cort-1980s-korea-7-digit-yy-sequence', 'Cort 1980s Korea 7-digit YY sequence', '^8\d{6}$', 'numeric-yymm-seq',
 '{"yearStart":0,"seqStart":2,"brand":"Cort","factory":"Cort Korea (Incheon)","country":"South Korea","yearCentury":1900}', 130),

('cort', 'cort-year-sequence-7-digit', 'Cort year-first 7-digit sequence', '^00\d{5}$', 'numeric-yymm-seq',
 '{"yearStart":0,"seqStart":2,"brand":"Cort","factory":"Cort (Korea or Indonesia)","country":"Korea or Indonesia","yearCentury":2000}', 140),

-- CORT bespoke patterns
('cort', 'cort-modern-two-letter-factory-line-yymm-sequence', 'Cort modern two-letter factory-line YYMM sequence', '^C[A-Z]\d{7,9}$', 'bespoke', '{}', 150),
('cort', 'cort-modern-three-letter-factory-line-yymm-sequence', 'Cort modern three-letter factory-line YYMM sequence', '^C[A-Z]{2}\d{7,9}$', 'bespoke', '{}', 155),
('cort', 'cort-indonesia-is-product-line-yy-sequence', 'Cort Indonesia IS product-line format', '^IS[A-Z]{1,2}\d{6,8}$', 'bespoke', '{}', 160),
('cort', 'cort-modern-2000s-dropped-leading-zero-yymm-sequence', 'Cort modern 2000s omitted-leading-zero YYMM sequence', '^[1-9]\d{7}$', 'bespoke', '{}', 165),
('cort', 'cort-modern-7-digit-year-batch-sequence', 'Cort modern 7-digit year/batch sequence', '^\d{2}00\d{3}$', 'bespoke', '{}', 170),
('cort', 'cort-modern-alphanumeric-factory-line-yymm-sequence', 'Cort modern alphanumeric factory-line YYMM sequence', '^\d[A-Z]\d{9}$', 'bespoke', '{}', 175),
('cort', 'cort-modern-8-digit-year-batch-sequence', 'Cort modern 8-digit year/batch sequence', '^\d{2}00\d{4}$', 'bespoke', '{}', 180),
('cort', 'cort-modern-2000s-y0-year-sequence', 'Cort modern 2000s Y0 year sequence', '^[1-9]0\d{6}$', 'bespoke', '{}', 185),
('cort', 'cort-modern-12-digit-year-tracking-sequence', 'Cort modern 12-digit year tracking sequence', '^\d{12}$', 'bespoke', '{}', 190),
('cort', 'cort-vintage-wo-w0-korea-sequence', 'Cort vintage W.O./W0 Korea sequence', '^W[O0\.]', 'bespoke', '{}', 195),
('cort', 'cort-8digit-suspicious-future-year', 'Cort 8-digit suspicious future year', '^\d{8}$', 'bespoke', '{}', 200),
('cort', 'cort-early-1980s-5-digit-neck-plate', 'Cort early 1980s 5-digit neck plate', '^\d{5}$', 'bespoke', '{}', 210),
('cort', 'cort-1990s-ymm-sequence-7-digit', 'Cort 1990s YMM sequence 7-digit', '^[0-7]\d{6}$', 'bespoke', '{}', 220),

-- ============================================================
-- IBANEZ — FujiGen and M-prefix are bespoke (complex month calc)
-- ============================================================
('ibanez', 'ibanez-fujigen-modern-f-year-sequence', 'Ibanez FujiGen modern F + year + sequence', '^F\d{7}$', 'bespoke', '{}', 40),
('ibanez', 'ibanez-fujigen-post-2004-f-yy-sequence', 'Ibanez FujiGen post-2004 F + YY + sequence', '^F\d{8}$', 'bespoke', '{}', 50),
('ibanez', 'ibanez-legacy-korea-m-prefix-yy-sequence', 'Ibanez legacy Korea M-prefix YY sequence', '^M\d{6}$', 'bespoke', '{}', 60),
('ibanez', 'ibanez-gs-mixed-contractor-yy-plant-mm-sequence', 'Ibanez GS mixed-contractor YY plant MM sequence', '^GS\d{2}[A-Z]\d{6}$', 'bespoke', '{}', 70),
('ibanez', 'ibanez-ambiguous-6-digit-numeric-impossible-yy', 'Ibanez ambiguous 6-digit numeric (impossible YY)', '^\d{6}$', 'bespoke', '{}', 80),

-- ============================================================
-- CHARVEL — Japan YYMM 4-digit is template-able; rest bespoke
-- ============================================================
('charvel', 'charvel-japan-yymm-4-digit', 'Charvel Japanese late-1980s YYMM date stamp', '^\d{4}$', 'numeric-yymm-seq',
 '{"yearStart":0,"monthStart":2,"seqStart":4,"brand":"Charvel","factory":"Chushin Gakki (Nagano Prefecture)","country":"Japan","yearCentury":1900}', 20),

('charvel', 'charvel-san-dimas-fender-era-reissue-4digit', 'Charvel San Dimas Fender-era reissue 4-digit', '^\d{4}$', 'bespoke', '{}', 30),
('charvel', 'charvel-japan-imc-7-digit-neck-plate', 'Charvel Japanese IMC-era 7-digit neck-plate serial', '^\d{7}$', 'bespoke', '{}', 40),

-- ============================================================
-- JACKSON — 8-digit import is template-able; MIJ and USA bespoke
-- ============================================================
('jackson', 'jackson-modern-8-digit-yy-sequence-import', 'Jackson modern 8-digit YY sequence import (Indonesia/Korea)', '^(0[5-9]|[12]\d)\d{6}$', 'numeric-yymm-seq',
 '{"yearStart":0,"seqStart":2,"brand":"Jackson","factory":"Jackson Indonesian or Korean import facility","country":"Indonesia or South Korea","yearCentury":2000}', 30),

('jackson', 'jackson-mij-200c-chushin', 'Jackson MIJ 200C Chushin (early 2000s)', '^200C\d{5}$', 'bespoke', '{}', 90),
('jackson', 'jackson-mij-6-digit-1996-transition', 'Jackson MIJ 6-digit 1996 transition', '^6\d{5}$', 'bespoke', '{}', 100),
('jackson', 'jackson-mij-6-digit-7-prefix-import-sequence', 'Jackson MIJ 6-digit 7-prefix import sequence', '^7\d{5}$', 'bespoke', '{}', 110),
('jackson', 'jackson-mij-6-digit-late-1990s-professional', 'Jackson MIJ 6-digit late-1990s Professional', '^9[89]\d{4}$', 'bespoke', '{}', 120),
('jackson', 'jackson-mij-7-digit-1990-1995-chushin', 'Jackson MIJ 7-digit 1990-1995 Chushin', '^9[0-5]\d{5}$', 'bespoke', '{}', 130),
('jackson', 'jackson-mij-professional-5-digit', 'Jackson MIJ Professional 5-digit', '^[0-5]\d{4}$', 'bespoke', '{}', 140),
('jackson', 'jackson-taiwan-js-series-1996', 'Jackson Taiwan JS-series 1996', '^6\d{7,8}$', 'bespoke', '{}', 150),
('jackson', 'jackson-usa-player-choice-series-pcs', 'Jackson USA Player Choice Series PCS', '^PCS\d{4}$', 'bespoke', '{}', 160),
('jackson', 'jackson-usa-u-series', 'Jackson USA U-series', '^U\d{4,5}$', 'bespoke', '{}', 170),

-- ============================================================
-- WASHBURN — 1990s 10-digit is template-able; rest bespoke
-- ============================================================
('washburn', 'washburn-1990s-10-digit-yymm-sequence', 'Washburn 1990s 10-digit YYMM sequence', '^[89]\d{9}$', 'numeric-yymm-seq',
 '{"yearStart":0,"monthStart":2,"seqStart":4,"brand":"Washburn","factory":"Washburn import (likely South Korea)","country":"South Korea or USA","yearCentury":1900}', 20),

('washburn', 'washburn-indonesia-i-year-letter-sequence', 'Washburn Indonesia I-prefix year-letter sequence', '^I\d[A-Z]\d{5,6}$', 'bespoke', '{}', 30),
('washburn', 'washburn-legacy-japan-6-digit', 'Washburn legacy Japan 6-digit', '^\d{6}$', 'bespoke', '{}', 40),
('washburn', 'washburn-late80s-japan-k-year-sequence', 'Washburn late-1980s Japan K-prefix year sequence', '^K\d{6}$', 'bespoke', '{}', 50),
('washburn', 'washburn-late80s-japan-m-year-sequence', 'Washburn late-1980s Japan M-prefix year sequence', '^M\d{6}$', 'bespoke', '{}', 60),
('washburn', 'washburn-late80s-japan-r-year-sequence', 'Washburn late-1980s Japan R-prefix year sequence', '^R\d{6}$', 'bespoke', '{}', 70),
('washburn', 'washburn-late80s-japan-n-year-sequence', 'Washburn late-1980s Japan N-prefix year sequence', '^N\d{6}$', 'bespoke', '{}', 80),
('washburn', 'washburn-modern-two-char-factory-yymm-sequence', 'Washburn modern 2-char factory YYMM sequence', '^(OC|0C|SC|NC|YC|IC)\d{8}$', 'bespoke', '{}', 90),
('washburn', 'washburn-modern-two-char-factory-yy-sequence', 'Washburn modern 2-char factory YY sequence', '^(OC|0C|SC|NC|YC|IC)\d{6}$', 'bespoke', '{}', 95),
('washburn', 'washburn-modern-2-letter-uo-yyww-unit', 'Washburn modern UO factory YYWW unit', '^UO\d{7}$', 'bespoke', '{}', 100),
('washburn', 'washburn-modern-2-letter-si-yyww-unit', 'Washburn modern SI factory YYWW unit', '^SI\d{7}$', 'bespoke', '{}', 110),
('washburn', 'washburn-modern-2-letter-oc-yyww-unit', 'Washburn modern OC factory YYWW unit', '^OC\d{7}$', 'bespoke', '{}', 120),
('washburn', 'washburn-modern-2-letter-sc-yyww-unit', 'Washburn modern SC factory YYWW unit', '^SC\d{7}$', 'bespoke', '{}', 130);
