# Adding a New Guitar Brand Decoder

This guide documents the complete process for adding a new guitar brand to the serial number decoder.

## Prerequisites

Before starting, you need:
1. The brand logo image file (add to `images/brand-logos/`)
2. A brief synopsis/description of the brand (1-2 sentences)

## Step-by-Step Process

### Step 1: Deep Research Serial Number Formats

**This is the most important step.** Do thorough internet research to find ALL serial number formats for the brand. Search for:

- Official manufacturer documentation
- Guitar dating guides and wikis
- Forum discussions about serial numbers
- Multiple decoder websites to cross-reference

Search queries to use:
```
"[Brand] guitar serial number decoder complete guide all formats"
"[Brand] serial number [country] factory codes"
"[Brand] guitar dating guide [year range]"
```

Key information to gather:
- All serial number prefixes/formats by era
- Factory codes and their meanings
- Country of origin indicators
- Year encoding methods (prefix digits, letter codes, sequential ranges)
- Month encoding (if applicable)
- Any special formats for signature models, custom shop, etc.
- Historical changes in numbering systems

### Step 2: Create the Decoder TypeScript File

Create `src/decoders/[brand].ts` with this structure:

```typescript
import { DecodeResult, GuitarInfo } from '../types.js';

/**
 * [Brand] Guitar Serial Number Decoder
 *
 * Supports:
 * - [List all supported formats with date ranges]
 */

// Add any lookup tables (serial ranges, factory codes, etc.)

export function decode[Brand](serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Try each decoder pattern, most specific first
  // Use regex to match patterns
  // Return appropriate decode function result

  return {
    success: false,
    error: 'Unable to decode this [Brand] serial number. The format was not recognized.',
  };
}

// Add individual decode functions for each format
function decode[Format](serial: string): DecodeResult {
  const info: GuitarInfo = {
    brand: '[Brand]',
    serialNumber: serial,
    year: '...',
    month: '...', // if applicable
    factory: '...',
    country: '...',
    model: '...', // if determinable
    notes: '...', // helpful context
  };

  return { success: true, info };
}

// Helper function for month names
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
}
```

### Step 3: Update types.ts

Add the new brand to the Brand type union in `src/types.ts`:

```typescript
export type Brand = 'gibson' | 'fender' | ... | '[newbrand]';
```

Use lowercase for the brand identifier.

### Step 4: Update main.ts

Add import and register the decoder in `src/main.ts`:

```typescript
// Add import at top with other decoder imports
import { decode[Brand] } from './decoders/[brand].js';

// Add to decoders object
const decoders: Record<Brand, (serial: string) => DecodeResult> = {
  // ... existing decoders
  [brand]: decode[Brand],
};
```

### Step 5: Create the HTML Decoder Page

Create `decoders/[brand]-guitar-serial-number-decoder.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Brand] Guitar Serial Number Decoder | Coal Creek Guitars</title>
  <meta name="description" content="Free [Brand] guitar serial number decoder. Find the year, factory location, and production details of your [Brand] guitar. Works with [list key formats/countries].">
  <link rel="canonical" href="https://www.coalcreekguitars.com/decoders/[brand]-guitar-serial-number-decoder.html">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://www.coalcreekguitars.com/decoders/[brand]-guitar-serial-number-decoder.html">
  <meta property="og:title" content="[Brand] Guitar Serial Number Decoder | Coal Creek Guitars">
  <meta property="og:description" content="Free [Brand] serial number decoder. Find the year, factory location, and production details of your [Brand] guitar.">
  <meta property="og:image" content="https://www.coalcreekguitars.com/images/coal-creek-logo.png">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://www.coalcreekguitars.com/decoders/[brand]-guitar-serial-number-decoder.html">
  <meta name="twitter:title" content="[Brand] Guitar Serial Number Decoder | Coal Creek Guitars">
  <meta name="twitter:description" content="Free [Brand] serial number decoder. Find the year, factory location, and production details of your [Brand] guitar.">
  <meta name="twitter:image" content="https://www.coalcreekguitars.com/images/coal-creek-logo.png">

  <link rel="stylesheet" href="../styles.css">
</head>
<body data-preselect-brand="[brand]">
  <nav class="site-nav">
    <a href="../index.html" class="nav-logo">
      <img src="../images/coal-creek-logo.png" alt="Coal Creek Guitars">
    </a>
    <a href="../index.html" class="nav-home">Home</a>
  </nav>

  <div class="container">
    <h1>[Brand] Guitar Serial Number Decoder</h1>

    <div class="brand-header">
      <img src="../images/brand-logos/[logo-filename]" alt="[Brand]" class="brand-logo brand-logo-invert">
      <p class="brand-description">[Brand synopsis goes here]</p>
    </div>

    <div class="input-section">
      <div class="form-group">
        <label for="serial">Serial Number:</label>
        <input type="text" id="serial" placeholder="Enter [Brand] serial number" autocomplete="off">
      </div>

      <button id="decode-btn">Decode Serial Number</button>
    </div>

    <div id="result" class="result-section hidden">
      <h2>Guitar Information</h2>
      <div id="result-content"></div>
    </div>

    <div id="error" class="error-section hidden"></div>

    <div class="decoder-note">
      <p>Note: If you try a serial number and the decoder is not able to decode it, please <a href="../contact-us.html">contact us</a> and let us know so we can check the number and fix the decoder. Thank you!</p>
    </div>

    <div class="back-link">
      <a href="guitar-serial-decoder-lookup.html">&larr; Back to brand selection</a>
    </div>
  </div>

  <footer class="site-footer">
    <div class="footer-content">
      <p class="footer-contact">Questions? <a href="../contact-us.html">Contact Us</a></p>
      <p class="footer-copyright">&copy; 2025 Coal Creek Guitars. All rights reserved.</p>
    </div>
  </footer>

  <script type="module" src="../dist/main.js"></script>
</body>
</html>
```

**Important:** The `data-preselect-brand` attribute must match the brand key in types.ts (lowercase).

### Step 6: Update Brand Selection Page

Edit `decoders/guitar-serial-decoder-lookup.html`:

1. Update meta descriptions to include new brand in the list
2. Add brand card to the grid:

```html
<a href="[brand]-guitar-serial-number-decoder.html" class="brand-select-card">
  <img src="../images/brand-logos/[logo-filename]" alt="[Brand]" class="brand-select-logo brand-logo-invert">
  <span class="brand-select-name">[Brand] Guitars</span>
</a>
```

**Note:** Check the exact filename of the logo in `images/brand-logos/` - filenames are case-sensitive.

### Step 7: Update sitemap.xml

Add new URL entry before the guitars-and-gear-for-sale entry:

```xml
<url>
  <loc>https://www.coalcreekguitars.com/decoders/[brand]-guitar-serial-number-decoder.html</loc>
  <changefreq>monthly</changefreq>
  <priority>0.8</priority>
</url>
```

### Step 8: Build and Test

```bash
npm run build
```

Fix any TypeScript compilation errors.

### Step 9: Add Test Serial Numbers

Add test cases to `TEST-SERIAL-NUMBERS.md`:

```markdown
## [Brand]

| Serial Number | Expected Result |
|---------------|-----------------|
| [example1] | [expected decode result] |
| [example2] | [expected decode result] |
```

Include test cases for each supported format.

### Step 10: Commit Changes

```bash
git add -A
git commit -m "Add [Brand] guitar serial number decoder

- Add [Brand] decoder with support for [list key formats]
- Create brand-specific decoder HTML page
- Update brand selection page and sitemap
- Add test serial numbers

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push
```

## File Checklist

- [ ] `images/brand-logos/[logo]` - Brand logo image
- [ ] `src/decoders/[brand].ts` - Decoder implementation
- [ ] `src/types.ts` - Add brand to Brand type
- [ ] `src/main.ts` - Import and register decoder
- [ ] `decoders/[brand]-guitar-serial-number-decoder.html` - Decoder page
- [ ] `decoders/guitar-serial-decoder-lookup.html` - Add to brand grid + meta descriptions
- [ ] `sitemap.xml` - Add URL entry
- [ ] `TEST-SERIAL-NUMBERS.md` - Add test cases
- [ ] `dist/` files - Generated by `npm run build`

## Common Patterns in Serial Number Decoders

### Year from single digit
```typescript
const yearDigit = serial[1];
const year = `199${yearDigit}`; // or 198x, 200x depending on era
```

### Year from two digits with century detection
```typescript
const yearDigits = serial.substring(2, 4);
let year = parseInt(yearDigits, 10);
year = year >= 90 ? 1900 + year : 2000 + year;
```

### Factory code lookup
```typescript
const FACTORY_CODES: Record<string, { factory: string; country: string }> = {
  'XX': { factory: 'Factory Name', country: 'Country' },
};

const factoryCode = serial.substring(0, 2);
const factoryInfo = FACTORY_CODES[factoryCode];
```

### Sequential serial range lookup
```typescript
const SERIAL_RANGES: { start: number; end: number; year: string }[] = [
  { start: 1, end: 1000, year: '1990' },
  { start: 1001, end: 2000, year: '1991' },
];

const num = parseInt(serial, 10);
for (const range of SERIAL_RANGES) {
  if (num >= range.start && num <= range.end) {
    info.year = range.year;
    break;
  }
}
```

### Month letter codes
```typescript
const MONTH_LETTERS: Record<string, string> = {
  'A': 'January', 'B': 'February', 'C': 'March', 'D': 'April',
  'E': 'May', 'F': 'June', 'G': 'July', 'H': 'August',
  'I': 'September', 'J': 'October', 'K': 'November', 'L': 'December',
};
```

## Tips

1. **Order matters**: Check most specific patterns first, then fall through to more general patterns
2. **Normalize input**: Always trim, uppercase, and remove spaces/dashes before matching
3. **Use regex**: Pattern matching with regex is cleaner than string manipulation
4. **Provide helpful notes**: Include context in the `notes` field about the format, era, or any caveats
5. **Handle ambiguity**: If a serial could match multiple decades, note this in the response
6. **Test edge cases**: Include serials from the start/end of each format's date range
