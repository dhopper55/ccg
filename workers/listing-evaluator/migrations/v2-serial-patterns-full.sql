-- V2 serial patterns: complete migration of all template-able patterns
-- This supplements v2-serial-patterns-seed.sql — run the seed first, then this.
-- Bespoke patterns (complex year/factory logic) are intentionally omitted;
-- V2 returns null for unmatched serials, which triggers V1 fallback automatically.
--
-- Run from workers/listing-evaluator/ with:
--   npx wrangler d1 execute listing_evaluator --remote --file=migrations/v2-serial-patterns-full.sql

INSERT OR IGNORE INTO serial_patterns_v2 (brand, pattern_key, pattern_label, regex, template_type, params, priority) VALUES

-- ============================================================
-- SCHECTER — YY-only (no month) patterns
-- ============================================================
('schecter', 'schecter-r-korea-yy-sequence', 'Schecter R Korea YY sequence', '^R\d{7}$', 'prefix-yy-seq',
 '{"prefix":"R","prefixLen":1,"brand":"Schecter","factory":"Reliance / Korean import production","country":"South Korea","model":"Diamond Series import","yearCentury":2000}', 70),

('schecter', 'schecter-ro-indonesia-yy-sequence', 'Schecter RO Indonesia YY sequence', '^RO\d{8}$', 'prefix-yy-seq',
 '{"prefix":"RO","prefixLen":2,"brand":"Schecter","factory":"PT Cort Indonesia","country":"Indonesia","model":"Diamond Series import","yearCentury":2000}', 80),

-- ============================================================
-- IBANEZ — YYMM and YY-only patterns
-- ============================================================
('ibanez', 'ibanez-china-gaoqing-grand-star-g-yymm-sequence', 'Ibanez China Gaoqing Grand Star G YYMM sequence', '^G\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"G","prefixLen":1,"brand":"Ibanez","factory":"Gaoqing Grand Star, China","country":"China","model":"GIO Series (likely)","yearCentury":2000}', 10),

('ibanez', 'ibanez-korea-saein-sa-yymm-sequence', 'Ibanez Korea Saein SA YYMM sequence', '^SA\d{9}$', 'prefix-yymm-seq',
 '{"prefix":"SA","prefixLen":2,"brand":"Ibanez","factory":"Saein Musical Instrument Co., South Korea","country":"South Korea","model":"Korean-built Ibanez import","yearCentury":2000}', 20),

('ibanez', 'ibanez-indonesia-premium-j-yy-sequence', 'Ibanez Indonesia Premium J YY sequence', '^J\d{6}$', 'prefix-yy-seq',
 '{"prefix":"J","prefixLen":1,"brand":"Ibanez","factory":"Indonesia Premium Factory","country":"Indonesia","model":"Premium Series","yearCentury":2000}', 30),

-- ============================================================
-- CHARVEL — UC China YY pattern
-- ============================================================
('charvel', 'charvel-uc-china-yy-sequence', 'Charvel UC China YY sequence', '^UC\d{4,8}$', 'prefix-yy-seq',
 '{"prefix":"UC","prefixLen":2,"brand":"Charvel","factory":"China (UC-prefix import facility)","country":"China","model":"Desolation Series or related China import model","yearCentury":2000}', 10),

-- ============================================================
-- CORT — additional template-able patterns
-- ============================================================
('cort', 'cort-iia-indonesia-yymm-sequence', 'Cort IIA Indonesia YYMM sequence', '^IIA\d{8,9}$', 'prefix-yymm-seq',
 '{"prefix":"IIA","prefixLen":3,"brand":"Cort","factory":"PT Cort Indonesia (IIA facility)","country":"Indonesia","yearCentury":2000}', 40),

('cort', 'cort-r-prefix-yy-sequence', 'Cort R-prefix YY sequence', '^R\d{7}$', 'prefix-yy-seq',
 '{"prefix":"R","prefixLen":1,"brand":"Cort","factory":"Cort Factory","country":"South Korea","yearCentury":2000}', 50),

('cort', 'cort-icse-indonesia-yy-sequence', 'Cort ICSE Indonesia YY sequence', '^ICSE\d{8}$', 'prefix-yy-seq',
 '{"prefix":"ICSE","prefixLen":4,"brand":"Cort","factory":"PT. Cort Indonesia, Surabaya","country":"Indonesia","model":"Cort/Cor-Tek SE production line or series","yearCentury":2000}', 60),

('cort', 'cort-late-1990s-8-digit-yymm-sequence', 'Cort late-1990s 8-digit YYMM sequence', '^9\d{7}$', 'numeric-yymm-seq',
 '{"yearStart":0,"monthStart":2,"seqStart":4,"brand":"Cort","factory":"Cort Korea (Incheon or Daejeon)","country":"South Korea","yearCentury":1900}', 70),

('cort', 'cort-vintage-1990s-7-digit-yymm-sequence', 'Cort vintage 1990s 7-digit YYMM sequence', '^9\d{6}$', 'numeric-yymm-seq',
 '{"yearStart":0,"monthStart":2,"seqStart":4,"brand":"Cort","factory":"Cort Korea","country":"South Korea","yearCentury":1900}', 80),

-- ============================================================
-- JACKSON — J-prefix Indonesia and 3-letter prefix
-- ============================================================
('jackson', 'jackson-modern-j-indonesia-yy-sequence', 'Jackson modern J-prefix Indonesia YY sequence (2013+)', '^J\d{7}$', 'prefix-yy-seq',
 '{"prefix":"J","prefixLen":1,"brand":"Jackson","factory":"Jackson Indonesia (PT. Cort or similar contracted facility)","country":"Indonesia","model":"JS, X Series, or Pro Series","yearCentury":2000}', 10),

('jackson', 'jackson-modern-10digit-3letter-prefix-modelcode-yy-sequence', 'Jackson modern 10-digit 3-letter prefix (2013+)', '^[A-Z]{3}\d{7}$', 'three-letter-prefix-modelcode-yy-seq',
 '{"brand":"Jackson","yearCentury":2000,"indonesiaFactoryCodes":{"W":"P.T. Wildwood","S":"Samick","C":"Cort","H":"Harmony Musical Instruments","J":"Jackson Indonesia"},"chinaFactoryCodes":{"Y":"Yako","J":"Jackson China"}}', 20),

-- ============================================================
-- WASHBURN — BC China plant YY sequence
-- (BC + plant(1) + YY(2) + seq(4) = 9 chars; year at position 3)
-- ============================================================
('washburn', 'washburn-bc-china-plant-yy-sequence', 'Washburn BC China plant YY sequence', '^BC\d{7}$', 'numeric-yymm-seq',
 '{"yearStart":3,"seqStart":5,"brand":"Washburn","factory":"China factory (BC series)","country":"China","yearCentury":2000}', 10);
