/**
 * ESP Guitar Serial Number Decoder
 *
 * ESP serials vary significantly across eras and production lines. Supported formats include:
 * - US-prefix 7-digit (ESP USA Custom Shop, California)
 * - E + 7 digits (2016+ ESP Japan: production number, year, series code)
 * - ES + 7 digits (E-II early 2013–2015 Japan; E-II 2016+ Japan)
 * - E + 6 digits (ambiguous: early E-II Japan or early LTD Korea)
 * - ED + 6-7 digits (Edwards by ESP Japan domestic, YYWWDN format)
 * - SS + 7 digits (2000–2015 Japan Custom Shop)
 * - K/N/S/T/CH/CS/TH + 7-8 digits (2000–2015 Japan factory, YYWWDN format)
 * - K-prefix 4-5 digits (Kirk Hammett signature, early 1990s)
 * - R + 7 digits (LTD Korea Peerless, YY + week + sequence)
 * - GW + 8 digits (LTD Korea Gilmour, YY + week + day + 3-digit sequence)
 * - IW/WI/IC/IR + 7-8 digits (LTD Indonesia various)
 * - IS + 7-9 digits (LTD Indonesia Samick, YYMM format)
 * - W + 9 digits (LTD Korea WMI, YY + week + sequence)
 * - 9-digit all-numeric (LTD Korea/Indonesia, YY + week + day + sequence)
 * - U + 6 digits (LTD Korea Unsung early sequential, 2000–2001)
 * - W/E/U + 7-8 digits (LTD Korea various)
 * - GC + 7 digits (LTD China G-Tone, YY + week + sequence)
 * - C + 9 digits (LTD China single-letter, YY + week + sequence)
 * - L/RS/SH/SX/SK/SP + 7-8 digits (LTD China various)
 * - I + 7-8 digits (LTD Vietnam)
 * - 7-digit all-numeric (LTD transitional YY + week + sequence, or pre-2000 DMMYNNN)
 * - 8-digit all-numeric (pre-2000 DDMMYNNN day-first, or YYMM + sequence)
 * - 6-digit all-numeric (ambiguous: early LTD 1998–1999, Japan Original Series neck plate, or early 2000s Korean LTD with missing/worn prefix)
 * - 4-digit numeric (vintage Custom Shop / Original Series sequential, late 1980s–early 1990s)
 * - 5-digit numeric (vintage Japan 400 Series / Traditional / early Custom Shop neck plate)
 */
export function decodeESP(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // ESP USA format: US + 5 digits
    if (/^US\d{5}$/.test(normalized)) {
        return decodeESPUSA(normalized);
    }
    // 2016+ ESP format: E + 7 digits (E = ESP brand)
    if (/^E\d{7}$/.test(normalized)) {
        return decodeESP2016Plus(normalized);
    }
    // E-II format: ES + 7 digits
    // Pre-2016 (2009-2015): ES + YY + 5-digit sequence (year at front)
    // 2016+ E-II: ES + 4-digit prod num + YY + series code (year near end)
    // Fallback: if 2016+ parsing gives a future year, fall back to front-loaded year format.
    if (/^ES\d{7}$/.test(normalized)) {
        const earlyYear = parseInt(normalized.substring(2, 4), 10);
        if (earlyYear >= 9 && earlyYear <= 15) {
            return decodeEIIEarly(normalized);
        }
        const lateYear = parseInt(normalized.substring(6, 8), 10) + 2000;
        if (lateYear > new Date().getFullYear() + 2) {
            return decodeEIIEarly(normalized);
        }
        return decodeEII2016Plus(normalized);
    }
    // E-II extended 10-char: ES + 8 digits (year in last 2 digits, e.g. ES63155223 = 2023)
    if (/^ES\d{8}$/.test(normalized)) {
        return decodeEII10Char(normalized);
    }
    // Early E-II EL-prefix format: EL + YY + 5-digit sequence (2013-2015 era, alternate prefix)
    // e.g. EL1321202 = 2013, seq 21202
    if (/^EL\d{7}$/.test(normalized)) {
        return decodeELPrefixEarlyEII(normalized);
    }
    // Ambiguous ESP-owned E-prefix 6-digit format: early E-II Japan or early LTD Korea
    if (/^E\d{6}$/.test(normalized)) {
        return decodeAmbiguousEPrefix6Digit(normalized);
    }
    // Early LTD Korea E-prefix 5-digit sequential: E + 5 digits (~1999–2003)
    if (/^E\d{5}$/.test(normalized)) {
        return decodeEarlyLTDKoreaEShort(normalized);
    }
    // Edwards by ESP format: ED + YY + WW + D + N[N] (week/day/daily sequence)
    // 7-digit variant: if front-parsed year would be future (>2027), try alternate layout
    // where year is at positions [6:8] (e.g. ED3221253 = seq 3221, year 2025, series 3)
    if (/^ED\d{7}$/.test(normalized)) {
        const frontYear = 2000 + parseInt(normalized.substring(2, 4), 10);
        if (frontYear > 2027) {
            return decodeEdwardsEDNewFormat(normalized);
        }
    }
    if (/^ED\d{6,7}$/.test(normalized)) {
        return decodeEdwardsEDPrefix(normalized);
    }
    // 2000-2015 Japan ESP Custom Shop format: SS + 7-8 digits
    // 7-digit: SS + YY + WW + D + NNN (3-digit production); 8-digit: NNN extends to NNNN
    if (/^SS\d{7,8}$/.test(normalized)) {
        return decodeESPCustomShop(normalized);
    }
    // ESP Custom Shop Japan special format: K + 8 digits + letter + 2 digits
    // Kiso Custom Shop with embedded WMI/factory suffix (e.g. K09164080W15)
    if (/^K\d{8}[A-Z]\d{2}$/.test(normalized)) {
        return decodeESPKisoCustomSpecial(normalized);
    }
    // 2000-2015 Japan factory formats: K/N/S/T/CH/CS/TH + 7-8 digits
    if (/^(K|N|S|T|CH|CS|TH)\d{7,8}$/.test(normalized)) {
        return decodeESPJapanFactory(normalized);
    }
    // Kirk Hammett Signature: K- + 4-5 digits or K + 4-5 digits
    if (/^K-?\d{4,5}$/.test(normalized)) {
        return decodeKirkHammett(normalized);
    }
    // LTD Korean H-prefix factory: H + 7 digits (Hatone/Hanko Korea or GrassRoots-adjacent)
    // e.g. H0210967 = 2002, seq 10967; H0906045 = 2009, week 06, seq 045
    if (/^H\d{7}$/.test(normalized)) {
        return decodeLTDHPrefixFactory(normalized);
    }
    // LTD Korean GW-prefix factory (Gilmour): GW + YY + WW + D + 3-digit sequence
    // e.g. GW07165724 = 2007, week 16, Friday, seq 724
    if (/^GW\d{8}$/.test(normalized)) {
        const week = parseInt(normalized.substring(4, 6), 10);
        if (week >= 1 && week <= 53) {
            return decodeLTDKoreaGWGilmour(normalized);
        }
    }
    // LTD Asian formats with letter prefixes
    // Korea: R + YY + week + 2-3 digit sequence (Peerless; short-run variant is 6 digits after R)
    if (/^R\d{6,7}$/.test(normalized)) {
        const week = parseInt(normalized.substring(3, 5), 10);
        if (week >= 1 && week <= 53) {
            return decodeLTDKoreaPeerlessR(normalized);
        }
    }
    // Kirk Hammett White Zombie signature: KHWZ + sequence
    if (/^KHWZ\d+$/.test(normalized)) {
        return decodeKHWZSignature(normalized);
    }
    // Indonesia: IS + 7-9 digits (Samick, YYMM format — handled separately for full decode)
    if (/^IS\d{7,9}$/.test(normalized)) {
        return decodeLTDIndonesiaSamickIS(normalized);
    }
    // Indonesia: IWI + 8 digits (Wildwood variant with single-digit year)
    if (/^IWI\d{8}$/.test(normalized)) {
        return decodeLTDIndonesiaIWI(normalized);
    }
    // Indonesia: IW, WI, IC, IR + 7-9 digits (9 digits for higher-volume recent runs)
    if (/^(IW|WI|IC|IR)\d{7,9}$/.test(normalized)) {
        return decodeLTDIndonesia(normalized);
    }
    // Indonesia: CI + 7-9 digits (Cort/Cor-Tek Indonesia, YYMM format)
    if (/^CI\d{7,9}$/.test(normalized)) {
        return decodeLTDIndonesiaCI(normalized);
    }
    // Indonesia: IM + 7-9 digits (Cor-Tek/Cort Indonesia, YYMM format)
    if (/^IM\d{7,9}$/.test(normalized)) {
        return decodeLTDIndonesiaIM(normalized);
    }
    // Korea: W + YY + week + short sequence (5-6 digit total, short-run or early WMI batches)
    // e.g. W04082 = 2004, week 08, seq 2; W084082 = 2008, week 40, seq 82
    if (/^W\d{5,6}$/.test(normalized)) {
        return decodeLTDKoreaWShort(normalized);
    }
    // Korea: W + YY + week + 5-digit sequence (World Musical Instruments)
    if (/^W\d{9}$/.test(normalized)) {
        return decodeLTDKoreaWMI9Digit(normalized);
    }
    // Indonesia: WT + YY + week + 4-digit sequence (WMI Indonesia factory)
    if (/^WT\d{8}$/.test(normalized)) {
        return decodeLTDIndonesiaWT(normalized);
    }
    // Early Korea: U + 6-digit sequential tracking number (Unsung-era LTD)
    if (/^U\d{6}$/.test(normalized)) {
        return decodeLTDEarlyKoreaUSequential(normalized);
    }
    // Korea: W, E, U + 7-8 digits
    if (/^(W|E|U)\d{7,8}$/.test(normalized)) {
        return decodeLTDKorea(normalized);
    }
    // G-Tone China factory: GC + YY + week + 3-digit sequence
    if (/^GC\d{7}$/.test(normalized)) {
        return decodeLTDGToneChina(normalized);
    }
    // China factory single-letter C prefix: C + YY + week + 5-digit sequence (e.g. C124070985)
    if (/^C\d{9}$/.test(normalized)) {
        return decodeLTDChinaSingleC(normalized);
    }
    // China: L, RS, SH, SX, SK, SP + 7-8 digits
    if (/^(L|RS|SH|SX|SK|SP)\d{7,8}$/.test(normalized)) {
        return decodeLTDChina(normalized);
    }
    // Vietnam: I + 7-8 digits (but not IW, IC, IS, IR)
    if (/^I\d{7,8}$/.test(normalized)) {
        return decodeLTDVietnam(normalized);
    }
    // Vintage Japan ESP format: first digit = last digit of year (e.g. 9→1989), next 2 digits = week,
    // last 4 digits = production sequence. Detected when the LTD positional week (pos 2-4) is invalid
    // but the vintage positional week (pos 1-3) is valid and first digit is 7-9 (late 1980s/early 1990s).
    if (/^[789]\d{6}$/.test(normalized)) {
        const vintageWeek = parseInt(normalized.substring(1, 3), 10);
        if (vintageWeek >= 1 && vintageWeek <= 53) {
            return decodeJapanVintage7Digit(normalized);
        }
    }
    // LTD transitional Korean/Indonesian format: YY + week + 3-digit sequence
    if (/^\d{7}$/.test(normalized)) {
        const week = parseInt(normalized.substring(2, 4), 10);
        if (week >= 1 && week <= 53) {
            return decodeLTDTransitionalNumeric(normalized);
        }
    }
    // 8-digit all-numeric: try DDMMYNNN (pre-2000 day-first), then YYMMXXXX (year-first)
    if (/^\d{8}$/.test(normalized)) {
        return decode8DigitNumeric(normalized);
    }
    // 9-digit all-numeric LTD factory format: YY + WW + D + NNNN (Korea/Indonesia, week-based)
    if (/^\d{9}$/.test(normalized)) {
        const week9 = parseInt(normalized.substring(2, 4), 10);
        const day9 = parseInt(normalized.charAt(4), 10);
        if (week9 >= 1 && week9 <= 53 && day9 >= 0 && day9 <= 7) {
            return decodeLTDNumeric9Digit(normalized);
        }
    }
    // 7-digit fallthrough: LTD transitional check above did not match (invalid week); try pre-2000 DMMYNNN
    if (/^\d{7}$/.test(normalized)) {
        return decodePre2000(normalized);
    }
    // 6-digit all-numeric: try pre-2000 DMMYNNN shorthand first (single-digit day ≥ 1, single-digit month ≥ 1)
    // Falls back to the ambiguous 6-digit handler when the date parse fails.
    if (/^\d{6}$/.test(normalized)) {
        const pre2000Result = decodePre2000(normalized);
        if (pre2000Result.success) {
            return pre2000Result;
        }
        return decode6DigitAllNumericAmbiguous(normalized, cleaned);
    }
    // Vintage Custom Shop / Original Series sequential: 4 digits (e.g. 0085 = guitar #85)
    if (/^\d{4}$/.test(normalized)) {
        return decodeVintage4Digit(normalized);
    }
    // Older Japanese neck-plate numeric format: 5 digits
    if (/^\d{5}$/.test(normalized)) {
        return decodeVintageJapan5Digit(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this ESP serial number. The format was not recognized. Known formats include: US-prefix (ESP USA), E/ES-prefix (ESP Japan / E-II), ED-prefix (Edwards Japan), K-prefix (Kirk Hammett or Kiso Custom Shop), IS-prefix (LTD Indonesia Samick), GW-prefix (LTD Korea Gilmour, YY+WW+D+sequence), letter-factory-prefixed (LTD Korea/Indonesia/China/Vietnam), 9-digit all-numeric (LTD Korea/Indonesia YY+WW+D+NNNN), 6-digit all-numeric (early LTD 1998–1999, Japan Original Series neck plate, or early 2000s Korean LTD with missing prefix), 7-digit all-numeric (LTD transitional or pre-2000 Japan), 8-digit all-numeric (pre-2000 Japan DDMMYNNN), and 4- or 5-digit numeric (vintage Japan Custom Shop / Original Series).',
    };
}
function decodeESPUSA(serial) {
    const year = parseInt(serial.substring(2, 4), 10) + 2000;
    const buildNum = serial.substring(4);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP USA Custom Shop',
        country: 'USA (California)',
        model: 'ESP USA Custom',
        notes: `USA-made ESP. Build number: ${buildNum}.`
    };
    return { success: true, info };
}
function decodeESP2016Plus(serial) {
    const productionNum = serial.substring(1, 5);
    const year = parseInt(serial.substring(5, 7), 10) + 2000;
    const seriesCode = serial[7];
    let series;
    switch (seriesCode) {
        case '1':
            series = 'Custom Series';
            break;
        case '2':
            series = 'Signatures Series';
            break;
        case '3':
            series = 'E-II Series';
            break;
        default:
            series = 'Unknown Series';
    }
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP Japan',
        country: 'Japan',
        model: series,
        notes: `Production number: ${productionNum}. 2016+ serial format.`
    };
    return { success: true, info };
}
function decodeEII2016Plus(serial) {
    const productionNum = serial.substring(2, 6);
    const year = parseInt(serial.substring(6, 8), 10) + 2000;
    const seriesCode = serial[8];
    let series;
    switch (seriesCode) {
        case '1':
            series = 'E-II Custom Series';
            break;
        case '2':
            series = 'E-II Signatures Series';
            break;
        case '3':
            series = 'E-II Standard Series';
            break;
        default:
            series = 'E-II Series';
    }
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP Japan',
        country: 'Japan',
        model: series,
        notes: `E-II line. Production number: ${productionNum}. 2016+ serial format.`
    };
    return { success: true, info };
}
function decodeEIIEarly(serial) {
    const yearDigits = serial.substring(2, 4);
    const productionNum = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(productionNum, 10);
    const model = year < 2013 ? 'ESP Standard Series (Japan)' : 'E-II Series';
    const seriesNote = year < 2013
        ? 'ES identifies Japanese production at the ESP facility. Before the E-II brand was introduced in 2013, these instruments were sold as the ESP Standard series.'
        : 'ES identifies the E-II production line, which replaced the legacy ESP Standard series in 2013.';
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP Japan (Tokyo)',
        country: 'Japan',
        model,
        notes: `Pre-2016 ESP Japan format. ${seriesNote} ${yearDigits} indicates ${year}. ${productionNum} is the sequential production number (${sequenceNumber}). The year digits appear at the front of the numeric portion; post-2016 E-II serials move the year to the end.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-eii-early-es-yy-sequence',
        patternLabel: 'ESP Japan ES + YY + sequence (pre-2016)',
        additionalContext: {
            title: `ESP Japan ${model} serial (pre-2016)`,
            summary: 'This serial matches the pre-2016 ESP Japan format where ES identifies the production line, the first two digits encode the year, and the final five digits are the sequential production number.',
            highlights: [
                `ES identifies this as ${year < 2013 ? 'an ESP Standard Series' : 'an E-II'} model built in Japan.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${productionNum} decode as sequential production number ${sequenceNumber}.`,
                'This front-loaded year format predates the 2016 serial layout change.',
            ],
            caveats: [
                'Post-2016 E-II serials use a different layout where the year appears near the end of the serial.',
                'The serial alone does not encode the exact model shape (Horizon, Eclipse, M-II, Viper, etc.).',
                'Physical inspection and catalog comparison are needed to identify the exact model.',
            ],
            verificationTips: [
                'Check the back of the headstock for the E-II logo and a Made in Japan stamp.',
                'Look for a "Designed and built by ESP" circular logo or sticker on the back of the headstock.',
                'Compare the model shape, pickup configuration, and hardware against the 2014 E-II Japan catalog.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the early E-II Japan format where ES identifies the production line, the first two digits encode the year, and the final five digits are the sequential production number.</p><h3>How This Pattern Is Typically Read</h3><p>ES identifies this as an E-II model, the successor to the ESP Standard series. The digits ${yearDigits} decode as production year ${year}. The digits ${productionNum} decode as sequential production number ${sequenceNumber}. This format was used during the early E-II era (roughly 2013–2015) before ESP unified their Japanese serial system around 2016, at which point the year moved to near the end of the serial.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for the E-II logo and Made in Japan stamp.</li><li>Look for the "Designed and built by ESP" marking alongside the serial.</li><li>Compare the model shape, pickups, and hardware against the 2014 E-II Japan catalog to confirm the exact model.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed early E-II Japan decode, then identify the exact model from physical features and the catalog for the decoded year.</p>`,
    };
}
function decodeEII10Char(serial) {
    // 10-char E-II: ES + 4-digit prod num + 2-digit line code + 2-digit year
    // The year appears in the last 2 digits (similar to 2016+ E-II logic, extended one field)
    const productionNum = serial.substring(2, 6);
    const lineCode = serial.substring(6, 8);
    const yearDigits = serial.substring(8, 10);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const sequenceNumber = parseInt(productionNum, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year,
        factory: 'ESP Japan',
        country: 'Japan',
        model: 'E-II Series',
        notes: `ESP E-II 10-character extended format. ES identifies the E-II production line. Production number: ${sequenceNumber}. Line/factory code: ${lineCode}. Year digits ${yearDigits} decode as ${year}. This 10-character variant extends the standard 9-character 2016+ E-II format with an additional factory or line routing code.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-eii-japan-es-8digit-extended',
        patternLabel: 'ESP E-II Japan ES + 8-digit extended format',
        additionalContext: {
            title: 'ESP E-II extended 10-char serial',
            summary: 'This serial matches the E-II extended 10-character format where ES identifies the production line, four digits encode the production number, two digits encode a line/factory routing code, and the last two digits encode the year.',
            highlights: [
                'ES identifies the E-II production line (successor to ESP Standard).',
                `Production number: ${sequenceNumber}.`,
                `Line/factory routing code: ${lineCode}.`,
                `Year digits ${yearDigits} decode as ${year}.`,
            ],
            caveats: [
                'This 10-character variant is less common than the standard 9-character 2016+ E-II format.',
                'The serial identifies the production line and year; the exact model shape must be confirmed from physical features.',
            ],
            verificationTips: [
                'Check the back of the headstock for the E-II logo and a Made in Japan stamp.',
                'Look for the "Designed and built by ESP" marking alongside the serial.',
                `Compare the model shape, pickups, and hardware against the E-II Japan catalog for ${year}.`,
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the E-II extended 10-character format: ES identifies the production line, four digits are the production number, two digits are a factory/line routing code, and the last two digits encode the year.</p><h3>How This Pattern Is Typically Read</h3><p>ES identifies the E-II production line. The production number is ${sequenceNumber}. The line/factory routing code is ${lineCode}. The year digits ${yearDigits} decode as ${year}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for the E-II logo and Made in Japan stamp.</li><li>Compare the model shape, pickups, and hardware against the E-II Japan catalog for ${year}.</li></ul>`,
    };
}
function decodeLTDHPrefixFactory(serial) {
    // H-prefix LTD Korea/Japan factory (Hatone, Hanko, or similar)
    // 8 chars: H + YY(2) + rolling sequence(5)
    // e.g. H0210967 = 2002, sequence 10967; H0906045 = 2009, sequence 06045
    const yearDigits = serial.substring(1, 3);
    const sequence = serial.substring(3);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year,
        factory: 'H-prefix factory (Hatone/Hanko Korea or related LTD production)',
        country: 'South Korea',
        model: 'LTD or GrassRoots',
        notes: `H-prefix ESP LTD factory format. H identifies a Korean production facility (often cited as Hatone or Hanko). Year digits ${yearDigits} decode as ${year}. Rolling production sequence: ${sequenceNumber}. This format is associated with Korean LTD production and, on Japanese-domestic-market instruments, with GrassRoots by ESP. Verify from the headstock logo (LTD or GrassRoots) and the country-of-origin marking.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-korea-h-factory-yy-sequence',
        patternLabel: 'ESP LTD Korea H-prefix factory YY sequence',
        additionalContext: {
            title: 'ESP LTD H-prefix Korea factory serial',
            summary: 'This serial matches the ESP LTD H-prefix format associated with the Hatone or Hanko Korean factory, or GrassRoots Japanese domestic production.',
            highlights: [
                'H identifies a Korean production facility (Hatone or Hanko) or GrassRoots Japan.',
                `Year digits ${yearDigits} decode as ${year}.`,
                `Rolling production sequence: ${sequenceNumber}.`,
            ],
            caveats: [
                'H-prefix instruments may be branded LTD (Korean) or GrassRoots (Japanese domestic-market only).',
                'The serial identifies factory and year; the exact model must be confirmed from the headstock logo and physical features.',
            ],
            verificationTips: [
                'Check the headstock for LTD or GrassRoots branding.',
                'Look for a Made in Korea or Made in Japan country-of-origin stamp.',
                `Compare hardware, pickups, and construction against ESP LTD or GrassRoots catalog specs for ${year}.`,
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the ESP LTD H-prefix format associated with the Hatone or Hanko Korean factory (or GrassRoots Japanese domestic-market instruments).</p><h3>How This Pattern Is Typically Read</h3><p>H identifies a Korean production facility. Year digits ${yearDigits} decode as ${year}. Rolling production sequence: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock for LTD or GrassRoots branding.</li><li>Look for a Made in Korea or Made in Japan stamp.</li><li>Compare against ESP LTD or GrassRoots catalog specs for ${year}.</li></ul>`,
    };
}
function decodeLTDKoreaGWGilmour(serial) {
    // GW-prefix LTD Korea (Gilmour factory): GW + YY(2) + WW(2) + D(1) + sequence(3)
    // e.g. GW07165724 = 2007, week 16, Friday, seq 724
    const yearDigits = serial.substring(2, 4);
    const weekDigits = serial.substring(4, 6);
    const dayDigit = serial.charAt(6);
    const productionNum = serial.substring(7);
    const year = parseInt(yearDigits, 10) + 2000;
    const week = parseInt(weekDigits, 10);
    const day = parseInt(dayDigit, 10);
    const dateInfo = (day >= 1 && day <= 7) ? getDateFromWeekDay(year, week, day) : { month: undefined, day: undefined };
    const dayName = getDayOfWeekName(day);
    const sequenceNumber = parseInt(productionNum, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        month: dateInfo.month,
        factory: 'Gilmour factory, South Korea',
        country: 'South Korea',
        model: 'LTD',
        notes: `GW-prefix ESP LTD Korea format. GW identifies the Gilmour factory in Korea, which produced mid-to-high-tier LTD models for ESP. Year digits ${yearDigits} decode as ${year}. Week digits ${weekDigits} decode as production week ${week}${dateInfo.month ? `, approximately ${dateInfo.month}` : ''}. Day digit ${dayDigit} decodes as ${dayName}. Production number that day: ${sequenceNumber}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-korea-gw-gilmour-yywwd-sequence',
        patternLabel: 'ESP LTD Korea GW Gilmour factory YYWWD sequence',
        additionalContext: {
            title: 'ESP LTD Korea GW-prefix (Gilmour) serial',
            summary: 'This serial matches the GW-prefix format used by ESP LTD guitars built at the Gilmour factory in Korea during the mid-2000s.',
            highlights: [
                'GW identifies the Gilmour factory in Korea, a contractor for mid-to-high-tier LTD models.',
                `Year digits ${yearDigits} decode as ${year}.`,
                `Week digits ${weekDigits} decode as production week ${week}${dateInfo.month ? `, approximately ${dateInfo.month}` : ''}.`,
                `Day digit ${dayDigit} decodes as ${dayName}.`,
                `Production number that day: ${sequenceNumber}.`,
            ],
            caveats: [
                'The serial identifies factory, date, and production sequence, not the exact model shape.',
                'Confirm the model from the headstock logo and body shape.',
            ],
            verificationTips: [
                'Check the back of the headstock for "LTD" branding and a Made in Korea stamp.',
                'Compare body shape (e.g. Eclipse, Horizon, Viper) against 2007 Korean LTD catalog specs.',
                'Check hardware quality (TonePros, Grover, or Sperzel tuners; EMG or Seymour Duncan pickups) consistent with Korean-built LTD models from this era.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the GW-prefix format used by ESP LTD guitars built at the Gilmour factory in Korea during the mid-2000s.</p><h3>How This Pattern Is Typically Read</h3><p>GW identifies the Gilmour factory in Korea. Year digits ${yearDigits} decode as ${year}. Week digits ${weekDigits} decode as production week ${week}${dateInfo.month ? `, approximately ${dateInfo.month}` : ''}. Day digit ${dayDigit} decodes as ${dayName}. Production number that day: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for "LTD" branding and a Made in Korea stamp.</li><li>Compare body shape against 2007 Korean LTD catalog specs.</li><li>Check hardware quality consistent with Korean-built LTD models from this era.</li></ul>`,
    };
}
function decodeEarlyLTDKoreaEShort(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: '1999-2003 (estimated)',
        factory: 'Korean factory (E-prefix, possibly Peerless)',
        country: 'South Korea',
        model: 'LTD import (early series)',
        notes: `E-prefix 5-digit sequential format associated with early LTD Korea import production from approximately 1999–2003. The "E" prefix identifies an early Korean contracted factory (likely Peerless or similar). The digits "${sequence}" are a sequential production number. This format predates the longer structured serial systems. Verify the model and production year with headstock markings, hardware, and pickup configuration.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-korea-e-prefix-5digit-sequential',
        patternLabel: 'ESP LTD early Korea E-prefix 5-digit sequential',
        additionalContext: {
            title: 'ESP LTD early Korea E-prefix 5-digit serial',
            summary: 'This serial matches an early ESP LTD E-prefix sequential format associated with Korean factory production from approximately 1999–2003.',
            highlights: [
                'The "E" prefix identifies an early Korean contracted factory, likely Peerless or a similar facility.',
                `The digits "${sequence}" form a sequential production number without a date code.`,
                'This format is associated with early LTD import series from approximately 1999–2003.',
            ],
            caveats: [
                'The exact production year cannot be determined from this serial alone — the sequence number provides relative ordering only.',
                'Early ESP LTD serials used several different formats, and not all are definitively documented.',
            ],
            verificationTips: [
                'Check the headstock for "LTD" or "ESP" branding and the model name.',
                'Look for "Made in Korea" on the headstock back or interior label.',
                'Hardware, pickup, and construction details can help narrow the production year range.',
                'Contact ESP/LTD support with photos for official factory confirmation.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an early ESP LTD E-prefix sequential format associated with Korean factory production from approximately 1999–2003.</p><h3>How This Pattern Is Typically Read</h3><p>The "E" prefix identifies an early Korean contracted factory (likely Peerless or similar). The digits "${sequence}" form a sequential production number. This format predates the longer structured ESP/LTD serial systems.</p><h3>What To Verify</h3><ul><li>Check the headstock for "LTD" or "ESP" branding and the model name.</li><li>Look for "Made in Korea" on the headstock back.</li><li>Hardware, pickup, and construction details can help narrow the year range.</li></ul>`,
    };
}
function decodeAmbiguousEPrefix6Digit(serial) {
    const ltdYearDigit = serial[1];
    const ltdYear = 2000 + parseInt(ltdYearDigit, 10);
    const ltdSequence = serial.substring(2);
    const eiiYear = '2014';
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: `${eiiYear} or ${ltdYear} (context-dependent ESP/E-II vs LTD estimate)`,
        factory: 'ESP Japan E-II production or Saehan/Sunghak Korea LTD production',
        country: 'Japan / South Korea',
        model: 'ESP-owned E-prefix instrument',
        notes: `Ambiguous ESP-owned E-prefix 6-digit format. If the headstock says E-II, this format is commonly interpreted as early E-II Japan production around ${eiiYear}. If the headstock says LTD or has Made in Korea markings, E indicates the Korean Saehan/Sunghak-era factory, ${ltdYearDigit} indicates ${ltdYear}, and ${ltdSequence} is the production sequence. Use the headstock logo and country marking to choose the correct interpretation.`
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ambiguous-e-prefix-6-digit-eii-ltd',
        patternLabel: 'ESP ambiguous E-prefix 6-digit E-II/LTD format',
        additionalContext: {
            title: 'ESP E-prefix 6-digit serial',
            summary: 'This serial shape is valid for ESP-owned instruments, but the meaning depends on whether the guitar is branded E-II or LTD.',
            highlights: [
                `E-II interpretation: Japanese E-II production around ${eiiYear}.`,
                `LTD interpretation: Korean LTD production from ${ltdYear}, sequence ${ltdSequence}.`,
                'Headstock logo and country markings are required to choose the right result.'
            ],
            caveats: [
                'The serial alone cannot distinguish E-II Japan from LTD Korea for this format.',
                'Early ESP/LTD serial documentation is less consistent than newer 8-digit ESP/E-II formats.'
            ],
            verificationTips: [
                'If the front of the headstock says E-II, use the Japan/E-II interpretation.',
                'If the guitar says LTD or Made in Korea, use the Korean LTD interpretation.',
                'Check the back of the headstock for Made in Japan, Made in Korea, or ESP build stamps.'
            ]
        },
        additionalContextRichText: `<h3>Overview</h3><p>This E-prefix 6-digit serial is valid for ESP-owned instruments, but it is context-dependent.</p><h3>How This Pattern Is Typically Read</h3><p>If the guitar is branded E-II, ${serial} points to early Japanese E-II production around ${eiiYear}. If it is branded LTD or marked Made in Korea, E indicates the Korean Saehan/Sunghak-era factory, ${ltdYearDigit} indicates ${ltdYear}, and ${ltdSequence} is the production sequence.</p><h3>What To Verify</h3><ul><li>Check whether the headstock says E-II or LTD.</li><li>Look for Made in Japan, Made in Korea, or ESP build stamps on the back of the headstock.</li><li>Use the model name and hardware specs to confirm the production line.</li></ul>`
    };
}
function decodeEdwardsEDPrefix(serial) {
    const yearDigits = serial.substring(2, 4);
    const weekDigits = serial.substring(4, 6);
    const dayDigit = serial.charAt(6);
    const productionNum = serial.substring(7);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum);
    const week = parseInt(weekDigits, 10);
    const day = parseInt(dayDigit, 10);
    const dateInfo = (week >= 1 && week <= 53 && day >= 1 && day <= 7)
        ? getDateFromWeekDay(year, week, day)
        : { month: undefined, day: undefined };
    const dayName = getDayOfWeekName(day);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        month: dateInfo.month,
        factory: 'Edwards / ESP Japan domestic-market production',
        country: 'Japan',
        model: 'Edwards by ESP',
        notes: `Edwards ED-prefix format (EDYYWWDN[N]). ED indicates Edwards, an ESP Guitar Company Japanese domestic-market line. Year: ${year}; production week: ${week}; day of week: ${dayName} (${dayDigit}); daily production number: ${productionNum || '(not encoded)'}. These serials are commonly stamped on the back of the headstock or at the end of the fretboard.`
    };
    return {
        success: true,
        info,
        patternKey: 'esp-edwards-ed-yy-sequence',
        patternLabel: 'ESP Edwards ED prefix YYWWDN[N] format',
        additionalContext: {
            title: 'ESP Edwards ED-prefix serial',
            summary: 'Edwards guitars are Japanese domestic-market instruments produced and distributed by the ESP Guitar Company. The serial encodes year, production week, day of week, and daily sequence.',
            highlights: [
                'ED prefix identifies the Edwards line — a Japanese domestic-market ESP sub-brand.',
                `Year code ${yearDigits} decodes to ${year}.`,
                `Week ${weekDigits} decodes to production week ${week}${dateInfo.month ? `, approximately ${dateInfo.month}` : ''}.`,
                `Day digit ${dayDigit} decodes to ${dayName}.`,
                ...(productionNum ? [`Daily production number: ${productionNum}.`] : []),
            ],
            caveats: [
                'Edwards guitars are Japan-only instruments — they are not officially exported and are not commonly found outside Japan.',
                'The serial confirms the format, but model and specific finish details should be verified against the instrument.',
                'Edwards model names typically reference classic guitar shapes (e.g., E-LP for Les Paul style, E-HR for Horizon).',
            ],
            verificationTips: [
                'Check the back of the headstock or fretboard end for the stamped serial.',
                'Look for the small "Edwards by ESP" or "Designed and Built by ESP" marking near the headstock serial.',
                'Compare the model markings and specs against known Edwards catalog references or ESP Japan support.',
            ]
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Edwards ED-prefix format used on Japanese domestic-market guitars produced and distributed by ESP. The format encodes year, production week, day of week, and daily sequence number.</p><h3>How This Pattern Is Typically Read</h3><p>ED identifies the Edwards line. The digits ${yearDigits} decode as production year ${year}. The digits ${weekDigits} decode as production week ${week}${dateInfo.month ? `, approximately ${dateInfo.month}` : ''}. The digit ${dayDigit} decodes as ${dayName}. ${productionNum ? `The remaining digit(s) ${productionNum} are the daily production number.` : ''}</p><h3>What To Verify</h3><ul><li>Edwards guitars are Japan-only instruments and are not officially exported.</li><li>Confirm the serial on the back of the headstock or at the fretboard end.</li><li>Look for an "Edwards by ESP" or "Designed and Built by ESP" marking alongside the serial.</li><li>Compare the model, finish, hardware, and headstock markings against Edwards catalog references.</li></ul>`
    };
}
function decodeEdwardsEDNewFormat(serial) {
    // Alternate Edwards 7-digit layout: ED + seq(4) + year(2) + seriesCode(1)
    // e.g. ED3221253 = production seq 3221, year 2025, series code 3
    const sequenceDigits = serial.substring(2, 6);
    const yearDigits = serial.substring(6, 8);
    const seriesCode = serial.charAt(8);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const sequenceNumber = parseInt(sequenceDigits, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year,
        factory: 'Edwards / ESP Japan domestic-market production',
        country: 'Japan',
        model: 'Edwards by ESP',
        notes: `Edwards ED-prefix alternate format: ED + 4-digit production sequence + 2-digit year + 1-digit series code. ED identifies the Edwards Japanese domestic-market line. Production sequence: ${sequenceNumber}. Year digits ${yearDigits} decode as ${year}. Series code: ${seriesCode}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-edwards-ed-yy-sequence',
        patternLabel: 'ESP Edwards ED prefix alternate year-at-end format',
        additionalContext: {
            title: 'ESP Edwards ED-prefix serial (alternate format)',
            summary: 'This serial matches an alternate Edwards ED-prefix layout where the production sequence comes first, followed by the year code and a series digit at the end.',
            highlights: [
                'ED prefix identifies the Edwards line — a Japanese domestic-market ESP sub-brand.',
                `Production sequence: ${sequenceNumber}.`,
                `Year code ${yearDigits} decodes as ${year}.`,
                `Series/factory code digit: ${seriesCode}.`,
            ],
            caveats: [
                'Edwards guitars are Japan-only instruments — they are not officially exported and are rarely found outside Japan.',
                'This alternate serial layout differs from the more common week/day-encoded format.',
                'Model and finish details should be verified against the instrument and Japanese Edwards catalog references.',
            ],
            verificationTips: [
                'Check the back of the headstock or fretboard end for the stamped serial.',
                'Look for the small "Edwards by ESP" or "Designed and Built by ESP" marking alongside the serial.',
                `Compare the model markings and specs against Edwards catalog references for ${year}.`,
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an alternate Edwards ED-prefix layout used on Japanese domestic-market guitars. The production sequence is encoded first, followed by the year code and a series digit.</p><h3>How This Pattern Is Typically Read</h3><p>ED identifies the Edwards line. Production sequence: ${sequenceNumber}. Year code ${yearDigits} decodes as ${year}. Series/factory code: ${seriesCode}.</p><h3>What To Verify</h3><ul><li>Edwards guitars are Japan-only instruments and are not officially exported.</li><li>Confirm the serial on the back of the headstock or at the fretboard end.</li><li>Look for an "Edwards by ESP" or "Designed and Built by ESP" marking.</li><li>Compare against Edwards catalog references for ${year}.</li></ul>`,
    };
}
function decodeJapanVintage7Digit(serial) {
    // Vintage Japan ESP 7-digit: first digit = last digit of manufacture year (9→1989),
    // next 2 digits = production week, last 4 digits = sequential production number
    const yearLastDigit = parseInt(serial.charAt(0), 10);
    const year = 1980 + yearLastDigit;
    const weekDigits = serial.substring(1, 3);
    const week = parseInt(weekDigits, 10);
    const sequence = serial.substring(3);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP Japan production',
        country: 'Japan',
        notes: `Vintage Japan ESP 7-digit serial format. First digit ${yearLastDigit} indicates production year ${year}. Week digits ${weekDigits} indicate production week ${week}. Production sequence: ${sequenceNumber}. This numeric-only format was used on Japanese-made ESP Standard and Custom Shop instruments in the late 1980s and very early 1990s.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-japan-vintage-7digit-year-week-sequence',
        patternLabel: 'ESP Japan vintage 7-digit year-week sequence',
        additionalContext: {
            title: 'ESP Japan vintage 7-digit serial',
            summary: 'This serial matches the vintage Japan ESP 7-digit format where the first digit encodes the production year (e.g. 9 = 1989), the next two digits encode the production week, and the final four digits are the sequential production number.',
            highlights: [
                `First digit ${yearLastDigit} indicates production year ${year}.`,
                `Week digits ${weekDigits} indicate production week ${week}.`,
                `Sequential production number: ${sequenceNumber}.`,
                'This format was used on Japanese-made ESP Standard and Custom Shop instruments in the late 1980s to early 1990s.',
            ],
            caveats: [
                'This format pre-dates ESP\'s modern serial encoding and is based on community-documented conventions rather than official published records.',
                'The serial identifies the year and week; the exact model must be confirmed from physical features, headstock markings, and hardware.',
                'Vintage Japan ESP instruments are highly collectible — verify against original catalogs and consider professional authentication for high-value specimens.',
            ],
            verificationTips: [
                'The serial is typically stamped on the back of the headstock or on the neck plate (bolt-on models).',
                'Look for the ESP logo style consistent with the identified year.',
                `Compare the body shape, hardware, electronics, and construction against ESP Japan catalog specs for ${year}.`,
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the vintage Japan ESP 7-digit format used in the late 1980s to early 1990s. The first digit encodes the production year, the next two digits encode the production week, and the final four digits are the sequential production number.</p><h3>How This Pattern Is Typically Read</h3><p>First digit ${yearLastDigit} indicates production year ${year}. Week digits ${weekDigits} indicate production week ${week}. Sequential production number: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>The serial is typically stamped on the back of the headstock or on the neck plate.</li><li>Compare the body shape, hardware, and construction against ESP Japan catalog specs for ${year}.</li><li>Vintage Japan ESP instruments are highly collectible — consider professional authentication for high-value specimens.</li></ul>`,
    };
}
function getDayOfWeekName(day) {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[day - 1] || 'Unknown';
}
function decodeESPCustomShop(serial) {
    const year = parseInt(serial.substring(2, 4), 10) + 2000;
    const week = parseInt(serial.substring(4, 6), 10);
    const dayOfWeek = parseInt(serial[6], 10);
    const productionNum = serial.substring(7);
    // Calculate approximate date from week and day
    const dateInfo = getDateFromWeekDay(year, week, dayOfWeek);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        month: dateInfo.month,
        day: dateInfo.day,
        factory: 'ESP Custom Shop, Tokyo',
        country: 'Japan',
        model: 'ESP Custom Shop',
        notes: `Week ${week}, Day ${dayOfWeek} of week. Production #${productionNum} that day.`
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ss-custom-shop-japan-yywwd-seq',
    };
}
function decodeESPJapanFactory(serial) {
    // Extract factory code (1 or 2 letters)
    let factoryCode;
    let digits;
    if (/^(CH|CS|TH)/.test(serial)) {
        factoryCode = serial.substring(0, 2);
        digits = serial.substring(2);
    }
    else {
        factoryCode = serial[0];
        digits = serial.substring(1);
    }
    const year = parseInt(digits.substring(0, 2), 10) + 2000;
    const week = parseInt(digits.substring(2, 4), 10);
    const dayOfWeek = parseInt(digits[4], 10);
    const productionNum = digits.substring(5);
    const factory = getJapanFactory(factoryCode);
    const dateInfo = getDateFromWeekDay(year, week, dayOfWeek);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        month: dateInfo.month,
        day: dateInfo.day,
        factory: factory,
        country: 'Japan',
        model: 'ESP Japan',
        notes: `Week ${week}, Day ${dayOfWeek} of week. Production #${productionNum} that day.`
    };
    return { success: true, info };
}
function decodeKirkHammett(serial) {
    const numPart = serial.replace(/^K-?/, '');
    const productionNum = parseInt(numPart, 10);
    let year;
    if (numPart.length === 4) {
        year = '1993-1994';
    }
    else {
        year = '1995 or later';
    }
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year,
        factory: 'ESP Japan',
        country: 'Japan',
        model: 'Kirk Hammett Signature (KH Series)',
        notes: `Kirk Hammett Signature model. Production number: ${productionNum}. Early models (1993) used 4 digits; after 1995 launch, expanded to 5 digits.`
    };
    return { success: true, info };
}
function decodeKHWZSignature(serial) {
    const numPart = serial.substring(4);
    const productionNum = parseInt(numPart, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        factory: 'ESP Japan',
        country: 'Japan',
        model: 'Kirk Hammett White Zombie (KHWZ Signature)',
        notes: `Kirk Hammett White Zombie signature model. The "KHWZ" prefix identifies this as the White Zombie artist series. Production number: ${productionNum}. These are limited-edition signature instruments built at ESP Japan. Verify with model features including the distinctive White Zombie artwork and artist signature on the headstock or body.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-khwz-signature-japan-sequential',
        patternLabel: 'ESP Kirk Hammett White Zombie signature sequential',
        additionalContext: {
            title: 'ESP Kirk Hammett White Zombie signature serial',
            summary: 'This serial matches the KHWZ prefix used on Kirk Hammett White Zombie signature ESP guitars.',
            highlights: [
                'The KHWZ prefix identifies this as the Kirk Hammett White Zombie artist signature series.',
                `The remaining digits decode as production number ${productionNum}.`,
                'These are limited-edition signature instruments built at ESP Japan.',
            ],
            caveats: [
                'Production quantities are limited — verify the serial against known KHWZ production records.',
                'The production number alone does not confirm the model variant or finish.',
            ],
            verificationTips: [
                'Look for the White Zombie-themed artwork on the body and Kirk Hammett headstock signature.',
                'Confirm "Made in Japan" on the back of the headstock.',
                'Cross-reference with ESP signature model documentation for the KHWZ series.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the KHWZ prefix used on Kirk Hammett White Zombie signature ESP guitars.</p><h3>How This Pattern Is Typically Read</h3><p>The "KHWZ" prefix identifies this as the Kirk Hammett White Zombie artist signature series. The remaining digits decode as production number ${productionNum}. These are limited-edition signature instruments built at ESP Japan.</p><h3>What To Verify</h3><ul><li>Look for the White Zombie-themed artwork on the body and Kirk Hammett headstock signature.</li><li>Confirm "Made in Japan" on the back of the headstock.</li><li>Cross-reference with ESP signature model documentation for the KHWZ series.</li></ul>`,
    };
}
function decodeLTDIndonesia(serial) {
    const prefix = serial.match(/^(IW|WI|IC|IS|IR)/)?.[0] || '';
    const digits = serial.substring(prefix.length);
    const { year, month, productionNum } = parseLTDDigits(digits);
    const factory = getLTDIndonesiaFactory(prefix);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year,
        month: month,
        factory: factory,
        country: 'Indonesia',
        model: 'LTD',
        notes: `LTD series. Production number: ${productionNum}.`
    };
    return { success: true, info };
}
function decodeLTDIndonesiaIWI(serial) {
    const yearDigit = parseInt(serial[3], 10);
    const monthNum = parseInt(serial.substring(4, 6), 10);
    const sequence = serial.substring(6);
    // Single-digit year: find the most recent past year ending in that digit
    const currentYear = new Date().getFullYear();
    const decadeBase = Math.floor(currentYear / 10) * 10;
    let year = decadeBase + yearDigit;
    if (year > currentYear + 1)
        year -= 10;
    const month = monthNum >= 1 && monthNum <= 12 ? getMonthName(monthNum) : undefined;
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        ...(month ? { month } : {}),
        factory: 'P.T. Wildwood, Indonesia',
        country: 'Indonesia',
        model: 'LTD import',
        notes: `IWI-prefix ESP LTD format. IW identifies P.T. Wildwood Indonesia; the third I is a factory sub-code; "${serial[3]}" is a single production year digit (decoded as ${year}); "${serial.substring(4, 6)}" indicates ${month || 'the production month'}; "${sequence}" is the production sequence. Verify with Made in Indonesia headstock markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-indonesia-iwi-single-year-sequence',
        patternLabel: 'ESP LTD Indonesia IWI Wildwood single-digit year sequence',
        additionalContext: {
            title: 'ESP LTD Indonesia IWI Wildwood serial',
            summary: 'This serial matches the ESP LTD IWI-prefix format from the P.T. Wildwood factory in Indonesia.',
            highlights: [
                'IWI identifies P.T. Wildwood, Indonesia.',
                `The digit "${serial[3]}" decodes as production year ${year}.`,
                `The digits "${serial.substring(4, 6)}" decode as ${month || 'the production month'}.`,
                `The remaining digits "${sequence}" are the production sequence.`,
            ],
            caveats: [
                'Single-digit year codes repeat every decade; the year shown is the most recent plausible match.',
                'The serial identifies factory, date, and sequence — not the exact model name.',
            ],
            verificationTips: [
                'Check the headstock for LTD branding and the back for "Made in Indonesia" markings.',
                'Compare specs against LTD catalog offerings from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the ESP LTD IWI-prefix format from the P.T. Wildwood factory in Indonesia.</p><h3>How This Pattern Is Typically Read</h3><p>IWI identifies P.T. Wildwood Indonesia. The digit "${serial[3]}" decodes as year ${year}. The digits "${serial.substring(4, 6)}" decode as ${month || 'the production month'}. The remaining digits are production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Check the headstock for LTD branding and "Made in Indonesia" on the back.</li><li>Compare specs against LTD catalog offerings from ${year}.</li></ul>`,
    };
}
function decodeLTDIndonesiaCI(serial) {
    const digits = serial.substring(2);
    const { year, month, productionNum } = parseLTDDigits(digits);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year,
        month: month || undefined,
        factory: 'Cort / Cor-Tek, Indonesia',
        country: 'Indonesia',
        model: 'LTD',
        notes: `CI prefix identifies a Cort/Cor-Tek Indonesia factory ESP LTD serial. Parsed as CI + YYMM + sequence. ${digits.substring(0, 2)} indicates ${year}; ${digits.substring(2, 4)} indicates ${month || 'the production month'}; ${productionNum} is the production sequence. LTD Diamond Series import.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-indonesia-ci-cort-yymm-sequence',
        patternLabel: 'ESP LTD Indonesia Cort CI + YYMM + sequence',
        additionalContext: {
            title: 'ESP LTD Indonesia Cort CI serial',
            summary: 'This serial matches the ESP LTD CI-prefix format used on instruments built at the Cort/Cor-Tek factory in Indonesia.',
            highlights: [
                'CI identifies the Cort/Cor-Tek factory in Indonesia.',
                `The digits ${digits.substring(0, 2)} decode as production year ${year}.`,
                `The digits ${digits.substring(2, 4)} decode as ${month || 'the production month'}.`,
                `The remaining digits decode as production sequence ${parseInt(productionNum, 10)}.`,
            ],
            caveats: [
                'This format is used on LTD-branded instruments, not ESP Original, E-II, or Custom Shop models.',
                'Verify "Made in Indonesia" on the back of the headstock.',
            ],
            verificationTips: [
                'Check the front of the headstock for LTD branding.',
                'Look for "Made in Indonesia" on the back of the headstock.',
                'Compare hardware and specs against ESP LTD catalog offerings for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the ESP LTD CI-prefix format used on instruments built at the Cort/Cor-Tek factory in Indonesia.</p><h3>How This Pattern Is Typically Read</h3><p>CI identifies the Cort/Cor-Tek factory in Indonesia. The digits ${digits.substring(0, 2)} decode as production year ${year}. The digits ${digits.substring(2, 4)} decode as ${month || 'the production month'}. The remaining digits decode as production sequence ${parseInt(productionNum, 10)}.</p><h3>What To Verify</h3><ul><li>Check the front of the headstock for LTD branding.</li><li>Look for "Made in Indonesia" on the back of the headstock.</li><li>Compare specs against ESP LTD catalog offerings for the decoded year.</li></ul>`,
    };
}
function decodeLTDIndonesiaIM(serial) {
    const digits = serial.substring(2);
    const { year, month, productionNum } = parseLTDDigits(digits);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year,
        month: month || undefined,
        factory: 'Cor-Tek / Cort, Indonesia',
        country: 'Indonesia',
        model: 'LTD',
        notes: `IM prefix identifies a Cor-Tek/Cort Indonesia factory ESP LTD serial. Parsed as IM + YYMM + sequence. ${digits.substring(0, 2)} indicates ${year}; ${digits.substring(2, 4)} indicates ${month || 'the production month'}; ${productionNum} is the production sequence. LTD Diamond Series import.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-indonesia-im-cort-yymm-sequence',
        patternLabel: 'ESP LTD Indonesia Cort IM + YYMM + sequence',
        additionalContext: {
            title: 'ESP LTD Indonesia Cort IM serial',
            summary: 'This serial matches the ESP LTD IM-prefix format used on instruments built at the Cor-Tek/Cort factory in Indonesia.',
            highlights: [
                'IM identifies a Cor-Tek/Cort factory in Indonesia.',
                `The digits ${digits.substring(0, 2)} decode as production year ${year}.`,
                `The digits ${digits.substring(2, 4)} decode as ${month || 'the production month'}.`,
                `The remaining digits decode as production sequence ${parseInt(productionNum, 10)}.`,
            ],
            caveats: [
                'This format is used on LTD-branded instruments, not ESP Original, E-II, or Custom Shop models.',
                'Verify "Made in Indonesia" on the back of the headstock.',
            ],
            verificationTips: [
                'Check the front of the headstock for LTD branding.',
                'Look for "Made in Indonesia" on the back of the headstock.',
                'Compare hardware and specs against ESP LTD catalog offerings for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the ESP LTD IM-prefix format used on instruments built at the Cor-Tek/Cort factory in Indonesia.</p><h3>How This Pattern Is Typically Read</h3><p>IM identifies the Cor-Tek/Cort factory in Indonesia. The digits ${digits.substring(0, 2)} decode as production year ${year}. The digits ${digits.substring(2, 4)} decode as ${month || 'the production month'}. The remaining digits decode as production sequence ${parseInt(productionNum, 10)}.</p><h3>What To Verify</h3><ul><li>Check the front of the headstock for LTD branding.</li><li>Look for "Made in Indonesia" on the back of the headstock.</li><li>Compare specs against ESP LTD catalog offerings for the decoded year.</li></ul>`,
    };
}
function decodeLTDIndonesiaSamickIS(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const productionNum = digits.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const fullYear = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const monthNum = parseInt(monthDigits, 10);
    const monthName = monthNum >= 1 && monthNum <= 12 ? getMonthName(monthNum) : '';
    const sequenceNumber = parseInt(productionNum, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: fullYear,
        month: monthName || undefined,
        factory: 'Samick, Indonesia',
        country: 'Indonesia',
        model: 'LTD',
        notes: `LTD Indonesia Samick format interpreted as IS + YYMM + sequence. IS identifies the Samick factory in Indonesia; ${yearDigits} indicates ${fullYear}; ${monthDigits} indicates ${monthName || 'the production month'}; ${productionNum} is the rolling production sequence (${sequenceNumber}). This format is used on ESP LTD models manufactured at Samick's Indonesian facility. Verify the exact model from the headstock or 12th-fret inlay and confirm "Made in Indonesia" on the back of the headstock.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-indonesia-is-samick-yymm-sequence',
        patternLabel: 'ESP LTD Indonesia Samick IS + YYMM + sequence',
        additionalContext: {
            title: 'ESP LTD Indonesia Samick IS serial',
            summary: 'This serial matches the ESP LTD IS-prefix format used on instruments built at the Samick factory in Indonesia. The digits encode year, month, and a rolling production sequence.',
            highlights: [
                'IS identifies the Samick factory in Indonesia.',
                `The digits ${yearDigits} decode as production year ${fullYear}.`,
                `The digits ${monthDigits} decode as ${monthName || 'the production month'}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
                'This format is used on LTD-branded instruments, not ESP Original, E-II, or Custom Shop models.',
            ],
            caveats: [
                'The serial identifies factory, year, and month, not the exact model name or series number.',
                'An IS prefix on a guitar branded ESP (rather than LTD) is a red flag for a counterfeit.',
                'Confirm the exact model from the headstock or 12th-fret inlay markings.',
            ],
            verificationTips: [
                'Check the front of the headstock for LTD branding.',
                'Look for a "Made in Indonesia" stamp or decal on the back of the headstock.',
                'Compare the hardware, pickups, and construction against ESP LTD catalog specs for the decoded year.',
                'Contact ESP support at techinfo@espguitars.com with clear photos if authenticity confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the ESP LTD IS-prefix format used on instruments built at the Samick factory in Indonesia. The digits encode year, month, and a rolling production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>IS identifies the Samick factory in Indonesia. The digits ${yearDigits} decode as production year ${fullYear}. The digits ${monthDigits} decode as ${monthName || 'the production month'}. The remaining digits decode as production sequence ${sequenceNumber}. This format is used on LTD-branded instruments, not ESP Original, E-II, or Custom Shop models.</p><h3>What To Verify</h3><ul><li>Check the front of the headstock for LTD branding — an IS prefix on an ESP-branded guitar is a counterfeit warning sign.</li><li>Look for a "Made in Indonesia" stamp or decal on the back of the headstock.</li><li>Compare the hardware, pickups, and construction against ESP LTD catalog specs for ${fullYear}.</li><li>Contact ESP support at techinfo@espguitars.com with clear photos if authenticity confirmation is needed.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed Samick Indonesia LTD decode, then identify the exact model from the headstock or 12th-fret inlay and verify "Made in Indonesia" on the back of the headstock.</p>`,
    };
}
function decodeLTDNumeric9Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const weekDigits = serial.substring(2, 4);
    const dayDigit = serial.charAt(4);
    const productionNum = serial.substring(5);
    const yearNum = parseInt(yearDigits, 10);
    const fullYear = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum);
    const week = parseInt(weekDigits, 10);
    const day = parseInt(dayDigit, 10);
    const dayName = getDayOfWeekName(day);
    const dateInfo = getDateFromWeekDay(fullYear, week, day);
    const sequenceNumber = parseInt(productionNum, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: fullYear.toString(),
        month: dateInfo.month,
        factory: 'ESP LTD partner factory (Korea or Indonesia)',
        country: 'South Korea or Indonesia',
        model: 'LTD',
        notes: `Nine-digit numeric LTD factory format interpreted as YY + WW + D + NNNN. The digits ${yearDigits} indicate ${fullYear}; ${weekDigits} indicates production week ${week}${dateInfo.month ? `, approximately ${dateInfo.month}` : ''}; ${dayDigit} indicates ${dayName}; ${productionNum} is the production sequence (${sequenceNumber}). This week-and-day-based format is used across multiple LTD partner factories in Korea and Indonesia. Without a leading factory letter the exact factory cannot be determined from the serial alone. Verify with "Made in Korea" or "Made in Indonesia" on the back of the headstock.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-numeric-9digit-yy-ww-d-sequence',
        patternLabel: 'ESP LTD 9-digit numeric YY + WW + D + NNNN',
        additionalContext: {
            title: 'ESP LTD 9-digit numeric serial',
            summary: 'This serial matches a 9-digit all-numeric ESP LTD factory format that encodes year, production week, day of week, and a 4-digit production sequence. The format is used across multiple LTD partner factories.',
            highlights: [
                `The digits ${yearDigits} decode as production year ${fullYear}.`,
                `The digits ${weekDigits} decode as production week ${week}${dateInfo.month ? ` (approximately ${dateInfo.month})` : ''}.`,
                `The digit ${dayDigit} decodes as ${dayName}.`,
                `The final four digits decode as production sequence ${sequenceNumber}.`,
                'This week-and-day-based format is used across LTD partner factories in Korea and Indonesia.',
            ],
            caveats: [
                'Without a leading factory letter (such as W for WMI Korea or IS for Samick Indonesia), the exact factory cannot be confirmed from the serial alone.',
                'This is an LTD import format — not ESP Original, E-II, Custom Shop, or Edwards.',
                'High production sequence numbers (above 3000–4000) can indicate shared line numbering across multiple production runs rather than a single day\'s output.',
            ],
            verificationTips: [
                'Check the front of the headstock for LTD branding.',
                'Look for "Made in Korea" or "Made in Indonesia" on the back of the headstock to narrow the factory.',
                'Compare the model specs against ESP LTD catalog offerings for the decoded year.',
                'If the exact factory matters, contact ESP support at techinfo@espguitars.com with clear headstock photos.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 9-digit all-numeric ESP LTD factory format that encodes year, production week, day of week, and a 4-digit production sequence. The format is used across multiple LTD partner factories in Korea and Indonesia.</p><h3>How This Pattern Is Typically Read</h3><p>The digits ${yearDigits} decode as production year ${fullYear}. The digits ${weekDigits} decode as production week ${week}${dateInfo.month ? ` (approximately ${dateInfo.month})` : ''}. The digit ${dayDigit} decodes as ${dayName}. The final four digits decode as production sequence ${sequenceNumber}. This week-and-day-based format is consistent with large-volume LTD partner factories such as World Musical Instruments (WMI) in Korea and Samick-adjacent Indonesia facilities.</p><h3>What To Verify</h3><ul><li>Check the front of the headstock for LTD branding — this is not an ESP Original, E-II, or Custom Shop format.</li><li>Look for "Made in Korea" or "Made in Indonesia" on the back of the headstock to narrow the factory.</li><li>High sequence numbers (above ~3000–4000) may reflect shared line numbering across multiple production runs, not single-day output.</li><li>Compare specs against ESP LTD catalog offerings for ${fullYear} to identify the exact model.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed LTD factory decode for ${fullYear}. The country-of-origin marking on the back of the headstock is the most reliable way to narrow the factory. For exact authenticity confirmation, contact ESP support at techinfo@espguitars.com.</p>`,
    };
}
function decodeLTDKorea(serial) {
    const prefix = serial[0];
    const digits = serial.substring(1);
    const { year, month, productionNum } = parseLTDDigits(digits);
    const factory = getLTDKoreaFactory(prefix);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year,
        month: month,
        factory: factory,
        country: 'South Korea',
        model: 'LTD',
        notes: `LTD series. Production number: ${productionNum}.`
    };
    return { success: true, info };
}
function decodeLTDKoreaWMI9Digit(serial) {
    const yearDigits = serial.substring(1, 3);
    const weekDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const week = parseInt(weekDigits, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        month: week === 0 ? 'January' : undefined,
        factory: 'World Musical Instruments, South Korea',
        country: 'South Korea',
        model: 'LTD Deluxe / high-tier LTD import',
        notes: `Modern ESP LTD Korean W-prefix format. W indicates World Musical Instruments (WMI); ${yearDigits} indicates ${year}; ${weekDigits} is the production week or early-year production run code; ${sequence} is the factory tracking sequence. Week 00 is typically treated as the start of the production year.`
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-korea-wmi-w-yy-week-sequence',
        patternLabel: 'ESP LTD Korea WMI W + YY + week + sequence',
        additionalContext: {
            title: 'ESP LTD Korea WMI serial',
            summary: 'This serial matches a modern ESP LTD Korean W-prefix format associated with World Musical Instruments.',
            highlights: [
                'W indicates World Musical Instruments in South Korea.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${weekDigits} decode as production week or early-year run code.`,
                `The final digits decode as tracking sequence ${sequence}.`
            ],
            caveats: [
                'The serial identifies factory timing and sequence, not the exact model name.',
                'Week 00 is best read as very early-year production or wood/prep run timing rather than a normal calendar week.'
            ],
            verificationTips: [
                'Check the headstock for LTD branding and the back of the headstock for Made in Korea markings.',
                'Compare the guitar against LTD Deluxe 1000 Series or signature-model specs from the decoded year.'
            ]
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern ESP LTD Korean W-prefix format associated with World Musical Instruments.</p><h3>How This Pattern Is Typically Read</h3><p>W indicates World Musical Instruments in South Korea. The digits ${yearDigits} decode as production year ${year}. The digits ${weekDigits} decode as the production week or early-year run code. The final digits decode as tracking sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>The serial identifies factory timing and sequence, not the exact model name.</li><li>Week 00 is best read as very early-year production or wood/prep run timing.</li><li>Check for LTD branding and Made in Korea markings.</li></ul>`
    };
}
function decodeLTDIndonesiaWT(serial) {
    const yearDigits = serial.substring(2, 4);
    const weekDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const week = parseInt(weekDigits, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        month: week === 0 ? 'January' : undefined,
        factory: 'World Musical Instruments, Indonesia',
        country: 'Indonesia',
        model: 'LTD import',
        notes: `ESP LTD Indonesian WT-prefix format. WT indicates World Musical Instruments (WMI) Indonesia; ${yearDigits} indicates ${year}; ${weekDigits} is the production week; ${sequence} is the factory tracking sequence.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-indonesia-wt-yy-week-sequence',
        patternLabel: 'ESP LTD Indonesia WMI WT + YY + week + sequence',
        additionalContext: {
            title: 'ESP LTD Indonesia WMI serial',
            summary: 'This serial matches the ESP LTD Indonesian WT-prefix format associated with World Musical Instruments (WMI).',
            highlights: [
                'WT indicates World Musical Instruments (WMI) Indonesia factory.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${weekDigits} decode as production week.`,
                `The final digits decode as tracking sequence ${sequence}.`,
            ],
            caveats: [
                'The serial identifies factory timing and sequence, not the exact model name.',
            ],
            verificationTips: [
                'Check the headstock for LTD branding and the back of the headstock for Made in Indonesia markings.',
                'Compare the guitar against LTD model specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the ESP LTD Indonesian WT-prefix format associated with World Musical Instruments (WMI).</p><h3>How This Pattern Is Typically Read</h3><p>WT indicates World Musical Instruments Indonesia. The digits ${yearDigits} decode as production year ${year}. The digits ${weekDigits} decode as the production week. The final digits decode as tracking sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Check for LTD branding and Made in Indonesia markings.</li><li>Compare the guitar against LTD model specs from ${year}.</li></ul>`,
    };
}
function decodeLTDEarlyKoreaUSequential(serial) {
    const sequence = serial.substring(1);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: '2000-2001 (estimated)',
        factory: 'Unsung, South Korea',
        country: 'South Korea',
        model: 'LTD',
        notes: `Early ESP LTD Korean U-prefix format. U is associated with Unsung production, and the six digits are treated as a sequential factory tracking number rather than a reliable YYMM date code. Sequence/tracking number: ${sequenceNumber}. This format is best dated broadly to around 2000-2001 and should be verified with Made in Korea markings, headstock logo, model specs, and serial location.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-early-korea-u-sequential',
        patternLabel: 'ESP LTD early Korea U-prefix sequential format',
        additionalContext: {
            title: 'ESP LTD early Korea U-prefix serial',
            summary: 'This serial matches an early ESP LTD Korean U-prefix format associated with Unsung production.',
            highlights: [
                'U is treated as an Unsung Korea factory prefix for this early LTD format.',
                `The six digits are treated as sequential tracking number ${sequenceNumber}.`,
                'The likely production window is around 2000-2001.',
            ],
            caveats: [
                'The six digits do not reliably encode an exact year, month, or week.',
                'This applies to LTD-branded Korean imports, not Japanese ESP Original, E-II, Edwards, or Navigator instruments.',
                'Factory and date should be confirmed from Made in Korea markings and model details.',
            ],
            verificationTips: [
                'Check the back of the headstock or final fret area for the serial and Made in Korea marking.',
                'Compare the guitar against early-2000s LTD model specs such as M, H, MH, EC, and related Korean lines.',
                'Contact ESP support with clear photos if exact production confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an early ESP LTD Korean U-prefix format associated with Unsung production.</p><h3>How This Pattern Is Typically Read</h3><p>U is treated as an Unsung Korea factory prefix for this early LTD format. The six digits are treated as sequential tracking number ${sequenceNumber}. The likely production window is around 2000-2001.</p><h3>What To Verify</h3><ul><li>The six digits do not reliably encode an exact year, month, or week.</li><li>This applies to LTD-branded Korean imports, not Japanese ESP Original, E-II, Edwards, or Navigator instruments.</li><li>Confirm with Made in Korea markings, model details, and serial location.</li></ul>`,
    };
}
function decodeLTDChinaSingleC(serial) {
    const yearDigits = serial.substring(1, 3);
    const weekDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const week = parseInt(weekDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP LTD China factory',
        country: 'China',
        model: 'LTD',
        notes: `ESP LTD China single-letter C factory format. "C" identifies a Chinese factory; ${yearDigits} indicates ${year}; ${weekDigits} indicates production week ${week} of ${year}; ${sequence} is the factory sequence number (${sequenceNumber}). This format is used on ESP LTD budget and mid-range models. Verify the exact model from the headstock or 12th-fret inlay markings, and confirm "Made in China" on the back of the headstock.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-china-single-c-yy-week-sequence',
        patternLabel: 'ESP LTD China single-letter C + YY + week + sequence',
        additionalContext: {
            title: 'ESP LTD China single-letter C serial',
            summary: 'This serial matches an ESP LTD China factory format: C + production year + calendar week + sequence number.',
            highlights: [
                '"C" identifies a Chinese factory.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${weekDigits} decode as production week ${week} of ${year}.`,
                `The final digits decode as factory sequence number ${sequenceNumber}.`,
            ],
            caveats: [
                'This format is used on LTD budget and mid-range models, not ESP Original, E-II, or Custom Shop lines.',
                'A "Made in China" ESP headstock should always say LTD — a premium ESP logo on a China serial is a red flag for counterfeits.',
                'The serial identifies factory, year, and week, not the exact model name.',
            ],
            verificationTips: [
                'Check the headstock front or 12th-fret inlay for the exact LTD model name.',
                'Look for "Made in China" on the back of the headstock.',
                'Compare hardware, pickups, and construction against the ESP LTD catalog for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an ESP LTD China factory format: C + production year + calendar week + sequence number.</p><h3>How This Pattern Is Typically Read</h3><p>"C" identifies a Chinese factory. The digits ${yearDigits} decode as production year ${year}. The digits ${weekDigits} decode as production week ${week} of ${year}. The final digits decode as factory sequence number ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format is used on LTD budget and mid-range models, not ESP Original or E-II lines.</li><li>A premium ESP logo on a China serial is a red flag for counterfeits — authentic China-built ESPs always say LTD.</li><li>Check the headstock or 12th-fret inlay for the exact LTD model name and look for "Made in China" on the back of the headstock.</li></ul>`,
    };
}
function decodeLTDGToneChina(serial) {
    const yearDigits = serial.substring(2, 4);
    const weekDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const week = parseInt(weekDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'G-Tone factory, China',
        country: 'China',
        model: 'LTD (10, 50, 100, or 200 Series)',
        notes: `ESP LTD G-Tone China factory format. GC identifies the G-Tone factory in China; ${yearDigits} indicates ${year}; ${weekDigits} indicates production week ${week} of ${year}; ${sequence} is the factory sequence number (${sequenceNumber}). This format is predominantly used on ESP LTD entry-level and intermediate models (10-, 50-, 100-, and 200-series). Verify the exact model from the headstock or 12th-fret inlay markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-china-gtone-gc-yy-week-sequence',
        patternLabel: 'ESP LTD China G-Tone GC + YY + week + sequence',
        additionalContext: {
            title: 'ESP LTD G-Tone China serial',
            summary: 'This serial matches the ESP LTD G-Tone China factory format: GC + production year + calendar week + sequence number.',
            highlights: [
                'GC identifies the G-Tone factory in China.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${weekDigits} decode as production week ${week} of ${year}.`,
                `The final three digits decode as factory sequence number ${sequenceNumber}.`,
            ],
            caveats: [
                'This format is used on LTD entry-level and intermediate models, not ESP Original or E-II lines.',
                'The serial identifies factory, year, and week, not the exact model name or series number.',
                'Counterfeit LTD instruments exist; consistent serial formatting is a good sign but not sufficient alone.',
            ],
            verificationTips: [
                'Check the headstock front or 12th-fret inlay for the exact LTD model name.',
                'Look for "Made in China" on the back of the headstock.',
                'Compare hardware, pickups, and construction against the ESP LTD catalog for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the ESP LTD G-Tone China factory format: GC + production year + calendar week + sequence number.</p><h3>How This Pattern Is Typically Read</h3><p>GC identifies the G-Tone factory in China. The digits ${yearDigits} decode as production year ${year}. The digits ${weekDigits} decode as production week ${week} of ${year}. The final three digits decode as factory sequence number ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This format is used on LTD entry-level and intermediate models, not ESP Original or E-II lines.</li><li>Check the headstock or 12th-fret inlay for the exact LTD model name.</li><li>Look for "Made in China" on the back of the headstock and compare against the ESP LTD catalog for ${year}.</li></ul>`,
    };
}
function decodeLTDChina(serial) {
    let prefix;
    let digits;
    if (/^(RS|SH|SX|SK|SP)/.test(serial)) {
        prefix = serial.substring(0, 2);
        digits = serial.substring(2);
    }
    else {
        prefix = serial[0];
        digits = serial.substring(1);
    }
    const { year, month, productionNum } = parseLTDDigits(digits);
    const factory = getLTDChinaFactory(prefix);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year,
        month: month,
        factory: factory,
        country: 'China',
        model: 'LTD',
        notes: `LTD series. Production number: ${productionNum}.`
    };
    return { success: true, info };
}
function decodeLTDVietnam(serial) {
    const digits = serial.substring(1);
    const { year, month, productionNum } = parseLTDDigits(digits);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year,
        month: month,
        factory: 'Vietnam Factory',
        country: 'Vietnam',
        model: 'LTD',
        notes: `LTD series. Production number: ${productionNum}.`
    };
    return { success: true, info };
}
function decodeLTDKoreaPeerlessR(serial) {
    const yearDigits = serial.substring(1, 3);
    const weekDigits = serial.substring(3, 5);
    const productionNum = serial.substring(5);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 80 ? 2000 + yearNum : 1900 + yearNum).toString();
    const week = parseInt(weekDigits, 10);
    const sequence = parseInt(productionNum, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year,
        factory: 'Peerless Guitar Co.',
        country: 'South Korea',
        model: 'LTD Korean import',
        notes: `R-prefix ESP LTD Korean format. R indicates Peerless Guitar Co. in South Korea; the digits ${yearDigits} indicate ${year}; ${weekDigits} indicates production week ${week}; and ${productionNum} is production sequence ${sequence}. This format is associated with early-to-mid-2000s Korean LTD production. Verify the model, logo style, and Made in Korea marking on the back of the headstock.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-korea-peerless-r-yy-week-sequence',
        patternLabel: 'ESP LTD Korea Peerless R YY week sequence',
        additionalContext: {
            title: 'ESP LTD Peerless Korea R-prefix serial',
            summary: 'This serial matches an R-prefix ESP LTD format associated with Peerless-built Korean production.',
            highlights: [
                'R indicates Peerless Guitar Co. in South Korea.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${weekDigits} decode as production week ${week}.`,
                `The final three digits decode as production sequence ${sequence}.`,
            ],
            caveats: [
                'This format identifies factory timing and sequence, not the exact model name.',
                'Factory-letter usage varies across ESP LTD production eras and partners.',
                'Confirm the guitar is LTD-branded and marked Made in Korea before relying on the Peerless interpretation.',
            ],
            verificationTips: [
                'Check for LTD branding on the headstock.',
                'Look for a Made in Korea stamp or decal on the back of the headstock.',
                'Compare the finish, neck construction, hardware, and pickups against 2006 LTD catalog specs.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an R-prefix ESP LTD format associated with Peerless-built Korean production.</p><h3>How This Pattern Is Typically Read</h3><p>R indicates Peerless Guitar Co. in South Korea. The digits ${yearDigits} decode as production year ${year}. The digits ${weekDigits} decode as production week ${week}. The final three digits decode as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>This format identifies factory timing and sequence, not the exact model name.</li><li>Confirm the guitar is LTD-branded and marked Made in Korea before relying on the Peerless interpretation.</li><li>Compare the finish, neck construction, hardware, and pickups against 2006 LTD catalog specs.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a mid-2000s Peerless Korea LTD decode, then verify the exact model from the headstock logo, country stamp, and physical specs.</p>`,
    };
}
function decodeLTDTransitionalNumeric(serial) {
    const yearDigits = serial.substring(0, 2);
    const weekDigits = serial.substring(2, 4);
    const productionNum = serial.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 80 ? 2000 + yearNum : 1900 + yearNum).toString();
    const week = parseInt(weekDigits, 10);
    const sequence = parseInt(productionNum, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year,
        factory: 'ESP LTD Korean / Indonesian partner factory',
        country: 'South Korea or Indonesia',
        model: 'LTD transitional import',
        notes: `Seven-digit LTD transitional numeric format. The first two digits (${yearDigits}) indicate ${year}; the next two digits (${weekDigits}) indicate production week ${week}; the final three digits indicate production sequence ${sequence}. These pure numeric serials are seen on late-1990s through mid-2000s ESP LTD imports, before later factory-letter formats became more standardized. Verify the exact factory from the Made in Korea or Made in Indonesia marking.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-transitional-yy-week-sequence',
        patternLabel: 'ESP LTD transitional YY week sequence',
        additionalContext: {
            title: 'ESP LTD transitional numeric serial',
            summary: 'This serial matches a seven-digit pure numeric ESP LTD format used on some late-1990s through mid-2000s Korean and Indonesian imports.',
            highlights: [
                `The first two digits ${yearDigits} decode as production year ${year}.`,
                `The next two digits ${weekDigits} decode as production week ${week}.`,
                `The final three digits decode as production sequence ${sequence}.`,
            ],
            caveats: [
                'This format identifies production timing and sequence, not the exact model name.',
                'The serial alone usually cannot distinguish Korea from Indonesia.',
                'Modern ESP LTD instruments more commonly use leading factory-letter serial formats.',
            ],
            verificationTips: [
                'Check whether the headstock is branded LTD rather than ESP Original, E-II, Edwards, or Navigator.',
                'Look for Made in Korea or Made in Indonesia on the back of the headstock.',
                'Compare the logo style and model specs against mid-2000s LTD catalog examples.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a seven-digit pure numeric ESP LTD format used on some late-1990s through mid-2000s Korean and Indonesian imports.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits, ${yearDigits}, decode as production year ${year}. The next two digits, ${weekDigits}, decode as production week ${week}. The final three digits decode as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>This format identifies production timing and sequence, not the exact model name.</li><li>The serial alone usually cannot distinguish Korea from Indonesia.</li><li>Check for LTD branding and Made in Korea or Made in Indonesia markings on the back of the headstock.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a mid-2000s ESP LTD import decode, then verify the exact model and factory from the headstock logo, country stamp, and catalog specs.</p>`,
    };
}
function decode8DigitNumeric(serial) {
    // Try DDMMYNNN first (pre-2000 ESP Japan: day, month, single year digit, sequence)
    const dayNum = parseInt(serial.substring(0, 2), 10);
    const ddmmMonthNum = parseInt(serial.substring(2, 4), 10);
    if (dayNum >= 1 && dayNum <= 31 && ddmmMonthNum >= 1 && ddmmMonthNum <= 12) {
        return decodePre2000(serial);
    }
    // Fallback: YYMMXXXX (year-first format, e.g. 98050768 = 1998, May, sequence 768)
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);
    if (monthNum < 1 || monthNum > 12) {
        // Non-calendar "month" slot: treat as YY + factory/batch code + 4-digit sequence (Japan 2000s+)
        // Example: 10901025 = year 10 (2010), batch/factory code 90, sequence 1025
        const year2 = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
        const sequenceNumber2 = parseInt(sequence, 10);
        return {
            success: true,
            info: {
                brand: 'ESP',
                serialNumber: serial,
                year: year2,
                factory: 'ESP Japan',
                country: 'Japan',
                notes: `ESP 8-digit Japan format with batch/factory code. The digits ${yearDigits} indicate year ${year2}; ${monthDigits} is a batch or factory routing code (not a calendar month); ${sequence} is the production sequence (${sequenceNumber2}). This format is associated with ESP Japan Custom Shop and standard Japanese production from the 2000s–2010s. The month of production is not encoded in this serial. Verify the exact model from the headstock logo and any catalog reference for ${year2}.`,
            },
            patternKey: 'esp-japan-yy-batch-sequence-8digit',
            patternLabel: 'ESP Japan 8-digit YY + batch code + sequence',
            additionalContext: {
                title: 'ESP Japan 8-digit serial with factory/batch code',
                summary: `This serial matches an ESP Japan 8-digit format where the first two digits encode the year (${year2}), the next two digits are a factory or batch routing code rather than a calendar month, and the final four digits are the production sequence.`,
                highlights: [
                    `The digits ${yearDigits} decode as production year ${year2}.`,
                    `The digits ${monthDigits} are a factory or batch routing code, not a calendar month.`,
                    `The remaining digits decode as production sequence ${sequenceNumber2}.`,
                    'This format is used on ESP Japan Custom Shop and Japanese-factory ESP instruments from the 2000s–2010s.',
                ],
                caveats: [
                    'The exact production month is not encoded in this serial format.',
                    'Batch code values vary; the specific meaning of the code is not publicly documented.',
                    'The serial identifies the production year and sequence; confirm the exact model from physical features.',
                ],
                verificationTips: [
                    'Check the back of the headstock for "Made in Japan" and the ESP or E-II logo.',
                    'Look for a Custom Shop certificate or build sheet if the guitar was a special order.',
                    `Compare the model shape, pickups, and hardware against ESP Japan catalog specs for ${year2}.`,
                ],
            },
            additionalContextRichText: `<h3>Overview</h3><p>This serial matches an ESP Japan 8-digit format where the first two digits encode the year, the next two digits are a factory or batch routing code (not a calendar month), and the final four digits are the production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The digits ${yearDigits} decode as production year ${year2}. The digits ${monthDigits} are a factory or batch routing code — not a calendar month. The remaining digits decode as production sequence ${sequenceNumber2}. This format is used on ESP Japan Custom Shop and Japanese-factory instruments from the 2000s–2010s.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for "Made in Japan" and the ESP or E-II logo.</li><li>Look for a Custom Shop certificate or build sheet if the guitar was a special order.</li><li>Compare the model shape, pickups, and hardware against ESP Japan catalog specs for ${year2}.</li></ul>`,
        };
    }
    const yearInt = yearNum < 50 ? 2000 + yearNum : 1900 + yearNum;
    const currentYear = new Date().getFullYear();
    if (yearInt > currentYear + 2) {
        // YYMM gives a future year — try factory(1)+YY(2)+WW(2)+seq(3) instead
        const factoryCode = serial[0];
        const altYearNum = parseInt(serial.substring(1, 3), 10);
        const altWeek = parseInt(serial.substring(3, 5), 10);
        const altSeq = serial.substring(5);
        const altYear = (altYearNum < 50 ? 2000 + altYearNum : 1900 + altYearNum).toString();
        if (altWeek >= 1 && altWeek <= 53) {
            return {
                success: true,
                info: {
                    brand: 'ESP',
                    serialNumber: serial,
                    year: altYear,
                    factory: 'ESP LTD Korea or Indonesia',
                    country: 'South Korea or Indonesia',
                    notes: `ESP LTD 8-digit factory+YY+WW+seq format. Factory/line code: ${factoryCode}; year: ${altYear}; production week: ${altWeek}; sequence: ${parseInt(altSeq, 10)}. Verify with headstock logo and country-of-origin marking.`,
                },
                patternKey: 'esp-ltd-8digit-factory-yy-week-sequence',
                patternLabel: 'ESP LTD 8-digit factory+YY+week+sequence',
            };
        }
    }
    const year = yearInt.toString();
    const monthName = getMonthName(monthNum);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year,
        month: monthName,
        factory: 'ESP Japan or ESP LTD Korea',
        country: 'Japan or South Korea',
        notes: `Late-1990s/early-2000s ESP 8-digit year-first format. The digits ${yearDigits} indicate ${year}; ${monthDigits} indicates ${monthName}; ${sequence} is the production sequence (${sequenceNumber}). If the headstock says ESP or ESP Standard, this is likely a Japanese-built instrument. If it says LTD, this may be an early Korean LTD. Verify the exact factory and model from the headstock logo and country-of-origin marking.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-late-1990s-yymm-sequence-8digit',
        patternLabel: 'ESP late 1990s/early 2000s YYMM + 4-digit sequence',
        additionalContext: {
            title: 'ESP late-1990s/early-2000s 8-digit serial',
            summary: 'This serial matches a late-1990s/early-2000s ESP 8-digit format where the first two digits encode the year, the next two encode the month, and the final four are the production sequence.',
            highlights: [
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${monthDigits} decode as ${monthName}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
                'This format is seen on both ESP Japan (Original/Standard series) and early ESP LTD Korean imports from this era.',
            ],
            caveats: [
                'The serial alone cannot confirm whether this is an ESP Japan or ESP LTD Korean instrument.',
                'ESP Japan and ESP LTD guitars from this era can have very different build quality, hardware, and value.',
                'The serial identifies production date; the exact model must be confirmed from the headstock and physical features.',
            ],
            verificationTips: [
                'Check the headstock logo — "ESP" indicates the Original/Standard series; "LTD" indicates the import line.',
                'Look for "Made in Japan" or "Made in Korea" stamped on the back of the headstock or neck plate.',
                'Compare the hardware, finishes, and construction against ESP and LTD catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a late-1990s/early-2000s ESP 8-digit format where the first two digits encode the year, the next two encode the month, and the final four are the production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${monthName}. The remaining digits decode as production sequence ${sequenceNumber}. This format is seen on both ESP Japan (Original/Standard series) and early ESP LTD Korean imports from this era.</p><h3>What To Verify</h3><ul><li>Check the headstock logo — "ESP" indicates the Original/Standard series; "LTD" indicates the import line.</li><li>Look for "Made in Japan" or "Made in Korea" on the back of the headstock or neck plate.</li><li>Compare the hardware, finishes, and construction against ESP and LTD catalog specs from the decoded year.</li></ul>`,
    };
}
function decode6DigitAllNumericAmbiguous(normalized, cleaned) {
    const firstTwo = normalized.substring(0, 2);
    const remaining = normalized.substring(2);
    const possibleYear = 2000 + parseInt(firstTwo, 10);
    const info = {
        brand: 'ESP',
        serialNumber: cleaned,
        year: 'late 1980s–early 2000s (estimated)',
        factory: 'ESP Japan Original/Custom Shop / Korean LTD import factory (context-dependent)',
        country: 'Japan / South Korea',
        notes: `Six-digit all-numeric ESP serials span three documented interpretations. (1) Early ESP LTD (1998–1999): during the brief window just before ESP introduced factory letter prefixes (E, U, R) in 2000, some LTD models used 6-digit all-numeric serials as sequential production block numbers — in this reading the digits are a sequential identifier and "${firstTwo}" does not reliably indicate ${possibleYear}. (2) ESP Japan Original/Custom Shop neck-plate sequential: early Japanese models, including bolt-on signature guitars like the Kirk Hammett KH-2, used 5- and 6-digit sequential numbers stamped directly into the metal neck plate — in this reading the full number is a guitar-level sequence number and the era is late 1980s to early 1990s. (3) Early 2000s Korean LTD with a missing or worn letter prefix: Korean LTDs from 2000–2003 used a factory letter (U, R, E) followed by 6 digits (e.g. U028304 or R028304); if the prefix is worn off or faded, the remaining 6 digits match this serial exactly — under this reading ${firstTwo} decodes as production year ${possibleYear} and ${remaining} is the factory tracking sequence. Verify with the headstock logo (ESP vs LTD), country-of-origin marking, and whether the serial is on a neck plate (Japan bolt-on) or back of headstock (LTD).`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ambiguous-6-digit-all-numeric',
        patternLabel: 'ESP ambiguous 6-digit all-numeric (early LTD / Japan neck plate / missing prefix)',
        additionalContext: {
            title: 'ESP 6-digit all-numeric serial',
            summary: 'Six-digit all-numeric ESP serials are ambiguous across three eras and production lines. The headstock logo, country marking, and serial placement (neck plate vs. headstock decal) are required to choose the correct interpretation.',
            highlights: [
                'Three valid interpretations: early LTD (1998–1999) pre-prefix sequential; ESP Japan Original/Custom Shop bolt-on neck plate; or early 2000s Korean LTD with a missing or worn factory letter prefix.',
                `If this is a Korean LTD with a worn or missing prefix, ${firstTwo} decodes as production year ${possibleYear} and ${remaining} is the factory tracking sequence.`,
                'Classic ESP Japan bolt-on neck plates (including early Kirk Hammett KH-2 models) used 5–6 digit sequential stamps pressed into the metal plate.',
                'ESP introduced factory letter prefixes (U, R, E) on Korean LTD serials around 2000; a bare 6-digit number on an LTD from that era is a sign of a worn or missing prefix.',
            ],
            caveats: [
                'The serial alone cannot distinguish Japan from Korean LTD production for this format.',
                'If a letter prefix is partially visible or worn, re-read the full serial carefully before concluding it is purely numeric.',
                'Early LTD serials from 1998–1999 used a sequential production block number where the first two digits are not a reliable year code.',
                'ESP serial documentation for the 1998–2003 transition era is less consistent than later standardized formats.',
            ],
            verificationTips: [
                'Check whether the serial is stamped into a metal neck plate (bolt-on Japan Original Series) or printed/stickered on the back of the headstock (typical LTD format).',
                'Look at the headstock logo — "ESP" or "ESP Custom Shop" vs. "LTD" — and note the country-of-origin marking.',
                'Inspect carefully for a worn or faded letter prefix before the first digit.',
                'Compare the guitar against early LTD catalog specs (1998–2003) or late-1980s/early-1990s ESP Japan Original Series and Custom Shop models.',
                'Contact ESP customer service with clear photos of the serial, headstock logo, and country marking if exact production confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>Six-digit all-numeric ESP serials are ambiguous and match three different eras and production lines. The headstock logo, country-of-origin marking, and serial placement are required to determine the correct interpretation.</p><h3>How This Pattern Is Typically Read</h3><p>There are three contexts for this format. First: early ESP LTD models from 1998–1999, just before ESP introduced factory letter prefixes (E, U, R) around 2000, used 6-digit all-numeric serials as sequential production block numbers — in this context the digits are a sequential identifier and the first two digits are not a reliable year code. Second: ESP Japan Original Series and Custom Shop bolt-on guitars — including early Kirk Hammett KH-2 models — used 5–6 digit sequential numbers stamped directly into the metal neck plate, where the full 6-digit number is a guitar-level sequence. Third: Korean LTD models from 2000–2003 used a factory letter (U, R, or E) followed by 6 digits (e.g. U028304 or R028304); if the prefix is worn or faded, the remaining six digits match this serial exactly — under that reading, ${firstTwo} decodes as production year ${possibleYear} and ${remaining} is the factory tracking sequence.</p><h3>What To Verify</h3><ul><li>Check whether the serial is stamped into a metal neck plate (bolt-on Japan Original Series) or on the back of the headstock (typical LTD placement).</li><li>Look at the headstock logo and country-of-origin marking to identify the production line.</li><li>Inspect carefully for a worn or faded factory letter before the first digit.</li><li>Compare the hardware, construction, and finish against early LTD catalog specs (1998–2003) or late-1980s/early-1990s ESP Japan Original Series and Custom Shop models.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a starting point, then use the headstock logo, serial placement (neck plate vs. headstock), and country-of-origin marking to select the correct interpretation. Physical inspection is essential for this serial format.</p>`,
    };
}
function decodePre2000(serial) {
    // Pre-2000 format: DDMMYNNN (8 digits) or shorter variants (6-7 digits)
    // Sometimes leading zeros are dropped
    let day;
    let month;
    let yearDigit;
    let productionNum;
    if (serial.length === 8) {
        // Full format: DDMMYNNN
        day = serial.substring(0, 2);
        month = serial.substring(2, 4);
        yearDigit = serial[4];
        productionNum = serial.substring(5);
    }
    else if (serial.length === 7) {
        // Missing leading zero on day: DMMYNNN
        day = '0' + serial[0];
        month = serial.substring(1, 3);
        yearDigit = serial[3];
        productionNum = serial.substring(4);
    }
    else {
        // 6 digits - missing leading zeros on day and/or month
        day = '0' + serial[0];
        month = '0' + serial[1];
        yearDigit = serial[2];
        productionNum = serial.substring(3);
    }
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(yearDigit, 10);
    // Validate day and month
    if (dayNum < 1 || dayNum > 31 || monthNum < 1 || monthNum > 12) {
        return {
            success: false,
            error: 'Unable to decode this ESP serial number. The date values appear invalid.'
        };
    }
    // Year digit could be 1980s or 1990s
    const possibleYears = getPre2000Years(yearNum);
    const monthName = getMonthName(monthNum);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: possibleYears,
        month: monthName,
        day: dayNum.toString(),
        factory: 'ESP Japan',
        country: 'Japan',
        notes: `Pre-2000 format. Production #${parseInt(productionNum, 10)} on this date. Note: Year could be ${possibleYears} - check model history to confirm decade.`
    };
    return { success: true, info };
}
function decodeVintage4Digit(serial) {
    const sequence = parseInt(serial, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: 'late 1980s to early 1990s (estimated)',
        factory: 'ESP Custom Shop / Original Series, Japan',
        country: 'Japan',
        model: 'Custom Shop / Original Series (early production)',
        notes: `ESP vintage 4-digit sequential serial. These very short numeric serials appear on early Japanese ESP Custom Shop instruments and low-numbered Original Series guitars from the late 1980s and very early 1990s, when total production volume was still small enough that four digits sufficed. This is instrument #${sequence} in the production run. ESP serial records from this era are not consistently date-coded; confirm the exact date from neck-heel or neck-pocket markings, body cavity stamps, or ESP support when possible.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-vintage-4-digit-custom-shop',
        patternLabel: 'ESP vintage 4-digit Custom Shop / Original Series sequential',
        additionalContext: {
            title: 'ESP vintage 4-digit serial',
            summary: 'This 4-digit serial appears on early Japanese ESP Custom Shop or Original Series instruments from the late 1980s to very early 1990s, when total production was low enough that four digits sufficed.',
            highlights: [
                `This is instrument number ${sequence} in the production run.`,
                'Four-digit numeric serials are early production — typically late 1980s to early 1990s.',
                'Common on Japanese Custom Shop and low-numbered Original Series guitars.',
                'The serial is best treated as a sequential production number, not a date-encoded code.',
            ],
            caveats: [
                'ESP historical records from this era are sparse and not public-facing.',
                'The serial alone cannot confirm the exact year, model, or factory.',
                'A 4-digit serial is a strong indicator of early/low production, but the exact date needs physical confirmation.',
            ],
            verificationTips: [
                'Check whether the serial is stamped into a metal neck plate.',
                'Inspect the neck heel or neck pocket for a handwritten or stamped production date.',
                'Look for a Custom Shop certificate of authenticity or factory documentation.',
                'Contact ESP customer service with clear photos of the serial, headstock, neck plate, and bridge if authenticity matters.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This 4-digit serial appears on early Japanese ESP Custom Shop or Original Series instruments from the late 1980s to very early 1990s, when total production was low enough that four digits sufficed.</p><h3>How This Pattern Is Typically Read</h3><p>Four-digit numeric serials are treated as sequential production numbers. This is instrument #${sequence} in the production run. These serials are not reliably date-coded, so exact year confirmation requires physical evidence.</p><h3>What To Verify</h3><ul><li>Check the neck plate, neck heel, or neck pocket for a stamped or handwritten production date.</li><li>ESP historical records from this era are sparse — contact ESP support with clear photos if authenticity matters.</li><li>Compare hardware, electronics, and construction against late-1980s/early-1990s ESP Original Series and Custom Shop specs.</li></ul>`,
    };
}
function decodeVintageJapan5Digit(serial) {
    const sequence = parseInt(serial, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: 'late 1980s to early 1990s (estimated)',
        factory: 'ESP Japan (Sado or Takada factory likely)',
        country: 'Japan',
        model: 'Traditional / 400 Series or early Custom Shop',
        notes: `Older ESP 5-digit numeric serial, commonly seen on Japanese-made Traditional, 400 Series, Original Series, or early Custom Shop instruments. Sequence: ${sequence}. ESP serial records from this era are not consistently date-coded, so confirm the exact date from neck-heel or neck-pocket markings when possible.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-vintage-japan-5-digit',
        patternLabel: 'ESP vintage Japan 5-digit',
        additionalContext: {
            title: 'ESP vintage Japan 5-digit serial',
            summary: 'This serial matches an older Japanese ESP 5-digit numeric format seen on late-1980s and early-1990s instruments.',
            highlights: [
                'Five-digit numeric serials are commonly seen on older ESP Japan neck plates.',
                'The likely era is late 1980s to early 1990s.',
                'Common matches include Traditional, 400 Series, Original Series, or early Custom Shop instruments.',
                `The digits are best treated as sequence ${sequence}, not a reliable date code.`,
            ],
            caveats: [
                'ESP historical records from this era are incomplete and often not public-facing.',
                'The serial alone usually cannot confirm an exact month or day.',
                'Factory attribution should be verified from physical markings and model details.',
            ],
            verificationTips: [
                'Check whether the serial is stamped into a metal neck plate.',
                'Inspect the neck heel or neck pocket for a handwritten or stamped production date.',
                'Contact ESP customer service with clear photos of the serial, headstock, neck plate, and bridge if authenticity matters.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an older Japanese ESP 5-digit numeric format seen on late-1980s and early-1990s instruments.</p><h3>How This Pattern Is Typically Read</h3><p>Five-digit numeric serials are commonly seen on older ESP Japan neck plates. The likely era is late 1980s to early 1990s. Common matches include Traditional, 400 Series, Original Series, or early Custom Shop instruments. The digits are best treated as sequence ${sequence}, not a reliable date code.</p><h3>What To Verify</h3><ul><li>ESP historical records from this era are incomplete and often not public-facing.</li><li>The serial alone usually cannot confirm an exact month or day.</li><li>Factory attribution should be verified from physical markings and model details.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a vintage Japan ESP decode, then confirm with the neck plate, neck-heel or neck-pocket date markings, and ESP support when authenticity matters.</p>`,
    };
}
function parseLTDDigits(digits) {
    // LTD format: YYMM + remaining digits for production number
    // 7 digits = 2000-2010 era, 8 digits = 2010+ era
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const productionNum = digits.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const monthNum = parseInt(monthDigits, 10);
    const month = monthNum >= 1 && monthNum <= 12 ? getMonthName(monthNum) : undefined;
    return { year, month: month || '', productionNum };
}
function getJapanFactory(code) {
    switch (code) {
        case 'K':
            return 'Kiso Factory, Japan';
        case 'N':
            return 'Nagano Factory, Japan';
        case 'S':
            return 'Sado Factory, Japan';
        case 'T':
            return 'Takada Factory, Japan';
        case 'CH':
        case 'CS':
            return 'Craft House, Japan';
        case 'TH':
            return 'Technical House, Japan';
        default:
            return 'ESP Japan';
    }
}
function getLTDIndonesiaFactory(prefix) {
    switch (prefix) {
        case 'IW':
        case 'WI':
            return 'P.T. Wildwood, Indonesia';
        case 'IC':
            return 'Cor-tek, Indonesia';
        case 'IS':
            return 'Samick, Indonesia';
        case 'IR':
            return 'Indonesia Factory';
        default:
            return 'Indonesia Factory';
    }
}
function getLTDKoreaFactory(prefix) {
    switch (prefix) {
        case 'W':
            return 'World Musical Instruments, Incheon';
        case 'E':
        case 'U':
            return 'South Korea Factory';
        default:
            return 'South Korea Factory';
    }
}
function getLTDChinaFactory(prefix) {
    switch (prefix) {
        case 'L':
            return 'China Factory';
        case 'RS':
            return 'China Factory (possibly Wildwood)';
        case 'SH':
            return 'China Factory (possibly SaeJun)';
        case 'SX':
        case 'SK':
        case 'SP':
            return 'China Factory';
        default:
            return 'China Factory';
    }
}
function getPre2000Years(digit) {
    // Single digit could represent 1980s or 1990s
    const year80s = 1980 + digit;
    const year90s = 1990 + digit;
    if (digit >= 0 && digit <= 9) {
        return `${year80s} or ${year90s}`;
    }
    return 'Unknown';
}
function getDateFromWeekDay(year, week, dayOfWeek) {
    // Calculate approximate date from ISO week number and day of week
    // Day 1 = Monday, Day 7 = Sunday
    const jan4 = new Date(year, 0, 4);
    const startOfYear = new Date(jan4);
    startOfYear.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1);
    const targetDate = new Date(startOfYear);
    targetDate.setDate(startOfYear.getDate() + (week - 1) * 7 + (dayOfWeek - 1));
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return {
        month: monthNames[targetDate.getMonth()],
        day: targetDate.getDate().toString()
    };
}
function decodeESPKisoCustomSpecial(serial) {
    const yearDigits = serial.substring(1, 3);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP Custom Shop, Kiso, Japan',
        country: 'Japan',
        notes: `ESP Custom Shop Japan special production format. K indicates the Kiso Custom Shop facility. The digits ${yearDigits} decode as production year ${year}. The trailing letter and digits appear to encode additional factory or batch identifiers not used in standard ESP serial conventions. Verify authenticity from the headstock logo, body binding, and ESP Custom Shop paperwork.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-kiso-custom-k-yy-special',
        patternLabel: 'ESP Kiso Custom Shop K-YY special format',
    };
}
function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month - 1] || '';
}
function decodeELPrefixEarlyEII(serial) {
    // EL + YY(2) + 5-digit sequence — early E-II era (2013-2015), alternate EL prefix
    const yearDigits = serial.substring(2, 4);
    const productionNum = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(productionNum, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year: year.toString(),
        factory: 'ESP Japan (Tokyo)',
        country: 'Japan',
        model: 'E-II Series',
        notes: `Early ESP E-II Japan format with EL prefix (2013–2015 era). EL identifies the E-II production line (alternate prefix to ES). Year digits ${yearDigits} decode as ${year}. Sequential production number: ${sequenceNumber}. This predates ESP's unified 2016+ serial format.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-early-eii-el-prefix-yy-sequence',
        patternLabel: 'ESP early E-II EL-prefix YY + sequence (2013–2015)',
        additionalContext: {
            title: 'ESP early E-II EL-prefix serial',
            summary: 'This serial matches the early E-II Japan format with EL prefix: year digits followed by sequential production number.',
            highlights: [
                'EL identifies an E-II production line — an alternate prefix to the more common ES used during the same era.',
                `Year digits ${yearDigits} decode as production year ${year}.`,
                `Sequential production number: ${sequenceNumber}.`,
            ],
            caveats: [
                'Post-2016 E-II serials use a different layout where the year appears near the end.',
                'The serial does not encode the exact model shape; confirm from physical features and the E-II catalog.',
            ],
            verificationTips: [
                'Check the back of the headstock for the E-II logo and a Made in Japan stamp.',
                `Compare model shape, pickup configuration, and hardware against the E-II Japan catalog for ${year}.`,
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the early E-II Japan format with EL prefix used in roughly 2013–2015.</p><h3>How This Pattern Is Typically Read</h3><p>EL identifies the E-II production line. Year digits ${yearDigits} decode as ${year}. Sequential production number: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for the E-II logo and Made in Japan stamp.</li><li>Compare model shape, pickups, and hardware against the E-II Japan catalog for ${year}.</li></ul>`,
    };
}
function decodeLTDKoreaWShort(serial) {
    // W + YY(2) + WW(2) + short-seq (1-2 digits) — shorter WMI Korea batches
    const yearDigits = serial.substring(1, 3);
    const weekDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const week = parseInt(weekDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'ESP',
        serialNumber: serial,
        year,
        factory: 'World Musical Instruments (WMI), South Korea',
        country: 'South Korea',
        model: 'LTD Series',
        notes: `LTD Korea WMI short-format serial. W identifies World Musical Instruments Korea. Year digits ${yearDigits} decode as ${year}. Week digits ${weekDigits} decode as week ${week}. Production sequence: ${sequenceNumber}. Short-run WMI batches use abbreviated sequences.`,
    };
    return {
        success: true,
        info,
        patternKey: 'esp-ltd-korea-w-short-yy-week-sequence',
        patternLabel: 'ESP LTD Korea WMI W-prefix short YY + week + sequence',
        additionalContext: {
            title: 'ESP LTD Korea WMI short serial',
            summary: 'This serial matches a short-format LTD Korea WMI serial with W prefix, year, week number, and abbreviated production sequence.',
            highlights: [
                'W identifies World Musical Instruments (WMI), a major Korean ESP LTD contractor.',
                `Year digits ${yearDigits} decode as ${year}.`,
                `Week digits ${weekDigits} decode as week ${week}.`,
                `Production sequence: ${sequenceNumber}.`,
            ],
            caveats: [
                'Short-sequence WMI serials are less common than the full 9-digit WMI format.',
                'Exact model identity requires physical inspection — headstock logo and hardware spec.',
            ],
            verificationTips: [
                'Check the back of the headstock for a Made in Korea stamp and the LTD logo.',
                `Compare body shape, pickups, and hardware against LTD Korea specs from ${year}.`,
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a short-format LTD Korea WMI serial with W prefix, year, week, and abbreviated sequence.</p><h3>How This Pattern Is Typically Read</h3><p>W identifies World Musical Instruments Korea. Year digits ${yearDigits} decode as ${year}. Week digits ${weekDigits} decode as week ${week}. Production sequence: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for Made in Korea stamp and LTD logo.</li><li>Compare model shape and hardware against LTD Korea specs from ${year}.</li></ul>`,
    };
}
