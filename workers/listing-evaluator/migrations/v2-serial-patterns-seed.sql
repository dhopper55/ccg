-- V2 serial patterns initial seed
-- Run from workers/listing-evaluator/ with:
--   npx wrangler d1 execute listing_evaluator --remote --file=migrations/v2-serial-patterns-seed.sql

INSERT OR IGNORE INTO serial_patterns_v2 (brand, pattern_key, pattern_label, regex, template_type, params, priority) VALUES

-- Schecter YYMM prefix patterns
('schecter', 'schecter-ca-yymm-sequence', 'Schecter CA YYMM sequence', '^CA\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"CA","prefixLen":2,"brand":"Schecter","factory":"China import factory / newer production partner","country":"China","model":"Diamond Series import","yearCentury":2000}', 10),

('schecter', 'schecter-cs-yymm-sequence', 'Schecter CS YYMM sequence', '^CS\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"CS","prefixLen":2,"brand":"Schecter","factory":"China or Indonesia partner factory (CS)","country":"China or Indonesia","model":"Diamond Series import","yearCentury":2000}', 20),

('schecter', 'schecter-rn-yymm-sequence', 'Schecter RN YYMM sequence', '^RN\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"RN","prefixLen":2,"brand":"Schecter","factory":"PT. Roxy Music","country":"Indonesia","model":"Diamond Series import","yearCentury":2000}', 30),

('schecter', 'schecter-st-yymm-sequence', 'Schecter ST YYMM sequence', '^ST\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"ST","prefixLen":2,"brand":"Schecter","factory":"China import factory / ST production run","country":"China","model":"Diamond Series import","yearCentury":2000}', 40),

('schecter', 'schecter-im-indonesia-yymm-sequence', 'Schecter IM Indonesia YYMM sequence', '^IM\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"IM","prefixLen":2,"brand":"Schecter","factory":"Inwoo / PT Inwoo Indonesia","country":"Indonesia","model":"Diamond Series import","yearCentury":2000}', 50),

('schecter', 'schecter-h-yymm-sequence', 'Schecter H YYMM sequence', '^H\d{7,9}$', 'prefix-yymm-seq',
 '{"prefix":"H","prefixLen":1,"brand":"Schecter","factory":"Korea / Asian import factory","country":"South Korea","model":"Diamond Series or similar import","yearCentury":2000}', 60),

-- Kramer YYMM prefix pattern
('kramer', 'kramer-jk-indonesia-gibson-era-yymm-sequence', 'Kramer JK Indonesian factory Gibson/Epiphone era YYMM sequence', '^JK\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"JK","prefixLen":2,"brand":"Kramer","factory":"Indonesian factory (Gibson/Epiphone era)","country":"Indonesia","model":"Modern Gibson/Epiphone-era import model, commonly Focus, Striker, or Pacer Classic","yearCentury":2000}', 10),

-- ESP LTD IS prefix (Samick Indonesia)
('esp', 'esp-ltd-indonesia-is-samick-yymm-sequence', 'ESP LTD Indonesia Samick IS + YYMM + sequence', '^IS\d{7,9}$', 'prefix-yymm-seq',
 '{"prefix":"IS","prefixLen":2,"brand":"ESP","factory":"Samick, Indonesia","country":"Indonesia","yearCentury":2000}', 10),

-- Dean A-prefix (Asian partner YYMM)
('dean', 'dean-asian-partner-a-yymm-sequence', 'Dean Asian partner A-prefix YYMM sequence', '^A\d{8}$', 'prefix-yymm-seq',
 '{"prefix":"A","prefixLen":1,"brand":"Dean","factory":"Asian partner import production line","country":"China or Indonesia","yearCentury":2000}', 10),

-- Cort AI prefix (Indonesia YYMM)
('cort', 'cort-ai-indonesia-yymm-sequence', 'Cort AI Indonesia YYMM sequence', '^AI\d{9}$', 'prefix-yymm-seq',
 '{"prefix":"AI","prefixLen":2,"brand":"Cort","factory":"Cort Factory, Indonesia","country":"Indonesia","yearCentury":2000}', 10),

-- Cort 9-digit numeric YYMM (all-numeric)
('cort', 'cort-modern-9-digit-yymm-sequence', 'Cort modern 9-digit YYMM sequence', '^\d{9}$', 'numeric-yymm-seq',
 '{"yearStart":0,"monthStart":2,"seqStart":4,"brand":"Cort","factory":"Cort Factory","country":"Indonesia","yearCentury":2000}', 20),

-- Cort 10-digit numeric YYMM (all-numeric)
('cort', 'cort-modern-10-digit-yymm-sequence', 'Cort modern 10-digit YYMM sequence', '^\d{10}$', 'numeric-yymm-seq',
 '{"yearStart":0,"monthStart":2,"seqStart":4,"brand":"Cort","factory":"Cort Factory","country":"Indonesia","yearCentury":2000}', 30);
