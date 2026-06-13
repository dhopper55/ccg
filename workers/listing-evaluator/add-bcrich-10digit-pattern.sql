INSERT INTO serial_decode_pattern_lookup (brand, pattern, regex_pattern, rich_text, updated_at)
VALUES (
  'bcrich',
  'bcrich-10-digit-numeric-import',
  '^\d{10}$',
  '<p>Yes, <strong>0002050411</strong> is a format-valid 10-digit serial number commonly found on imported, bolt-on neck B.C. Rich guitars manufactured during the late 1980s through the 1990s.</p><h3>Crucial Context Regarding this Number</h3><p>While the format is common, you should know that B.C. Rich serial numbers from this specific era are notorious for being structurally meaningless for dating or authentication.</p><ul><li><strong>The "Box of Plates" Era:</strong> During the Class Axe era (roughly 1989–1993) and subsequent import production runs, factories in Korea and China did not follow strict sequential logging.</li><li><strong>Arbitrary Numbers:</strong> Workers frequently grabbed pre-stamped neck plates out of a random box and screwed them onto bodies as they finished assembly.</li><li><strong>Value Check:</strong> A 10-digit, all-number serial format like this typically indicates a budget-friendly import line like the Platinum Series. They are great workhorse guitars but do not carry the high valuation of USA Custom Shop models.</li></ul><h3>How to Better Identify the Guitar</h3><p>Because the number itself will not tell you the year or exact model, you should check these alternative visual indicators to identify the guitar:</p><ul><li><strong>Headstock Branding:</strong> Look for series labels printed near the B.C. Rich script, such as "Platinum Series", "NJ Series", or "Bronze Series".</li><li><strong>Wood Cavities:</strong> Unscrew the plastic plate over the back electronics or the neck pickup cavity. Production dates were sometimes stamped or penciled inside the wood raw during construction.</li><li><strong>Hardware:</strong> Note the style of the bridge (e.g., a standard hardtail, a licensed Floyd Rose, or a proprietary "Bendmaster" bridge common to the early 1990s).</li></ul><p>If you want to pin down exactly what you have, tell me the body shape (like a Warlock, Mockingbird, or Ironbird) and describe any words or logos printed on the headstock.</p>',
  datetime('now')
)
ON CONFLICT(brand, pattern) DO UPDATE SET
  regex_pattern = excluded.regex_pattern,
  rich_text = excluded.rich_text,
  updated_at = excluded.updated_at;
