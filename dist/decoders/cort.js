/**
 * Cort Guitar Serial Number Decoder
 *
 * Supports:
 * - Modern two-letter factory/line prefix: C[A-Z] + YYMM + sequence; generic two-letter fallback (e.g. PO acoustic line)
 * - Modern format: YYMMXXXX (2000-2004); impossible-future-year variant flagged as suspicious
 * - Modern format with omitted leading zero: YMMXXXXX (2000-2009)
 * - Modern numeric year/batch format: YY00XXXX
 * - Modern format extended: YYMMXXXXX (2005-present)
 * - Modern 10-digit format: YYMMXXXXXX (2004-era, 6-digit sequence)
 * - Modern 12-digit logistics/tracking format: YY + 10-digit sequence
 * - Late 1990s format: YYMMXXXX (1990-1999)
 * - 1980s Korean 7-digit year/sequence format: 88XXXXX
 * - 1990s format: YMMXXXX (early 1990s-1999)
 * - R prefix year/sequence format: RYYXXXXX
 * - W.O. prefix: 1970s-1980s Korean production
 * - Indonesian production: Various prefixes (AI, I, IA, IIA, IC, ICS, ICSE, etc.)
 * - Chinese production: COS, COB prefixes
 *
 * Note: Pre-mid-1990s guitars often have randomly generated serial numbers.
 */
export function decodeCort(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Modern three-letter factory/line prefix: C[A-Z]{2} + YYMM + sequence (e.g. CSA251002567)
    if (/^C[A-Z]{2}\d{7,9}$/.test(normalized)) {
        return decodeModernThreeLetterFactoryLine(normalized);
    }
    // Modern two-letter factory/line prefix: C[A-Z] + YYMM + sequence
    // 7 digits covers short-batch sequences (e.g. CA2501026 = CA+25+01+026)
    if (/^C[A-Z]\d{7,9}$/.test(normalized)) {
        return decodeModernTwoLetterFactoryLine(normalized);
    }
    // Single-letter China factory prefix: C + YYMM + sequence (e.g. C125030418 = China 2012, C05010229 = 2005 Jan)
    // Month field may be an anomalous export/batch code (e.g. "50") rather than a calendar month.
    if (/^C\d{8,9}$/.test(normalized)) {
        return decodeChinaSingleLetterC(normalized);
    }
    // Modern alphanumeric factory/line prefix: 1A + YYMM + sequence
    if (/^\d[A-Z]\d{9}$/.test(normalized)) {
        return decodeModernAlphaFactoryLine(normalized);
    }
    // W.O./W0 prefix - vintage 1970s/1980s Korean production
    if (/^W(?:\.?O\.?|0)\s*\d+/i.test(cleaned)) {
        return decodeWOPrefix(cleaned);
    }
    // Indonesian Cort factory: ICSE prefix (IC + SE production line/series)
    if (/^ICSE\d{8}$/.test(normalized)) {
        return decodeIndonesiaICSE(normalized);
    }
    // Indonesian Cort factory: ICS prefix (Factory Special Run)
    if (/^ICS\d{8,9}$/.test(normalized)) {
        return decodeIndonesiaICS(normalized);
    }
    // Indonesian Cort factory: AI prefix
    if (/^AI\d{9}$/.test(normalized)) {
        return decodeIndonesiaAI(normalized);
    }
    // Indonesian Cort factory: IC prefix
    if (/^IC\d{8}$/.test(normalized)) {
        return decodeIndonesiaIC(normalized);
    }
    // Indonesian Cort factory: ICF prefix (Fender branded)
    if (/^ICF\d{8}$/.test(normalized)) {
        return decodeIndonesiaICF(normalized);
    }
    // Indonesian Cort factory: IE prefix (10-digit IE serials seen on some 2022+ runs)
    if (/^IE\d{8,10}$/.test(normalized)) {
        return decodeIndonesiaIE(normalized);
    }
    // Indonesian Cort factory: IA prefix (Indonesia factory line A, Surabaya)
    // Only matches 8-digit sequences (10 chars total); 9-digit IA serials remain handled
    // as likely transpositions of the AI prefix (Mojokerto facility) via retry logic.
    if (/^IA\d{8}$/.test(normalized)) {
        return decodeIndonesiaIA(normalized);
    }
    // Indonesian Cort IIA factory: IIA prefix + YYMM + sequence
    if (/^IIA\d{8,9}$/.test(normalized)) {
        return decodeIndonesiaIIA(normalized);
    }
    // Indonesian Cort factory: plain I prefix + YYMMXXXXX (e.g. I250804919 = Indonesia 2025 August)
    if (/^I\d{9}$/.test(normalized)) {
        return decodeIndonesiaSingleI(normalized);
    }
    // Indonesian Cort factory: IS + 1-2 letter product/line code + YY + sequence (e.g. ISSG22002098)
    if (/^IS[A-Z]{1,2}\d{6,8}$/.test(normalized)) {
        return decodeIndonesiaISProductLine(normalized);
    }
    // Chinese Cort factory: COS prefix
    if (/^COS\d{8,9}$/.test(normalized)) {
        return decodeChinaCOS(normalized);
    }
    // Chinese Cort factory: COB prefix
    if (/^COB\d{8,9}$/.test(normalized)) {
        return decodeChinaCOB(normalized);
    }
    // R prefix: factory/line prefix + YY + sequence (e.g. R0611374 = 2006)
    if (/^R\d{7}$/.test(normalized)) {
        return decodeRPrefixYearSequence(normalized);
    }
    // F prefix: Indonesian factory + YY + sequence (e.g. F034130 = 2003)
    if (/^F\d{6}$/.test(normalized)) {
        return decodeIndonesiaFPrefix(normalized);
    }
    // LA-prefix Cor-tek factory line: LA + YY + MM + sequence (9 digits = 11 chars total)
    // e.g. LA220687942 = 2022, June, seq 87942
    if (/^LA\d{9}$/.test(normalized)) {
        return decodeLAFactoryYYMM(normalized);
    }
    // Generic two-letter factory prefix + 8 digits (e.g. PO prefix acoustic/open-pore line).
    // Must come after all specific two-letter prefix handlers (CA/CI/CK/CC via C[A-Z], IC, AI, etc.)
    // so only genuinely unrecognized two-letter codes reach here.
    if (/^[A-Z]{2}\d{8}$/.test(normalized)) {
        return decodeModernTwoLetterFactoryLine(normalized);
    }
    // Modern 12-digit logistics/tracking format: YY + 10-digit sequence
    if (/^\d{12}$/.test(normalized)) {
        return decodeModern12DigitTracking(normalized);
    }
    // Modern format with 10 digits: YYMMXXXXXX (2004-era, 6-digit sequence)
    if (/^\d{10}$/.test(normalized)) {
        return decodeModern10Digit(normalized);
    }
    // Modern format with 9 digits: YYMMXXXXX (2005-present)
    if (/^\d{9}$/.test(normalized)) {
        return decodeModern9Digit(normalized);
    }
    // Late 1990s format with 8 digits: YYMMXXXX (1990-1999)
    if (/^9\d{7}$/.test(normalized)) {
        return decodeLate1990s8Digit(normalized);
    }
    // Modern numeric year/batch format: YY00XXXX
    if (/^\d{2}00\d{4}$/.test(normalized)) {
        return decodeModern8DigitYearBatch(normalized);
    }
    // Modern 2000s 8-digit year/sequence format with transposed zero: Y0 + sequence
    if (/^[1-9]0\d{6}$/.test(normalized)) {
        return decodeModern2000sTransposedZeroYearSequence(normalized);
    }
    // Modern 2000s format with omitted leading zero: YMMXXXXX
    if (/^[1-9]\d{7}$/.test(normalized) && isValidMonthDigits(normalized.substring(1, 3))) {
        return decodeModern2000sDroppedLeadingZero(normalized);
    }
    // Modern format with 8 digits: YYMMXXXX (2000-2004)
    if (/^\d{8}$/.test(normalized)) {
        return decodeModern8Digit(normalized);
    }
    // 1990s format: YMMXXXX (7 digits, single year digit)
    if (/^00\d{5}$/.test(normalized)) {
        return decodeYearSequence7Digit(normalized);
    }
    // 7-digit year-batch format: YY00XXX (e.g. 2000838 = year 20 + batch 00 + seq 838)
    // The "00" is a known Cort batch/annual code rather than a calendar month.
    // Restricted to year codes 00-30 to avoid capturing vintage serials (e.g. 9000895 = 1990 vintage).
    if (/^\d{2}00\d{3}$/.test(normalized) && parseInt(normalized.substring(0, 2), 10) <= 30) {
        return decodeModern7DigitYearBatch(normalized);
    }
    // Vintage 1990s 7-digit format: YYMMSSS (e.g. 9202539 = February 1992)
    if (/^9\d{6}$/.test(normalized) && isValidMonthDigits(normalized.substring(2, 4))) {
        return decodeVintage1990s7DigitYYMM(normalized);
    }
    // Early 1990s 7-digit format: YY + sequence, when YYMM is not valid
    if (/^9[0-5]\d{5}$/.test(normalized)) {
        return decodeEarly1990s7DigitYearSequence(normalized);
    }
    if (/^8\d{6}$/.test(normalized)) {
        return decode1980sKorean7Digit(normalized);
    }
    if (/^\d{7}$/.test(normalized)) {
        return decode1990s7Digit(normalized);
    }
    // Early 1980s 5-digit neck-plate numeric format
    if (/^\d{5}$/.test(normalized)) {
        return decodeEarly1980sFiveDigitNeckPlate(normalized);
    }
    // 6-digit format (older/ambiguous)
    if (/^\d{6}$/.test(normalized)) {
        return decode6Digit(normalized);
    }
    // Matt Guitar Murphy signature series: MGM + 3-4 digit production number (early 2000s Korea)
    if (/^MGM\d{3,4}$/.test(normalized)) {
        return decodeMGMSignatureSeries(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Cort serial number. The format was not recognized. Common formats include: YYMMXXXX (8 digits, 2000-2004), YYMMXXXXX (9 digits, 2005+), YY + 10-digit tracking codes, RYYXXXXX (R prefix year/sequence), YMMXXXX (7 digits, 1990s), or W.O. prefix (1970s-80s). Note: Pre-mid-1990s guitars often have randomly generated serial numbers.',
    };
}
// Modern two-letter factory/line prefix: C[A-Z] + YYMM + sequence
const CORT_THREE_LETTER_FACTORY_MAP = {
    CSA: { factory: 'PT Cort Indonesia, Surabaya', country: 'Indonesia' },
};
function decodeModernThreeLetterFactoryLine(serial) {
    const prefix = serial.substring(0, 3);
    const yearDigits = serial.substring(3, 5);
    const monthDigits = serial.substring(5, 7);
    const sequence = serial.substring(7);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    const knownFactory = CORT_THREE_LETTER_FACTORY_MAP[prefix];
    const factory = knownFactory ? knownFactory.factory : 'Cort modern factory/production line';
    const country = knownFactory ? knownFactory.country : 'Korea, Indonesia, or China';
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory,
        country,
        notes: `Modern Cort three-letter factory/line format interpreted as prefix + YYMM + sequence. Prefix ${prefix} indicates ${factory}. The digits ${yearDigits} indicate production year ${year}; ${monthDigits} indicates ${getMonthName(month)}. Production sequence: ${parseInt(sequence, 10)}. Cort serials identify production date more reliably than exact model name, so verify the model from the headstock, label, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-modern-three-letter-factory-line-yymm-sequence',
        patternLabel: 'Cort modern three-letter factory-line YYMM sequence',
        additionalContext: {
            title: 'Cort modern three-letter serial',
            summary: 'This serial matches a modern Cort three-letter factory/line format parsed as prefix, production year and month, and sequence.',
            highlights: [
                `Prefix ${prefix} indicates ${factory}.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials usually identify production date more reliably than exact model identity.',
                'The serial does not identify the specific Cort model name.',
                'Production location requires country-of-origin markings or other physical evidence.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
                'Contact Cort with photos if exact model confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Cort three-letter factory/line format parsed as prefix, production year and month, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>Prefix ${prefix} indicates ${factory}. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${getMonthName(month)}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production date more reliably than exact model identity.</li><li>The serial does not identify the specific Cort model name.</li><li>Confirm the model from headstock, label, or other physical markings.</li></ul>`,
    };
}
const CORT_TWO_LETTER_FACTORY_MAP = {
    CA: { factory: 'PT Cort Indonesia, Surabaya', country: 'Indonesia' },
    CI: { factory: 'PT Cort Indonesia', country: 'Indonesia' },
    CK: { factory: 'Cort Korea', country: 'South Korea' },
    CC: { factory: 'Cort China', country: 'China' },
    PO: { factory: 'Cor-Tek production line (open-pore / acoustic series)', country: 'Korea, Indonesia, or China' },
};
function decodeLAFactoryYYMM(serial) {
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);
    const month = monthNum >= 1 && monthNum <= 12 ? getMonthName(monthNum) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'Cor-tek LA factory line',
        country: 'South Korea',
        notes: `LA-prefix Cor-tek/Cort factory serial. LA identifies a specific production line within the Cor-tek facility. Year digits ${yearDigits} decode as ${year}. Month digits ${monthDigits} decode as ${month || 'the production month'}. Production sequence: ${sequenceNumber}. Cor-tek manufactures guitars for many brands under the Cort umbrella in Korea.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-la-factory-yymm-sequence',
        patternLabel: 'Cort LA-prefix factory YYMM sequence',
        additionalContext: {
            title: 'Cort LA-prefix Korea factory serial',
            summary: 'This serial uses the LA-prefix Cor-tek/Cort factory format: LA identifies a specific production line, followed by two-digit year, two-digit month, and production sequence.',
            highlights: [
                'LA identifies a Cor-tek/Cort production line within the Korea facility.',
                `Year digits ${yearDigits} decode as ${year}.`,
                month ? `Month digits ${monthDigits} decode as ${month}.` : `Month digits ${monthDigits} are the production month code.`,
                `Production sequence: unit ${sequenceNumber}.`,
            ],
            caveats: [
                'The serial identifies factory line and production date; the exact model must be confirmed from headstock markings and body specs.',
                'Cor-tek manufactures guitars for many brands — confirm the headstock logo to identify the brand.',
            ],
            verificationTips: [
                'Check the headstock logo to confirm the brand (Cort, Ibanez, Jackson, etc.).',
                'Check the back of the headstock or inside a label for a Made in Korea stamp.',
                `Compare the model, hardware, and construction against ${year} catalog specs for the confirmed brand.`,
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial uses the LA-prefix Cor-tek/Cort factory format. LA identifies a specific Cor-tek production line in Korea. The year, month, and sequential production number are encoded after the prefix.</p><h3>How This Pattern Is Typically Read</h3><p>Year digits ${yearDigits} decode as ${year}. Month digits ${monthDigits} decode as ${month || 'the production month'}. Production sequence: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock logo to confirm the brand.</li><li>Look for a Made in Korea stamp on the back of the headstock.</li><li>Compare the model against catalog specs for ${year}.</li></ul>`,
    };
}
function decodeModernTwoLetterFactoryLine(serial) {
    const prefix = serial.substring(0, 2);
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const isAnomalousMonth = month < 1 || month > 12;
    const knownFactory = CORT_TWO_LETTER_FACTORY_MAP[prefix];
    const factory = knownFactory ? knownFactory.factory : 'Cort modern factory/production line';
    const country = knownFactory ? knownFactory.country : 'Korea, Indonesia, or China';
    const monthDescription = isAnomalousMonth
        ? `production/batch code "${monthDigits}" (non-standard field — may be a line code, export batch marker, or production-schedule identifier rather than a calendar month)`
        : getMonthName(month);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        ...(isAnomalousMonth ? {} : { month: getMonthName(month) }),
        factory,
        country,
        notes: `Modern Cort two-letter factory/line format interpreted as prefix + YYMM + sequence. Prefix ${prefix} indicates ${factory}. The digits ${yearDigits} indicate production year ${year}; ${monthDigits} indicates ${monthDescription}. Production sequence: ${parseInt(sequence, 10)}. Cort serials identify production date more reliably than exact model name, so verify the model from the headstock, label, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-modern-two-letter-factory-line-yymm-sequence',
        patternLabel: 'Cort modern two-letter factory-line YYMM sequence',
        additionalContext: {
            title: 'Cort modern two-letter serial',
            summary: 'This serial matches a modern Cort two-letter factory/line format parsed as prefix, production year and month, and sequence.',
            highlights: [
                `Prefix ${prefix} is treated as an internal factory or production line code.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                isAnomalousMonth
                    ? `The digits ${monthDigits} are a non-standard production or batch code, not a calendar month.`
                    : `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials usually identify production date more reliably than exact model identity.',
                'The serial does not identify the specific Cort model name.',
                isAnomalousMonth
                    ? `The field "${monthDigits}" in the month position is a non-standard production or batch code.`
                    : 'Production location requires country-of-origin markings or other physical evidence.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
                'Contact Cort with photos if exact model confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Cort two-letter factory/line format parsed as prefix, production year and month, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>Prefix ${prefix} is treated as an internal factory or production line code. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} indicate ${monthDescription}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production date more reliably than exact model identity.</li><li>The serial does not identify the specific Cort model name.</li><li>Confirm the model from headstock, label, or other physical markings.</li></ul>`,
    };
}
// Single-letter China factory prefix: C + YYMM + sequence
// Month field may be an anomalous export/batch code (e.g. "50") rather than a calendar month.
function decodeChinaSingleLetterC(serial) {
    const yearDigits = serial.substring(1, 3);
    const monthDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const isAnomalousMonth = month < 1 || month > 12;
    const monthDescription = isAnomalousMonth
        ? `batch/export code "${monthDigits}" (a known anomaly on certain Cort China export runs, used as a special batch marker or mid-year production placeholder)`
        : getMonthName(month);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        ...(isAnomalousMonth ? {} : { month: getMonthName(month) }),
        factory: 'Cor-Tek factory, China',
        country: 'China',
        notes: `Modern Cort single-letter China factory format (C + YYMM + sequence). "C" indicates the Cor-Tek factory in China. The digits ${yearDigits} indicate production year ${year}. The digits ${monthDigits} indicate ${monthDescription}. Production sequence: ${parseInt(sequence, 10)}. Cort serials identify production date more reliably than exact model name; verify the model from the headstock, label, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-china-single-letter-c-yymm-sequence',
        patternLabel: 'Cort China single-letter C factory YYMM sequence',
        additionalContext: {
            title: 'Cort China factory serial (C prefix)',
            summary: 'This serial matches the modern Cort single-letter China factory format: C + production year (YY) + month/batch code (MM) + sequence.',
            highlights: [
                '"C" prefix identifies the Cor-Tek factory in China.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                isAnomalousMonth
                    ? `The digits ${monthDigits} are an anomalous batch/export code, not a calendar month — a known occurrence on certain Cort China export runs.`
                    : `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials identify production date more reliably than exact model identity.',
                'The serial does not identify the specific Cort model name.',
                isAnomalousMonth
                    ? 'The "month" field here is an anomalous export/batch code, not a standard calendar month.'
                    : 'Confirm the production month from the label or other documentation if precision is needed.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
                'Contact Cort with photos if exact model confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the modern Cort single-letter China factory format: C + YY + MM + sequence.</p><h3>How This Pattern Is Typically Read</h3><p>"C" identifies the Cor-Tek factory in China. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} indicate ${monthDescription}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials identify production date more reliably than exact model identity.</li>${isAnomalousMonth ? '<li>The "month" field is an anomalous export/batch code, not a standard calendar month.</li>' : ''}<li>Confirm the model from headstock, label, or other physical markings.</li></ul>`,
    };
}
// Modern alphanumeric factory/line prefix: 1A + YYMM + sequence
function decodeModernAlphaFactoryLine(serial) {
    const prefix = serial.substring(0, 2);
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Cort modern factory/production line',
        country: 'Korea, Indonesia, or China',
        notes: `Modern Cort alphanumeric format interpreted as factory/line prefix + YYMM + sequence. Prefix ${prefix} indicates an internal factory or production line code. The digits ${yearDigits} indicate production year ${year}; ${monthDigits} indicates ${getMonthName(month)}. Production sequence: ${parseInt(sequence, 10)}. Cort serials identify production date more reliably than exact model name, so verify the model from the headstock, label, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-modern-alphanumeric-factory-line-yymm-sequence',
        patternLabel: 'Cort modern alphanumeric factory-line YYMM sequence',
        additionalContext: {
            title: 'Cort modern alphanumeric serial',
            summary: 'This serial matches a modern Cort alphanumeric format parsed as factory/line prefix, production year and month, and sequence.',
            highlights: [
                `Prefix ${prefix} is treated as an internal factory or production line code.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials usually identify production date more reliably than exact model identity.',
                'The serial does not identify the specific Cort model name.',
                'Production location requires country-of-origin markings or other physical evidence.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
                'Contact Cort with photos if exact model confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Cort alphanumeric format parsed as factory/line prefix, production year and month, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>Prefix ${prefix} is treated as an internal factory or production line code. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${getMonthName(month)}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production date more reliably than exact model identity.</li><li>The serial does not identify the specific Cort model name.</li><li>Confirm the model from headstock, label, or other physical markings.</li></ul>`,
    };
}
// Indonesian AI prefix
function decodeIndonesiaAI(serial) {
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'PT. Cort Indonesia, Mojokerto',
        country: 'Indonesia',
        notes: `AI prefix indicates Indonesian Cor-Tek/Cort production. Parsed as AI + YYMM + sequence. Sequence: ${sequence}. Cort serials identify factory and production date, but not the exact model name; verify model from headstock, label, or other instrument markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-ai-indonesia-yymm-sequence',
        patternLabel: 'Cort AI Indonesia YYMM sequence',
        additionalContext: {
            title: 'Cort AI Indonesia serial',
            summary: 'This serial matches an Indonesian Cort/Cor-Tek AI-prefix format parsed as factory prefix plus YYMM production date and sequence.',
            highlights: [
                'AI indicates Indonesian Cort/Cor-Tek production.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits are production sequence ${sequence}.`,
            ],
            caveats: [
                'Cort serials usually identify factory and date, not the exact model name.',
                'Confirm the model from the headstock, soundhole label, neck heel, or other physical markings.',
            ],
            verificationTips: [
                'Compare the model features against Cort catalog specs for the decoded year.',
                'Check whether the label or headstock identifies Indonesia or Cor-Tek production.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an Indonesian Cort/Cor-Tek AI-prefix format parsed as factory prefix plus YYMM production date and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>AI indicates Indonesian Cort/Cor-Tek production. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${getMonthName(month)}. The remaining digits are production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify factory and date, not the exact model name.</li><li>Confirm the model from the headstock, soundhole label, neck heel, or other physical markings.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical factory/date decode, then verify the exact model from physical markings and catalog specs for the decoded year.</p>`,
    };
}
// Indonesian IIA factory prefix: IIA + YYMM + sequence
function decodeIndonesiaIIA(serial) {
    const yearDigits = serial.substring(3, 5);
    const monthDigits = serial.substring(5, 7);
    const sequence = serial.substring(7);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const isAnomalousMonth = month < 1 || month > 12;
    const monthDescription = isAnomalousMonth
        ? `batch/export code "${monthDigits}" (anomalous on certain Cort export runs)`
        : getMonthName(month);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        ...(isAnomalousMonth ? {} : { month: getMonthName(month) }),
        factory: 'PT Cort Indonesia (IIA facility)',
        country: 'Indonesia',
        notes: `IIA-prefix Indonesian Cort format (IIA + YYMM + sequence). The "I" prefix family identifies Indonesian Cor-Tek/Cort production facilities; "IIA" is the specific facility designation. The digits ${yearDigits} indicate production year ${year}. The digits ${monthDigits} indicate ${monthDescription}. Production sequence: ${parseInt(sequence, 10)}. Cort serials identify production date and factory; verify the model from the headstock, soundhole label, neck heel, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-iia-indonesia-yymm-sequence',
        patternLabel: 'Cort IIA Indonesia YYMM sequence',
        additionalContext: {
            title: 'Cort IIA Indonesia serial',
            summary: 'This serial matches an Indonesian Cort/Cor-Tek IIA-prefix format parsed as factory prefix plus YYMM production date and sequence.',
            highlights: [
                'IIA identifies an Indonesian Cor-Tek/Cort production facility.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                isAnomalousMonth
                    ? `The digits ${monthDigits} are an anomalous batch/export code, not a calendar month.`
                    : `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials identify production date and factory more reliably than exact model identity.',
                'The serial does not identify the specific Cort model name.',
                ...(isAnomalousMonth ? ['The month field here is an anomalous export/batch code, not a standard calendar month.'] : []),
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Look for "Made in Indonesia" or PT Cort Indonesia markings near the serial.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an Indonesian Cort/Cor-Tek IIA-prefix format parsed as factory prefix plus YYMM production date and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>IIA identifies an Indonesian Cor-Tek/Cort facility. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} indicate ${monthDescription}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials identify production date and factory more reliably than exact model identity.</li>${isAnomalousMonth ? '<li>The month field is an anomalous export/batch code, not a standard calendar month.</li>' : ''}<li>Confirm the model from headstock, label, or other physical markings.</li></ul>`,
    };
}
// Indonesian IA prefix (Indonesia factory line A, PT Cort Indonesia Surabaya)
function decodeIndonesiaIA(serial) {
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'PT Cort Indonesia, Surabaya (factory line A)',
        country: 'Indonesia',
        notes: `IA prefix indicates Indonesian Cor-Tek/Cort production. "I" identifies Indonesia; "A" designates the specific factory line or production team inside the Surabaya facility. Parsed as IA + YYMM + sequence. Year: ${year}, month: ${getMonthName(month)}, sequence: ${parseInt(sequence, 10)}. This format is also shared by OEM contract instruments (Ibanez, Squier) built in the same facility. Verify the model from the headstock, label, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-ia-indonesia-yymm-sequence',
        patternLabel: 'Cort IA Indonesia YYMM sequence',
        additionalContext: {
            title: 'Cort IA Indonesia serial',
            summary: 'This serial matches an Indonesian Cort/Cor-Tek IA-prefix format where I identifies Indonesia and A identifies the factory line, parsed as IA + YYMM production date and sequence.',
            highlights: [
                '"I" identifies Indonesia as the country of manufacture.',
                '"A" identifies the specific factory line or production team at PT Cort Indonesia, Surabaya.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits are production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials usually identify factory and date, not the exact model name.',
                'This format is shared by OEM contract instruments (Ibanez, Squier, and others) built in the same Surabaya facility.',
                'Confirm the model from the headstock, soundhole label, neck heel, or other physical markings.',
            ],
            verificationTips: [
                'Check the headstock logo to determine whether the instrument is Cort-branded or an OEM brand.',
                'Look for Made in Indonesia or PT Cort Indonesia markings near the serial.',
                'Compare the model features against Cort catalog specs for the decoded year.',
                'Contact Cort with photos if exact model or factory line confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an Indonesian Cort/Cor-Tek IA-prefix format where I identifies Indonesia and A identifies the factory line.</p><h3>How This Pattern Is Typically Read</h3><p>"I" identifies Indonesia. "A" identifies the specific factory line or production team at PT Cort Indonesia, Surabaya. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${getMonthName(month)}. The remaining digits are production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify factory and date, not the exact model name.</li><li>This format is shared by OEM contract instruments built in the same facility.</li><li>Confirm the model from the headstock, soundhole label, neck heel, or other physical markings.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical factory/date decode, then verify the exact model from physical markings and catalog specs for the decoded year.</p>`,
    };
}
// W.O./W0 prefix - vintage Korean production
function decodeWOPrefix(serial) {
    const match = serial.match(/^W(?:\.?O\.?|0)\s*(\d+)/i);
    const numericPart = match ? match[1] : '';
    const prefix = serial.match(/^W(?:\.?O\.?|0)/i)?.[0].toUpperCase() ?? 'W.O.';
    const sequenceNumber = numericPart ? parseInt(numericPart, 10) : undefined;
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: '1984-1989 (estimated)',
        factory: 'Cort / Cor-Tek Korea',
        country: 'South Korea',
        notes: `Vintage ${prefix} prefix Cort format associated with South Korean Cor-Tek production in the mid-to-late 1980s. The remaining digits are best treated as a batch or production sequence${sequenceNumber !== undefined ? ` (${sequenceNumber})` : ''}, not a month/day date code. This format helps verify era and origin, but it does not identify the exact model name.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-vintage-wo-w0-korea-sequence',
        patternLabel: 'Cort vintage W.O./W0 Korea sequence',
        additionalContext: {
            title: 'Cort vintage W.O./W0 serial',
            summary: 'This serial matches a vintage Cort W.O./W0-prefix format associated with Korean Cor-Tek production.',
            highlights: [
                `${prefix} is treated as a vintage Cort/Cor-Tek prefix rather than a modern date code.`,
                'The era is estimated as 1984-1989.',
                sequenceNumber !== undefined
                    ? `The digits after the prefix are treated as production sequence ${sequenceNumber}.`
                    : 'The digits after the prefix are treated as a production or batch sequence.',
            ],
            caveats: [
                'The sequence is not a reliable exact month or day code.',
                'This format verifies vintage Korean-era production more reliably than exact model identity.',
                'Exact model identification requires physical markings and catalog comparison.',
            ],
            verificationTips: [
                'Check for a silver or paper foil sticker on the back of the headstock or a stamped neck plate.',
                'Compare the headstock logo and body style against Cort Performer, Effector, and other mid-to-late 1980s Cort catalog models.',
                'Use country-of-origin markings and hardware details to help confirm the model.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a vintage Cort W.O./W0-prefix format associated with Korean Cor-Tek production.</p><h3>How This Pattern Is Typically Read</h3><p>${prefix} is treated as a vintage Cort/Cor-Tek prefix rather than a modern date code. The era is estimated as 1984-1989. The digits after the prefix are treated as a production or batch sequence${sequenceNumber !== undefined ? ` (${sequenceNumber})` : ''}.</p><h3>What To Verify</h3><ul><li>The sequence is not a reliable exact month or day code.</li><li>This format verifies vintage Korean-era production more reliably than exact model identity.</li><li>Check the headstock logo, sticker or neck plate, country markings, and catalog features to narrow the exact model.</li></ul>`,
    };
}
// Indonesian ICS prefix (Factory Special Run)
function decodeIndonesiaICS(serial) {
    const yearDigits = serial.substring(3, 5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(5);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'PT. Cort Indonesia, Surabaya',
        country: 'Indonesia',
        notes: `ICS prefix indicates Indonesian Cor-Tek factory production. The "S" typically designates a Factory Special Run (FSR) model. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Indonesian ICSE prefix (IC + SE production line/series marker)
function decodeIndonesiaICSE(serial) {
    const yearDigits = serial.substring(4, 6);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(6);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'PT. Cort Indonesia, Surabaya',
        country: 'Indonesia',
        model: 'Cort/Cor-Tek SE production line or series',
        notes: `ICSE prefix indicates Indonesian Cor-Tek/Cort production. Parsed as IC + SE production line/series marker + YY + sequence. The "SE" portion likely identifies a production line, series, or internal run marker rather than the exact model name. Sequence: ${sequence}. Cort serials identify factory and production year, but not the exact model name; verify model from the headstock, truss rod cover, label, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-icse-indonesia-yy-sequence',
        patternLabel: 'Cort ICSE Indonesia YY sequence',
        additionalContext: {
            title: 'Cort ICSE Indonesia serial',
            summary: 'This serial matches a modern Indonesian Cort/Cor-Tek ICSE-prefix format parsed as factory prefix plus production-line marker, year, and sequence.',
            highlights: [
                'IC indicates Indonesian Cor-Tek/Cort production.',
                'SE is treated as a production line, series, or internal run marker.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits are production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials usually identify factory and date more reliably than exact model identity.',
                'The SE marker does not by itself confirm the exact model name.',
                'Confirm the model from headstock, label, truss rod cover, or other physical markings.',
            ],
            verificationTips: [
                'Check whether the instrument is Cort-branded or another brand built by Cor-Tek.',
                'Compare the instrument against Cort catalog specs for the decoded year.',
                'Contact Cort or an authorized dealer with photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Indonesian Cort/Cor-Tek ICSE-prefix format parsed as factory prefix plus production-line marker, year, and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>IC indicates Indonesian Cor-Tek/Cort production. SE is treated as a production line, series, or internal run marker. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify factory and date more reliably than exact model identity.</li><li>The SE marker does not by itself confirm the exact model name.</li><li>Confirm the model from headstock, label, truss rod cover, or other physical markings.</li></ul>`,
    };
}
// Indonesian IC prefix
function decodeIndonesiaIC(serial) {
    const yearDigits = serial.substring(2, 4);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(4);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'PT. Cort Indonesia, Surabaya',
        country: 'Indonesia',
        notes: `IC prefix indicates Indonesian Cor-Tek factory production. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Indonesian ICF prefix (Fender branded)
function decodeIndonesiaICF(serial) {
    const yearDigits = serial.substring(3, 5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(5);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'PT. Cort Indonesia, Surabaya',
        country: 'Indonesia',
        notes: `ICF prefix indicates Indonesian Cor-Tek factory production. The "F" typically indicates this was a Fender-branded instrument manufactured by Cort. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
function decodeRPrefixYearSequence(serial) {
    const yearDigits = serial.substring(1, 3);
    const sequence = serial.substring(3);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cor-Tek/Cort R-prefix production line or factory',
        country: 'Korea, Indonesia, or China',
        notes: `R-prefix Cort/Cor-Tek format interpreted as R + YY + sequence. The digits ${yearDigits} indicate production year ${year}; the remaining digits are production sequence ${parseInt(sequence, 10)}. Cort serials identify production year more reliably than exact model name; verify the model from the headstock, soundhole label, neck heel, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-r-prefix-yy-sequence',
        patternLabel: 'Cort R-prefix YY sequence',
        additionalContext: {
            title: 'Cort R-prefix serial',
            summary: 'This serial matches a Cort/Cor-Tek R-prefix format where the letter prefix is followed by a two-digit production year and sequence.',
            highlights: [
                'R is treated as a Cort/Cor-Tek factory, production line, or internal prefix.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'The serial does not identify the exact Cort model name.',
                'The R prefix alone is not enough to confirm the exact factory location.',
                'Physical country-of-origin markings remain the best confirmation for factory/country.',
            ],
            verificationTips: [
                'Check the headstock, back of headstock, neck heel, or soundhole label for the model name.',
                'Look for Made in Indonesia, Korea, China, or other country-of-origin markings near the serial.',
                'Compare body shape, bridge, electronics, and trim against Cort catalog specs for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Cort/Cor-Tek R-prefix format where the letter prefix is followed by a two-digit production year and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>R is treated as a Cort/Cor-Tek factory, production line, or internal prefix. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>The serial does not identify the exact Cort model name.</li><li>The R prefix alone is not enough to confirm the exact factory location.</li><li>Check the headstock, soundhole label, neck heel, or other physical markings for model and country-of-origin details.</li></ul>`,
    };
}
function decodeIndonesiaFPrefix(serial) {
    const yearDigits = serial.substring(1, 3);
    const sequence = serial.substring(3);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'PT. Cort Indonesia',
        country: 'Indonesia',
        notes: `F prefix indicates Indonesian Cort/Cor-Tek facility production (F + YY + sequence). The digits ${yearDigits} decode as production year ${year}. Production sequence: ${sequence}. Cort serials identify production year and factory more reliably than exact model name; verify the model from the headstock, soundhole label, or neck heel.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-indonesia-f-prefix-yy-sequence',
        patternLabel: 'Cort Indonesia F-prefix YY sequence',
    };
}
// Indonesian IE prefix
function decodeIndonesiaIE(serial) {
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: month >= 1 && month <= 12 ? getMonthName(month) : undefined,
        factory: 'PT. Cort Indonesia, Surabaya',
        country: 'Indonesia',
        notes: `IE prefix indicates Indonesian Cor-Tek factory production. Parsed as IE + YYMM + sequence. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Indonesian single I prefix: I + YYMMXXXXX (e.g. I250804919 = Indonesia, 2025, August, seq 04919)
function decodeIndonesiaSingleI(serial) {
    const yearDigits = serial.substring(1, 3);
    const monthDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const isAnomalousMonth = month < 1 || month > 12;
    const monthDescription = isAnomalousMonth
        ? `batch/export code "${monthDigits}" (a known anomaly on certain Cort Indonesia export runs)`
        : getMonthName(month);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        ...(isAnomalousMonth ? {} : { month: getMonthName(month) }),
        factory: 'PT Cort Indonesia',
        country: 'Indonesia',
        notes: `Cort Indonesia single-letter I format (I + YYMMXXXXX). "I" identifies the Indonesian Cor-Tek/Cort facility. The digits ${yearDigits} indicate production year ${year}. The digits ${monthDigits} indicate ${monthDescription}. Production sequence: ${parseInt(sequence, 10)}. Cort serials identify production date and factory more reliably than exact model name; verify the model from the headstock, soundhole label, neck heel, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-indonesia-single-i-yymm-sequence',
        patternLabel: 'Cort Indonesia single-letter I YYMM sequence',
        additionalContext: {
            title: 'Cort Indonesia single-letter I serial',
            summary: 'This serial matches the Cort Indonesia single-letter I format: I + production year (YY) + month (MM) + sequence.',
            highlights: [
                '"I" prefix identifies the Indonesian Cor-Tek/Cort production facility.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                isAnomalousMonth
                    ? `The digits ${monthDigits} are an anomalous batch/export code, not a calendar month.`
                    : `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials identify production date and factory more reliably than exact model identity.',
                'The serial does not identify the specific Cort model name.',
                isAnomalousMonth ? 'The "month" field here is an anomalous export/batch code, not a standard calendar month.' : '',
            ].filter(Boolean),
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Look for "Made in Indonesia" or PT Cort Indonesia markings near the serial.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Cort Indonesia single-letter I format: I + YY + MM + sequence.</p><h3>How This Pattern Is Typically Read</h3><p>"I" identifies the Indonesian Cor-Tek/Cort facility. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} indicate ${monthDescription}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials identify production date and factory more reliably than exact model identity.</li>${isAnomalousMonth ? '<li>The "month" field is an anomalous export/batch code, not a standard calendar month.</li>' : ''}<li>Confirm the model from headstock, label, or other physical markings.</li></ul>`,
    };
}
// Chinese COS prefix
function decodeIndonesiaISProductLine(serial) {
    // IS = Indonesia + S sub-factory, followed by 1-2 letter product/line code, then YY + sequence
    const prefixMatch = serial.match(/^(IS[A-Z]{1,2})(\d{2})(\d+)$/);
    if (!prefixMatch) {
        return { success: false, error: 'Unable to parse Cort IS product-line serial format.' };
    }
    const prefix = prefixMatch[1];
    const yearDigits = prefixMatch[2];
    const sequence = prefixMatch[3];
    const year = 2000 + parseInt(yearDigits, 10);
    const lineCode = prefix.substring(2);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: `PT Cort Indonesia, S factory (${lineCode} product/contract line)`,
        country: 'Indonesia',
        notes: `Cort Indonesia IS product-line format. "I" identifies Indonesia; "S" identifies the factory sub-line or partner facility; "${lineCode}" is the product or contract line code; ${yearDigits} indicates ${year}; ${sequence} is the production sequence (${sequenceNumber}). This format is used on Cort-branded and OEM-contract instruments from the Indonesian facility. Verify the exact model from the headstock, soundhole label, or back-of-headstock country marking.`,
    };
    return {
        success: true,
        info,
        patternKey: `cort-indonesia-is-product-line-yy-sequence`,
        patternLabel: `Cort Indonesia IS product-line format`,
        additionalContext: {
            title: 'Cort Indonesia IS product-line serial',
            summary: `This serial matches a Cort Indonesian factory format where IS identifies the Indonesia S factory line, the following letters indicate a product or contract line, and the digits encode year and sequence.`,
            highlights: [
                '"I" identifies Indonesia as the country of manufacture.',
                `"S" identifies the factory sub-line or partner facility; "${lineCode}" is the product or contract line code.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'Cort serials identify production date and factory more reliably than exact model name.',
                'The serial does not identify the specific Cort model name.',
                'OEM production for other brands (Ibanez, Squier, PRS) may share this factory format.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, or neck heel for the model name and Made in Indonesia marking.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
                'Contact Cort support with photos if exact model confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Cort Indonesian factory format where IS identifies the Indonesia S factory line, the following letters indicate a product or contract line, and the digits encode year and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>"I" identifies Indonesia. "S" identifies the factory sub-line or partner facility; "${lineCode}" is the product or contract line code. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Cort serials identify production date and factory more reliably than exact model name.</li><li>Check the headstock, soundhole label, or back-of-headstock marking for the model name and Made in Indonesia stamp.</li><li>Contact Cort support with photos if exact model confirmation is needed.</li></ul>`,
    };
}
function decodeChinaCOS(serial) {
    const yearDigits = serial.substring(3, 5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(5);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort China (Cor-Tek)',
        country: 'China',
        notes: `COS prefix indicates Chinese Cor-Tek factory production. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Chinese COB prefix
function decodeChinaCOB(serial) {
    const yearDigits = serial.substring(3, 5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequence = serial.substring(5);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort China (Cor-Tek)',
        country: 'China',
        notes: `COB prefix indicates Chinese Cor-Tek factory production. Sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// 7-digit year-batch format: YY00XXX (no calendar month)
function decodeModern7DigitYearBatch(serial) {
    const yearDigits = serial.substring(0, 2);
    const batchDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort (location varies - Korea, Indonesia, or China)',
        country: 'Korea, Indonesia, or China',
        notes: `7-digit Cort numeric format interpreted as YY + batch/production code + 3-digit sequence. The digits ${yearDigits} indicate production year ${year}. The digits ${batchDigits} are treated as a batch or internal code rather than a calendar month (a known pattern on certain Cort production runs). Production sequence: ${sequenceNumber}. Cort serials generally do not encode the exact model name, so verify model and factory from the headstock, label, or country-of-origin markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-modern-7-digit-year-batch-sequence',
        patternLabel: 'Cort modern 7-digit year/batch sequence format',
        additionalContext: {
            title: 'Cort modern 7-digit numeric serial',
            summary: 'This serial matches a Cort 7-digit numeric format where the first two digits identify the production year and the next two digits are a batch or internal code rather than a calendar month.',
            highlights: [
                `The first two digits decode as production year ${year}.`,
                `The digits ${batchDigits} are treated as a batch or internal production code, not a valid calendar month.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'Cort serials usually identify production date or batch more reliably than exact model identity.',
                'The serial does not identify the specific model name.',
                'Production location requires country-of-origin markings or other physical evidence.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
                'Contact Cort or an authorized dealer with photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Cort 7-digit numeric format where the first two digits identify the production year and the next two are a batch or internal code.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits decode as production year ${year}. The digits ${batchDigits} are treated as a batch or internal production code, not a valid calendar month. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production date or batch more reliably than exact model identity.</li><li>The serial does not identify the specific model name.</li><li>Production location requires country-of-origin markings or other physical evidence.</li></ul>`,
    };
}
// Modern 9-digit format: YYMMXXXXX (2005-present)
function decodeModern9Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const isAnomalousMonth = month < 1 || month > 12;
    const monthDescription = isAnomalousMonth
        ? `batch/export code "${monthDigits}" (a known anomaly on certain Cort export runs, used as a special batch marker or production placeholder)`
        : getMonthName(month);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        ...(isAnomalousMonth ? {} : { month: getMonthName(month) }),
        factory: 'Cort (location varies - Korea, Indonesia, or China)',
        country: 'Korea, Indonesia, or China',
        notes: `Modern 9-digit format (YYMMXXXXX) used since 2005. The digits ${yearDigits} indicate ${year}; ${monthDigits} indicates ${monthDescription}. Production sequence: ${parseInt(sequence, 10)}. Exact factory location requires additional identification from the instrument.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-modern-9-digit-yymm-sequence',
        patternLabel: 'Cort modern 9-digit YYMM sequence',
        additionalContext: {
            title: 'Cort modern 9-digit serial',
            summary: 'This serial matches a modern Cort numeric format where the first four digits identify production year and month.',
            highlights: [
                `The digits ${yearDigits} decode as production year ${year}.`,
                isAnomalousMonth
                    ? `The digits ${monthDigits} are an anomalous batch/export code, not a calendar month — a known occurrence on certain Cort export runs.`
                    : `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials usually identify production date more reliably than exact model identity.',
                'The serial does not identify the specific Cort model name.',
                ...(isAnomalousMonth ? ['The month field here is an anomalous export/batch code, not a standard calendar month.'] : []),
                'Production location requires country-of-origin markings or other physical evidence.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Cort numeric format where the first four digits identify production year and month.</p><h3>How This Pattern Is Typically Read</h3><p>The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} indicate ${monthDescription}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production date more reliably than exact model identity.</li>${isAnomalousMonth ? '<li>The month field is an anomalous export/batch code, not a standard calendar month.</li>' : ''}<li>The serial does not identify the specific Cort model name.</li><li>Production location requires country-of-origin markings or other physical evidence.</li></ul>`,
    };
}
// Modern 10-digit format: YYMMXXXXXX (2004-era, 6-digit production sequence)
function decodeModern10Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const isAnomalousMonth = month < 1 || month > 12;
    const monthDescription = isAnomalousMonth
        ? `batch/export code "${monthDigits}" (a known anomaly on certain Cort export runs, used as a special batch marker or production placeholder)`
        : getMonthName(month);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        ...(isAnomalousMonth ? {} : { month: getMonthName(month) }),
        factory: 'Cort (location varies - Korea, Indonesia, or China)',
        country: 'Korea, Indonesia, or China',
        notes: `Modern 10-digit format (YYMMXXXXXX) used in the 2004 era. The digits ${yearDigits} indicate ${year}; ${monthDigits} indicates ${monthDescription}. Production sequence: ${parseInt(sequence, 10)}. According to the official Cort FAQ, this YYMMXXXXX+ format encodes only production date and sequence, not model or factory location. Verify the model from the headstock, soundhole label, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-modern-10-digit-yymm-sequence',
        patternLabel: 'Cort modern 10-digit YYMM sequence',
        additionalContext: {
            title: 'Cort modern 10-digit serial',
            summary: 'This serial matches a modern Cort numeric format where the first four digits identify production year and month, followed by a 6-digit production sequence.',
            highlights: [
                `The digits ${yearDigits} decode as production year ${year}.`,
                isAnomalousMonth
                    ? `The digits ${monthDigits} are an anomalous batch/export code, not a calendar month — a known occurrence on certain Cort export runs.`
                    : `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining six digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials usually identify production date more reliably than exact model identity.',
                'The serial does not identify the specific Cort model name.',
                ...(isAnomalousMonth ? ['The month field here is an anomalous export/batch code, not a standard calendar month.'] : []),
                'Production location requires country-of-origin markings or other physical evidence.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Cort numeric format where the first four digits identify production year and month, followed by a 6-digit production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} indicate ${monthDescription}. The remaining six digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production date more reliably than exact model identity.</li>${isAnomalousMonth ? '<li>The month field is an anomalous export/batch code, not a standard calendar month.</li>' : ''}<li>The serial does not identify the specific Cort model name.</li><li>Production location requires country-of-origin markings or other physical evidence.</li></ul>`,
    };
}
// Modern 12-digit tracking/logistics format: YY + 10-digit sequence
function decodeModern12DigitTracking(serial) {
    const yearDigits = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort (location varies - Korea, Indonesia, or China)',
        country: 'Korea, Indonesia, or China',
        notes: `Modern 12-digit Cort tracking format interpreted as YY + 10-digit logistics or manufacturing sequence. The first two digits (${yearDigits}) indicate production year ${year}. Tracking/batch sequence: ${sequence}. This format may appear on barcode labels, soundhole labels, box stickers, or factory inventory labels rather than as a traditional stamped headstock serial.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-modern-12-digit-year-tracking-sequence',
        patternLabel: 'Cort modern 12-digit year/tracking sequence',
        additionalContext: {
            title: 'Cort modern 12-digit tracking serial',
            summary: 'This serial matches a modern Cort 12-digit tracking format where the first two digits identify production year and the remaining digits are a logistics or manufacturing sequence.',
            highlights: [
                `The first two digits decode as production year ${year}.`,
                `The remaining ten digits decode as tracking or batch sequence ${sequence}.`,
            ],
            caveats: [
                'Cort serials usually identify production date more reliably than exact model identity.',
                'This format may be tied to barcode, warehouse, or factory tracking labels.',
                'Production location requires country-of-origin markings or other physical evidence.',
            ],
            verificationTips: [
                'Check whether the number appears on a paper soundhole label, barcode label, box sticker, or headstock marking.',
                'Use the headstock, soundhole label, neck heel, and country markings to confirm the model and factory.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Cort 12-digit tracking format where the first two digits identify production year and the remaining digits are a logistics or manufacturing sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The remaining ten digits decode as tracking or batch sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production date more reliably than exact model identity.</li><li>This format may be tied to barcode, warehouse, or factory tracking labels.</li><li>Production location requires country-of-origin markings or other physical evidence.</li></ul>`,
    };
}
// Late 1990s 8-digit format: YYMMXXXX (1990-1999)
function decodeLate1990s8Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 1900 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Cort Korea (Incheon or Daejeon)',
        country: 'South Korea',
        notes: `Late-1990s Cort 8-digit numeric format. The first two digits (${yearDigits}) indicate production year ${year}; the next two digits (${monthDigits}) indicate ${getMonthName(month)}; the remaining digits are production sequence ${parseInt(sequence, 10)}. Cort serials identify production date more reliably than exact model, so verify the model from the headstock, label, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-late-1990s-8-digit-yymm-sequence',
        patternLabel: 'Cort late-1990s 8-digit YYMM sequence',
        additionalContext: {
            title: 'Cort late-1990s 8-digit serial',
            summary: 'This serial matches a late-1990s Cort numeric format where the first four digits identify production year and month.',
            highlights: [
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials usually identify production date more reliably than exact model identity.',
                'Factory attribution for late-1990s examples is commonly Korean, but physical country-of-origin markings remain the best confirmation.',
                'Model identification still requires the headstock, label, or other instrument markings.',
            ],
            verificationTips: [
                'Look for Made in Korea markings on the headstock, neck plate, or label.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a late-1990s Cort numeric format where the first four digits identify production year and month.</p><h3>How This Pattern Is Typically Read</h3><p>The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${getMonthName(month)}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production date more reliably than exact model identity.</li><li>Factory attribution for late-1990s examples is commonly Korean, but physical country-of-origin markings remain the best confirmation.</li><li>Model identification still requires the headstock, label, or other instrument markings.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical late-1990s Cort date decode, then verify the exact model from physical markings and catalog specs.</p>`,
    };
}
// Modern 8-digit year/batch format: YY00XXXX
function decodeModern8DigitYearBatch(serial) {
    const yearDigits = serial.substring(0, 2);
    const batchDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort (location varies - Korea, Indonesia, or China)',
        country: 'Korea, Indonesia, or China',
        notes: `Modern 8-digit numeric Cort format interpreted as YY + batch/code + sequence. The first two digits (${yearDigits}) indicate production year ${year}. The next two digits (${batchDigits}) are treated as a batch or internal code rather than a calendar month. Production sequence: ${parseInt(sequence, 10)}. Cort serials generally do not encode the exact model name, so verify model and factory from the headstock, label, or country-of-origin markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-modern-8-digit-year-batch-sequence',
        patternLabel: 'Cort modern 8-digit year/batch sequence format',
        additionalContext: {
            title: 'Cort modern numeric serial',
            summary: 'This serial matches a modern Cort 8-digit numeric format where the first two digits identify the production year and 00 is treated as a batch/internal code.',
            highlights: [
                `The first two digits decode as production year ${year}.`,
                `The digits ${batchDigits} are treated as a batch or internal code, not a valid calendar month.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials usually identify production date or batch more reliably than exact model identity.',
                'The serial does not identify the specific model name.',
                'Production location requires country-of-origin markings or other physical evidence.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
                'Contact Cort or an authorized dealer with photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern Cort 8-digit numeric format where the first two digits identify the production year and 00 is treated as a batch/internal code.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits decode as production year ${year}. The digits ${batchDigits} are treated as a batch or internal code, not a valid calendar month. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production date or batch more reliably than exact model identity.</li><li>The serial does not identify the specific model name.</li><li>Production location requires country-of-origin markings or other physical evidence.</li></ul>`,
    };
}
// Modern 8-digit format: YYMMXXXX (2000-2004)
function decodeModern8Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    // Validate month
    if (month < 1 || month > 12) {
        return {
            success: false,
            error: `Invalid month "${monthDigits}" in serial number. Month should be 01-12.`,
        };
    }
    // Flag serials that decode to an impossible future year
    if (year > new Date().getFullYear() + 5) {
        return decodeModern8DigitSuspiciousFutureYear(serial, yearDigits, monthDigits, sequence, year, month);
    }
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Cort (location varies - Korea or Indonesia)',
        country: 'Korea or Indonesia',
        notes: `Modern 8-digit format (YYMMXXXX) used 2000-2004. Production sequence: ${sequence}. Exact factory location requires additional identification from the instrument.`,
    };
    return { success: true, info };
}
function decodeModern8DigitSuspiciousFutureYear(serial, yearDigits, monthDigits, sequence, year, month) {
    const monthName = getMonthName(month);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: `${year} (impossible — strongly suggests counterfeit, factory second, or padded serial)`,
        month: monthName,
        factory: 'Unknown — origin not determinable from this serial',
        country: 'Unknown',
        notes: `This 8-digit serial parses as YYMMXXXX → year ${year}, ${monthName}, production sequence ${sequenceNumber}. A year of ${year} is impossibly far in the future for any genuine instrument. The most likely explanations are: (1) the serial is from a counterfeit or factory-second instrument stamped with a random or recycled number; (2) the number was padded from a genuine mid-1990s single-digit-year Cort serial — in the 1990s some Cort guitars used a single leading year digit (e.g. "5" = 1995), and counterfeit or misattributed stamps sometimes pad these to 8 digits, accidentally producing an impossible year marker; (3) an overseas unlicensed factory applied a fixed or arbitrary numeric stamp. Genuine Cort guitars built since 2000 use YYMMXXXX where YY is the two-digit year (e.g. 24 = 2024), and factory-letter prefixes (IC, AI, IE, CA, etc.) are common on Indonesian and Korean production runs.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-8digit-suspicious-future-year',
        patternLabel: 'Cort 8-digit serial with impossible future year',
        additionalContext: {
            title: 'Suspicious Cort serial — impossible future year',
            summary: `This serial parses under the standard Cort YYMMXXXX format but decodes to the year ${year}, which is impossibly in the future. This is a strong indicator of a counterfeit, factory second, or padded/misattributed serial.`,
            highlights: [
                `The digits ${yearDigits} decode as production year ${year} under the YYMMXXXX format — an impossible date.`,
                `The digits ${monthDigits} decode as ${monthName} and production sequence is ${sequenceNumber}.`,
                'Genuine Cort guitars since 2000 use two-digit years in the range 00–current (e.g. 24 = 2024).',
                'Counterfeit stamps sometimes pad 1990s single-digit-year serials (e.g. "5" = 1995) to 8 digits, accidentally creating an impossible year.',
            ],
            caveats: [
                'This serial cannot correspond to a genuine Cort instrument manufactured in a real calendar year.',
                'The production sequence and month fields are structurally valid but cannot be trusted on a suspicious serial.',
                'Physical inspection and model verification are essential before any purchase or valuation decision.',
            ],
            verificationTips: [
                'Inspect the headstock logo: genuine Cort logos transitioned to a sharp modern sans-serif block font around 2000; earlier guitars used a stylized cursive font.',
                'Look for a factory-letter prefix: genuine Indonesian and Korean Cort production runs typically include a letter prefix (IC, AI, IE, CA, etc.) before the number.',
                'Check the neck pocket and pickup cavities for raw wood production stamps or date codes from the build era.',
                'Compare hardware, neck profile, fret work, and finish quality against known genuine Cort production from the model year claimed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial parses under the standard Cort YYMMXXXX 8-digit format but decodes to the year <strong>${year}</strong> — an impossible future date. This is a strong indicator of a counterfeit, factory second, or padded/misattributed serial.</p><h3>How This Pattern Decodes</h3><p>The digits <strong>${yearDigits}</strong> decode as production year ${year}. The digits <strong>${monthDigits}</strong> decode as ${monthName}. The remaining digits decode as production sequence ${sequenceNumber}. All fields are structurally valid, but the year is impossible.</p><h3>Most Likely Explanations</h3><ul><li><strong>Counterfeit stamp:</strong> Unlicensed factories frequently apply fixed or random 8-digit strings without accurate knowledge of Cort's serial conventions.</li><li><strong>Padded 1990s serial:</strong> In the mid-1990s, some Cort guitars used a single-digit leading year (e.g. "5" = 1995). Counterfeit or misattributed stamps sometimes pad these to 8 digits, accidentally producing an impossible year marker like "52".</li><li><strong>Factory second or mismatched neck:</strong> Instruments assembled from rejected or surplus parts may carry non-standard stamps.</li></ul><h3>How To Verify</h3><ul><li>Inspect the headstock logo: genuine Cort logos transitioned to a sharp sans-serif block font around 2000.</li><li>Look for factory-letter prefixes (IC, AI, IE, CA) common on genuine Indonesian and Korean runs.</li><li>Check the neck pocket and pickup cavities for raw wood production stamps matching the claimed era.</li><li>Compare build quality, hardware, and specs against known genuine Cort production.</li></ul>`,
    };
}
// Modern 2000s 8-digit year/sequence format: Y0 + sequence (e.g. 70514001 = 2007 + 514001)
function decodeModern2000sTransposedZeroYearSequence(serial) {
    const yearDigits = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const year = 2000 + parseInt(serial[0], 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort (location varies - Korea, Indonesia, or China)',
        country: 'Korea, Indonesia, or China',
        notes: `Modern Cort 8-digit numeric format interpreted as Y0 + sequence. The first two digits (${yearDigits}) indicate production year ${year}; the remaining digits are production sequence ${sequenceNumber}. Cort serials identify production year more reliably than exact model name, so verify the model from the headstock, label, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-modern-2000s-y0-year-sequence',
        patternLabel: 'Cort modern 2000s Y0 year sequence',
        additionalContext: {
            title: 'Cort modern 2000s year/sequence serial',
            summary: 'This serial matches a Cort 2000s numeric format where the first two digits identify the production year and the rest is a sequence.',
            highlights: [
                `The first two digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
                'The serial does not encode the exact model name.',
            ],
            caveats: [
                'Cort serials usually identify production year more reliably than exact model identity.',
                'Production location requires country-of-origin markings or other physical evidence.',
                'Model identification requires the headstock, label, or other physical markings.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
                'Contact Cort with photos if exact model confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Cort 2000s numeric format where the first two digits identify the production year and the rest is a sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production year more reliably than exact model identity.</li><li>The serial does not identify the specific Cort model name.</li><li>Confirm the model from headstock, label, or other physical markings.</li></ul>`,
    };
}
// Modern 2000s format with omitted leading zero: YMMXXXXX
function decodeModern2000sDroppedLeadingZero(serial) {
    const yearDigits = `0${serial.substring(0, 1)}`;
    const monthDigits = serial.substring(1, 3);
    const sequence = serial.substring(3);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Cort (location varies - Korea, Indonesia, or China)',
        country: 'Korea, Indonesia, or China',
        notes: `Modern Cort numeric format with omitted leading zero, interpreted as ${yearDigits}${monthDigits}${sequence}. The first digit is treated as the 2000s year (${year}), the next two digits (${monthDigits}) indicate ${getMonthName(month)}, and the remaining digits are production sequence ${parseInt(sequence, 10)}. Cort serials identify production date more reliably than exact model, so verify the model from the headstock, label, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-modern-2000s-dropped-leading-zero-yymm-sequence',
        patternLabel: 'Cort modern 2000s omitted-leading-zero YYMM sequence',
        additionalContext: {
            title: 'Cort modern 2000s numeric serial',
            summary: 'This serial matches a Cort 2000s numeric format where the leading zero of the two-digit year appears to be omitted.',
            highlights: [
                `The leading digit is read as ${yearDigits}, indicating production year ${year}.`,
                `The next two digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials usually identify production date more reliably than exact model identity.',
                'The serial does not identify the specific Cort model name.',
                'Production location requires country-of-origin markings or other physical evidence.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Compare the instrument against Cort catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Cort 2000s numeric format where the leading zero of the two-digit year appears to be omitted.</p><h3>How This Pattern Is Typically Read</h3><p>The leading digit is read as ${yearDigits}, indicating production year ${year}. The next two digits ${monthDigits} decode as ${getMonthName(month)}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials usually identify production date more reliably than exact model identity.</li><li>The serial does not identify the specific Cort model name.</li><li>Production location requires country-of-origin markings or other physical evidence.</li></ul>`,
    };
}
function decodeYearSequence7Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort (location varies - Korea or Indonesia)',
        country: 'Korea or Indonesia',
        notes: `Year-first 7-digit Cort format. The first two digits (${yearDigits}) indicate production year ${year}; the remaining digits are production sequence ${parseInt(sequence, 10)}. Cort serials do not identify the exact model name, so verify the model from the headstock or internal label.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-year-sequence-7-digit',
        patternLabel: 'Cort year-first 7-digit sequence',
        additionalContext: {
            title: 'Cort year-first 7-digit serial',
            summary: 'This serial matches a Cort year-first numeric format where the first two digits identify the production year and the remaining digits are a sequence.',
            highlights: [
                `The first two digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
                'The serial does not encode the exact model name.',
            ],
            caveats: [
                'Cort has used multiple numeric serial systems, especially around the 1990s and early 2000s.',
                'Model identification requires the headstock, label, or other physical markings.',
                'Production location may require country-of-origin markings on the instrument.',
            ],
            verificationTips: [
                'Check the headstock or soundhole label for the model name.',
                'Look for Made in Korea or Made in Indonesia markings to confirm production location.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Cort year-first numeric format where the first two digits identify the production year and the remaining digits are a sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}. The serial does not encode the exact model name.</p><h3>What To Verify</h3><ul><li>Cort has used multiple numeric serial systems, especially around the 1990s and early 2000s.</li><li>Model identification requires the headstock, label, or other physical markings.</li><li>Production location may require country-of-origin markings on the instrument.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical year/sequence decode, then verify the exact model from the headstock, soundhole label, and country-of-origin markings.</p>`,
    };
}
function decodeVintage1990s7DigitYYMM(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 1900 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        month: getMonthName(month),
        factory: 'Cort Korea (Incheon or Daejeon)',
        country: 'South Korea',
        notes: `Vintage 1990s Cort 7-digit YYMMSSS format. The first two digits (${yearDigits}) indicate production year ${year}; the next two digits (${monthDigits}) indicate ${getMonthName(month)}; the final three digits are production sequence ${parseInt(sequence, 10)}. Cort serials identify factory production timing, not the exact model name, so verify the model from headstock, label, or catalog details.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-vintage-1990s-7-digit-yymm-sequence',
        patternLabel: 'Cort vintage 1990s 7-digit YYMM sequence',
        additionalContext: {
            title: 'Cort vintage 1990s 7-digit serial',
            summary: 'This serial matches a vintage Cort numeric format where the first four digits identify production year and month.',
            highlights: [
                `The first two digits ${yearDigits} decode as production year ${year}.`,
                `The next two digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The final digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Cort serials generally identify production timing, not exact model name or body shape.',
                'Early-1990s Cort production was primarily South Korean, but physical markings remain the best confirmation.',
            ],
            verificationTips: [
                'Check the headstock or label for a model name or country-of-origin marking.',
                'Compare the instrument against early-1990s Cort catalog specs.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a vintage Cort 7-digit numeric format where the first four digits identify production year and month.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The next two digits ${monthDigits} decode as ${getMonthName(month)}. The final digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Cort serials generally identify production timing, not the exact model name.</li><li>Early-1990s Cort production was primarily South Korean.</li><li>Confirm the exact model from the headstock, label, and catalog features.</li></ul>`,
    };
}
function decodeEarly1990s7DigitYearSequence(serial) {
    const yearDigits = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const year = 1900 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort Korea (Incheon or Daejeon)',
        country: 'South Korea',
        notes: `Early-1990s Cort 7-digit YY + sequence format. The first two digits (${yearDigits}) indicate production year ${year}; the remaining digits are production or batch sequence ${sequenceNumber}. This pattern is used when the third and fourth digits do not form a valid month in the YYMMSSS format. Verify the exact model from headstock, label, and catalog features.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-early-1990s-7-digit-yy-sequence',
        patternLabel: 'Cort early 1990s 7-digit YY sequence',
        additionalContext: {
            title: 'Cort early-1990s 7-digit serial',
            summary: 'This serial matches an early-1990s Cort numeric format where the first two digits identify the production year.',
            highlights: [
                `The first two digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production or batch sequence ${sequenceNumber}.`,
                'Production is most likely South Korea for this era.',
            ],
            caveats: [
                'Some early Cort serials use YYMM while others use YY plus sequence.',
                'The serial does not identify the exact model name.',
                'Physical markings should be used to confirm country and model.',
            ],
            verificationTips: [
                'Check whether the serial is stamped, printed on a sticker, or on a neck plate.',
                'Compare the logo, electronics, and body style against early-1990s Cort catalogs.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an early-1990s Cort numeric format where the first two digits identify the production year.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production or batch sequence ${sequenceNumber}. Production is most likely South Korea for this era.</p><h3>What To Verify</h3><ul><li>Some early Cort serials use YYMM while others use YY plus sequence.</li><li>The serial does not identify the exact model name.</li><li>Physical markings should be used to confirm country and model.</li></ul>`,
    };
}
function decode1980sKorean7Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const year = 1900 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort Korea (Incheon)',
        country: 'South Korea',
        notes: `Legacy 7-digit Cort Korean numeric format. The first two digits (${yearDigits}) are interpreted as production year ${year}; the remaining digits are treated as production or internal sequence ${parseInt(sequence, 10)}. Cort serials from the 1980s and early 1990s can be inconsistent and usually do not identify the exact model name, so verify the model from the headstock, soundhole label, neck heel, or other physical markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-1980s-korea-7-digit-yy-sequence',
        patternLabel: 'Cort 1980s Korea 7-digit YY sequence',
        additionalContext: {
            title: 'Cort 1980s Korean serial',
            summary: 'This serial matches a legacy Korean Cort numeric format where the first two digits identify the production year.',
            highlights: [
                `The first two digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production or internal sequence ${parseInt(sequence, 10)}.`,
                'Production is most likely South Korea for this era.',
            ],
            caveats: [
                'Cort serial systems from the 1980s and early 1990s are less standardized than later formats.',
                'The serial does not identify the exact Cort model name.',
                'Factory attribution should be confirmed with country-of-origin markings when available.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, or neck heel for model and country markings.',
                'Compare the instrument against late-1980s Cort catalog specs.',
                'Look for additional stamps or labels inside the body or electronics cavity.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a legacy Korean Cort numeric format where the first two digits identify the production year.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production or internal sequence ${parseInt(sequence, 10)}. Production is most likely South Korea for this era.</p><h3>What To Verify</h3><ul><li>Cort serial systems from the 1980s and early 1990s are less standardized than later formats.</li><li>The serial does not identify the exact Cort model name.</li><li>Check the headstock, soundhole label, neck heel, or other markings for model and country-of-origin details.</li></ul>`,
    };
}
function isValidMonthDigits(value) {
    const month = parseInt(value, 10);
    return month >= 1 && month <= 12;
}
// 1990s 7-digit format: YMMXXXX (single year digit, two-digit month, four-digit sequence)
function decode1990s7Digit(serial) {
    const yearDigit = serial.substring(0, 1);
    const monthDigits = serial.substring(1, 3);
    const sequence = serial.substring(3);
    const yearNum = parseInt(yearDigit, 10);
    // Single digit: 0-9 maps to 1990-1999
    const year = 1990 + yearNum;
    const month = parseInt(monthDigits, 10);
    const isAnomalousMonth = month < 1 || month > 12;
    const monthDescription = isAnomalousMonth
        ? `batch/production code "${monthDigits}" (a known pre-standardization anomaly in early Cort serials — exact month not determinable)`
        : getMonthName(month);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year.toString(),
        ...(isAnomalousMonth ? {} : { month: getMonthName(month) }),
        factory: 'Cort Korea (Incheon or Daejeon)',
        country: 'South Korea',
        notes: `1990s 7-digit Cort format (YMMXXXX). The first digit (${yearDigit}) indicates production year ${year}. The next two digits (${monthDigits}) indicate ${monthDescription}. Production sequence: ${parseInt(sequence, 10)}. Cort operated factories in Incheon (1987–2007) and Daejeon (1991–2007) during this era. Pre-standardization Cort serials can contain non-standard month codes; the production year and sequence remain reliable.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-1990s-ymm-sequence-7-digit',
        patternLabel: 'Cort 1990s 7-digit YMMXXXX format',
        additionalContext: {
            title: 'Cort 1990s 7-digit serial',
            summary: 'This serial matches the 1990s Cort 7-digit format where the first digit identifies the production year, the next two digits indicate month or batch code, and the final four are the production sequence.',
            highlights: [
                `The first digit ${yearDigit} decodes as production year ${year}.`,
                isAnomalousMonth
                    ? `The digits ${monthDigits} are an anomalous batch/production code rather than a valid calendar month — a known occurrence in early Cort serial records.`
                    : `The digits ${monthDigits} decode as ${getMonthName(month)}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
                'Factory is most likely South Korean (Incheon or Daejeon) for this era.',
            ],
            caveats: [
                'Pre-standardization Cort serial records can contain non-standard month codes.',
                'The serial does not identify the exact model name.',
                'Physical country-of-origin markings remain the best confirmation for factory.',
            ],
            verificationTips: [
                'Check the headstock, soundhole label, neck heel, or back of headstock for model and country markings.',
                'Look for Made in Korea markings to confirm South Korean production.',
                'Compare the instrument against 1990s Cort catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the 1990s Cort 7-digit format where the first digit identifies the production year, the next two digits indicate month or batch code, and the final four are the production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The first digit ${yearDigit} decodes as production year ${year}. The digits ${monthDigits} indicate ${monthDescription}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}. Factory is most likely South Korean (Incheon or Daejeon) for this era.</p><h3>What To Verify</h3><ul><li>Pre-standardization Cort serial records can contain non-standard month codes — the production year and sequence are more reliable than the month field here.</li><li>The serial does not identify the exact model name.</li><li>Check the headstock, soundhole label, or neck heel for model and country-of-origin details.</li></ul>`,
    };
}
// Early 1980s 5-digit neck-plate numeric format
function decodeEarly1980sFiveDigitNeckPlate(serial) {
    const yearCode = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const sequenceNumber = parseInt(sequence, 10);
    const yearByCode = {
        '20': 1982,
    };
    const year = yearByCode[yearCode];
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: year ? year.toString() : 'Early 1980s (estimated)',
        factory: 'Cor-Tek Korea',
        country: 'South Korea',
        notes: `Early-1980s Cort 5-digit neck-plate format. The first two digits (${yearCode}) are treated as an early Cort production-year code${year ? ` for ${year}` : ''}; the remaining digits are production sequence ${sequenceNumber}. This format is associated with Korean Cor-Tek bolt-on instruments and should be verified against a metal neck plate, Made in Korea marking, headstock logo, and period-correct catalog features.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-early-1980s-5-digit-neck-plate',
        patternLabel: 'Cort early 1980s 5-digit neck-plate serial',
        additionalContext: {
            title: 'Cort early-1980s 5-digit serial',
            summary: 'This serial matches an early Cort all-numeric 5-digit format associated with Korean neck-plate stamped instruments.',
            highlights: [
                year
                    ? `The first two digits ${yearCode} decode as the early Cort production-year code for ${year}.`
                    : `The first two digits ${yearCode} are treated as an early Cort production-year code.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
                'This format is most useful when stamped on a metal neck plate with Made in Korea markings.',
            ],
            caveats: [
                'Early Cort serial documentation is less standardized than later date-coded formats.',
                'The serial does not identify the exact model name.',
                'Use physical markings and construction details to confirm the era.',
            ],
            verificationTips: [
                'Check whether the number is stamped into the metal neck plate.',
                'Look for Made in Korea markings near the neck plate or headstock.',
                'Compare the body shape, headstock logo, pickups, and bridge against early-1980s Cort catalog examples.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an early Cort all-numeric 5-digit format associated with Korean neck-plate stamped instruments.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearCode} are treated as an early Cort production-year code${year ? ` for ${year}` : ''}. The remaining digits decode as production sequence ${sequenceNumber}. This format is most useful when stamped on a metal neck plate with Made in Korea markings.</p><h3>What To Verify</h3><ul><li>Early Cort serial documentation is less standardized than later date-coded formats.</li><li>The serial does not identify the exact model name.</li><li>Confirm the number location, Made in Korea markings, body shape, headstock logo, and period-correct hardware.</li></ul>`,
    };
}
// 6-digit format (older/ambiguous)
function decode6Digit(serial) {
    // This format is ambiguous - could be various things
    // Try to interpret as YMMXXX or MMXXXX
    const firstTwo = serial.substring(0, 2);
    const possibleMonth = parseInt(firstTwo, 10);
    if (possibleMonth >= 1 && possibleMonth <= 12) {
        // Could be MMXXXX format
        const sequence = serial.substring(2);
        const info = {
            brand: 'Cort',
            serialNumber: serial,
            year: 'Unknown (pre-2000)',
            month: getMonthName(possibleMonth),
            factory: 'Cort Korea',
            country: 'South Korea',
            notes: `6-digit format. If the first two digits (${firstTwo}) represent the month, production sequence would be ${sequence}. Exact year cannot be determined from this format. This may be a pre-mid-1990s guitar with a non-standard serial number.`,
        };
        return { success: true, info };
    }
    // Otherwise, treat as older random format
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: 'Unknown (likely pre-1995)',
        factory: 'Cort Korea',
        country: 'South Korea',
        notes: 'This 6-digit serial number may be from the pre-mid-1990s era when Cort used randomly generated serial numbers. Contact Cort customer service with photos of the instrument for more accurate identification.',
    };
    return { success: true, info };
}
function decodeMGMSignatureSeries(serial) {
    const sequence = serial.substring(3);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Cort',
        serialNumber: serial,
        year: 'early 2000s (estimated)',
        factory: 'Cort, South Korea (signature series production)',
        country: 'South Korea',
        model: 'MGM-1 (Matt Guitar Murphy Signature)',
        notes: `MGM prefix identifies the Matt "Guitar" Murphy Signature Model (MGM-1), a limited-production signature guitar from the early 2000s. This model tracked production with a model-specific stamp (MGM + sequential number) rather than the standard Cort factory YYMM date sequence. Production unit: ${sequenceNumber}. Physical indicators include a PRS-style carved maple top, gold hardware, dual humbuckers with push-pull coil tap, and "MGM Matt Guitar Murphy" headstock text.`,
    };
    return {
        success: true,
        info,
        patternKey: 'cort-mgm-signature-series-sequential',
        patternLabel: 'Cort MGM Matt Guitar Murphy Signature Series',
        additionalContext: {
            title: 'Cort MGM Matt Guitar Murphy Signature (MGM-1)',
            summary: `This serial identifies a Matt "Guitar" Murphy Signature Model (MGM-1) from Cort Korea's limited early-2000s production run. The MGM prefix replaces the standard date-based sequence for this signature series.`,
            highlights: [
                'MGM prefix stands for Matt "Guitar" Murphy, the Blues Brothers guitarist.',
                'Production unit number: ' + sequenceNumber + '.',
                'Made in South Korea by Cort, early 2000s production.',
                'Known physical identifiers: carved figured maple top, gold hardware, dual humbuckers with coil-tap.',
            ],
            caveats: [
                'No year is encoded in the serial — early 2000s is an estimate based on the known production window.',
                'This is a limited run; authentication should rely on the headstock text and construction details.',
            ],
            verificationTips: [
                'Check the headstock face for "MGM Matt Guitar Murphy" text — this is the primary identifier.',
                'The top finish is typically quilted maple in Amber Burst, Sunburst, or Blue — verify against known examples.',
                'Push-pull coil tap on the tone knob is a documented feature of this model.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial identifies a Cort MGM-1 — the Matt "Guitar" Murphy Signature Model, a limited-production Korean guitar from the early 2000s. Matt Murphy was the legendary blues guitarist associated with the Blues Brothers, Muddy Waters, and Howlin' Wolf.</p><h3>What This Serial Tells You</h3><p>The MGM prefix is model-specific rather than date-coded. Cort tracked this signature run with a sequential model stamp (MGM + production number) rather than their standard YYMMXXXXXX factory format. Production unit: ${sequenceNumber}.</p><h3>Physical Identifiers</h3><ul><li><strong>Headstock:</strong> "MGM Matt Guitar Murphy" text on the headstock face.</li><li><strong>Top:</strong> Carved figured/quilted maple in Amber Burst, Sunburst, or Blue.</li><li><strong>Hardware:</strong> Gold-plated throughout.</li><li><strong>Electronics:</strong> Dual humbuckers with a push-pull coil-tap tone knob.</li><li><strong>Neck:</strong> Set-in neck construction.</li></ul><h3>Coal Creek Guitars Note</h3><p>This is a rare and collectible signature model. Authenticate using the headstock text, maple top, and gold hardware before completing any sale or purchase.</p>`,
    };
}
// Helper function for month names
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
}
