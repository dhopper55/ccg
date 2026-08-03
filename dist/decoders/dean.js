/**
 * Dean Guitar Serial Number Decoder
 *
 * Supports:
 * - USA-made guitars (7-digit format, 1977-1985 and 1996+)
 * - UnSung Korea (US prefix, 2006+)
 * - World Korea (E prefix, WK prefix, KW prefix)
 * - 9-digit numeric import (YYMM + 5-digit sequence, China or Indonesia)
 * - Legacy Korea E-prefix import line (E + Y + 5 digits)
 * - China imports (Z prefix, O prefix; YooJin Y prefix, 2006+)
 * - Indonesia (CT, IW prefixes)
 * - Samick Korea (S prefix, 1993-1996)
 * - Japan FujiGen (J, JF prefixes)
 * - Czech Republic (5-6 digit, 1997-2000)
 *
 * Note: Guitars from 1986-1995 (Tropical Music era) have serial numbers
 * on the last fret and cannot be reliably dated.
 */
export function decodeDean(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // USA Custom Shop (Tampa, Florida): USA + YY + sequence
    if (/^USA\d{6,8}$/.test(normalized)) {
        return decodeUSACustomShop(normalized);
    }
    // WSM factory (World Sound Music / Yeou Chern Instruments, China)
    // Handles both plain form (WSM2308B01) and unit-suffix form (WSM2308B01.0001)
    if (/^WSM/.test(normalized)) {
        return decodeWSMFactory(normalized.replace(/\./g, ''));
    }
    // UnSung Korea: US prefix (don't confuse with USA!)
    if (/^US\d{7,10}$/.test(normalized)) {
        return decodeUnSungKorea(normalized);
    }
    // UnSung Korea: shorter US + 6-digit variant (US + YY + 4-digit sequence, no month)
    if (/^US\d{6}$/.test(normalized)) {
        return decodeUnSungKoreaShort(normalized);
    }
    // World Korea: WK prefix (newer format, 8 or 9 digits after prefix)
    if (/^WK\d{8,9}$/.test(normalized)) {
        return decodeWorldKoreaWK(normalized);
    }
    // World Korea: KW prefix (same factory as WK, alternate prefix convention)
    if (/^KW\d{8,9}$/.test(normalized)) {
        return decodeWorldKoreaKW(normalized);
    }
    // Legacy Korea E-prefix import line: E + single year digit + 5-digit sequence
    if (/^E[7-9]\d{5}$/.test(normalized)) {
        return decodeLegacyKoreaESingleYearDigit(normalized);
    }
    // World Korea: E prefix (older format)
    if (/^E\d{6,8}$/.test(normalized)) {
        return decodeWorldKoreaE(normalized);
    }
    // YooJin China: Y prefix
    if (/^Y\d{8,10}$/.test(normalized)) {
        return decodeYooJinChina(normalized);
    }
    // YooJin China: shorter Y + 7-digit variant (Y + YYMM + 3-digit sequence)
    if (/^Y\d{7}$/.test(normalized)) {
        return decodeYooJinChinaShort(normalized);
    }
    // YooJin China: two-letter YC variant
    if (/^YC\d{8}$/.test(normalized)) {
        return decodeYooJinChinaYC(normalized);
    }
    // World Sound China: WS prefix
    if (/^WS\d{8}$/.test(normalized)) {
        return decodeWorldSoundWS(normalized);
    }
    // Onetek China: 0C prefix (digit zero + letter C, commonly entered/printed as letter "O")
    if (/^[0O]C\d{6}$/.test(normalized)) {
        return decodeOnetekChina0C(normalized);
    }
    // China import line: Z prefix
    if (/^Z\d{7,8}$/.test(normalized)) {
        return decodeChinaZ(normalized);
    }
    // Asian partner import line: A + YYMM + sequence
    if (/^A\d{8,9}$/.test(normalized)) {
        return decodeAsianPartnerA(normalized);
    }
    // Asian partner import line: shorter A + 6-digit variant (A + YY + 4-digit sequence, no month)
    if (/^A\d{6}$/.test(normalized)) {
        return decodeAsianPartnerAShort(normalized);
    }
    // Asian partner import line: D + YYMM + sequence
    if (/^D\d{8}$/.test(normalized)) {
        return decodeAsianPartnerD(normalized);
    }
    // Legacy Korea D-prefix import line (1990s World Music Instruments): D + YY + 4-digit sequence, no month encoded
    if (/^D\d{6}$/.test(normalized)) {
        return decodeLegacyKoreaD(normalized);
    }
    // D Series / DS model (Tropical Music era, Korea 1994-1996): D + 4-digit sequence, no date encoded
    if (/^D\d{4}$/.test(normalized)) {
        return decodeDSeriesTropicalKorea(normalized);
    }
    // Asian partner import line: P + YYMM + sequence (e.g. P20110214 = 2020, November, seq 0214)
    if (/^P\d{8}$/.test(normalized)) {
        return decodeAsianPartnerP(normalized);
    }
    // Cort Korea: C + YY + batch + sequence (e.g. C2122845 = Cort 2021, batch 22, seq 845)
    if (/^C\d{7}$/.test(normalized)) {
        return decodeCortKoreaC(normalized);
    }
    // World factory numeric-prefix: digit + W + YYMM + sequence (e.g. 1W18120157)
    // The leading digit is a production batch code at the World Musical Instruments facility
    if (/^\dW\d{8}$/.test(normalized)) {
        return decodeWorldNumericPrefixYYMM(normalized);
    }
    // Indonesia: IW prefix
    if (/^IW\d{8,10}$/.test(normalized)) {
        return decodeIndonesiaIW(normalized);
    }
    // Indonesia: CT prefix
    if (/^CT\d{8,10}$/.test(normalized)) {
        return decodeIndonesiaCT(normalized);
    }
    // Japan FujiGen: JF prefix
    if (/^JF\d{6,8}$/.test(normalized)) {
        return decodeJapanFujiGen(normalized);
    }
    // India JI/JL prefix: JI or JL + YY + 5-digit sequence (Indian factory, 2010s)
    if (/^J[IL]\d{7}$/.test(normalized)) {
        return decodeIndiaJIL(normalized);
    }
    // Japan: J prefix
    if (/^J\d{6,8}$/.test(normalized)) {
        return decodeJapanJ(normalized);
    }
    // Samick World Korea: SW prefix + YYMM + 4-digit sequence (e.g. SW09040062 = 2009, April, unit 62)
    if (/^SW\d{8}$/.test(normalized)) {
        return decodeSamickWorldSW(normalized);
    }
    // Samick Korea: S prefix (1993-1996)
    if (/^S\d{6,8}$/.test(normalized)) {
        return decodeSamickKorea(normalized);
    }
    // China: O prefix
    if (/^O\d{6,8}$/.test(normalized)) {
        return decodeChinaO(normalized);
    }
    // Korea: W prefix (DBZ Bolero and others)
    if (/^W\d{6,8}$/.test(normalized)) {
        return decodeKoreaW(normalized);
    }
    // India import line: H prefix (modern import pattern)
    if (/^H\d{5,10}$/.test(normalized)) {
        return decodeIndiaH(normalized);
    }
    // Korean/Asian import: K + YY + MM + 4-digit sequence
    if (/^K\d{8}$/.test(normalized)) {
        return decodeKoreanImportK(normalized);
    }
    // KH factory: KH + YY + MM + 5-digit sequence (overseas import, e.g. KH190630183 = 2019 June)
    if (/^KH\d{9}$/.test(normalized)) {
        return decodeKHFactory(normalized);
    }
    // China/Asia factory: F + YY + 5-digit sequence (8 chars total, e.g. F2230859 = 2022, seq 30859)
    if (/^F\d{7}$/.test(normalized)) {
        return decodeFPrefixFactory(normalized);
    }
    // 9-digit numeric import: YYMM + 5-digit sequence (e.g., 170303338 = 2017, March, seq 03338)
    if (/^\d{9}$/.test(normalized)) {
        return decodeNumeric9DigitYYMMSeq(normalized);
    }
    // USA-made: 7-digit numeric (standard format)
    if (/^\d{7}$/.test(normalized)) {
        return decodeUSA7Digit(normalized);
    }
    // Czech Republic or USA: 5-6 digit (1997-2000 Czech or early USA)
    if (/^\d{5,6}$/.test(normalized)) {
        return decode5or6Digit(normalized);
    }
    // Older numeric formats (4+ digits, could be various eras)
    if (/^\d{4,8}$/.test(normalized)) {
        return decodeNumericGeneral(normalized);
    }
    return {
        success: false,
        error: 'Unable to decode this Dean serial number. The format was not recognized. Common formats include: 7-digit (USA), US prefix (UnSung Korea), WK prefix (World Korea), Z/O/Y prefix (China imports), IW/CT prefix (Indonesia), C-prefix 8-digit (Cort Korea), or 5-6 digit (Czech Republic 1997-2000). Note: Guitars from 1986-1995 with serial numbers on the last fret cannot be reliably dated.',
    };
}
// UnSung Korea: US prefix (2006+)
function decodeUnSungKorea(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    let monthName;
    if (month >= 1 && month <= 12) {
        monthName = getMonthName(month);
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'UnSung Factory, Incheon',
        country: 'South Korea',
        notes: `US prefix indicates UnSung factory in Korea (not USA). UnSung has produced Dean guitars since 2006. Production sequence: ${sequence}. Note: Do not confuse "US" prefix with USA-made guitars.`,
    };
    return { success: true, info };
}
// World Korea: WK prefix (newer format, 2017+)
function decodeWorldKoreaWK(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'World Musical Instruments Co Ltd',
        country: 'South Korea',
        notes: `WK prefix indicates World Musical Instruments Co Ltd in South Korea. Production sequence: ${sequence}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-world-korea-wk-yymm-sequence',
        patternLabel: 'Dean World Korea WK-prefix YYMM sequence',
        additionalContext: {
            title: 'Dean WK-prefix (World Korea) serial',
            summary: `This serial follows the WK-prefix format used by Dean for guitars manufactured at World Musical Instruments Co Ltd in South Korea.`,
            highlights: [
                'WK identifies World Musical Instruments Co Ltd, a respected Korean factory also used by PRS SE, Schecter, and ESP LTD.',
                `${yearDigits} decodes as production year ${year}.`,
                monthName ? `${monthDigits} decodes as ${monthName}.` : `${monthDigits} is the month code.`,
                `${sequence} is the production sequence number (unit ${sequenceNumber}).`,
            ],
            caveats: [
                'WK and KW are both seen on World factory guitars — same facility, alternate prefix convention.',
                'This format does not encode the exact model name.',
            ],
            verificationTips: [
                'Check the back of the headstock for a Made in Korea stamp.',
                'Compare hardware and finish against Dean Korea import catalog from the decoded year.',
                'Contact Dean support with photos if exact authentication is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial follows the WK-prefix format used by Dean for guitars manufactured at World Musical Instruments Co Ltd in South Korea.</p><h3>How This Pattern Is Typically Read</h3><p>WK identifies World Musical Instruments Co Ltd, a respected Korean factory also used by PRS SE, Schecter, and ESP LTD. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${monthName || 'the month code'}. The final digits ${sequence} are the production sequence (unit ${sequenceNumber}).</p><h3>What To Verify</h3><ul><li>WK and KW are both seen on World factory guitars — same facility, alternate prefix convention.</li><li>This format does not encode the exact model name — confirm from headstock, label, and hardware.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a South Korea import decode from ${year}. Verify the model from the headstock and compare against Dean's Korea import lineup.</p>`,
    };
}
// World Korea: KW prefix (same factory as WK, alternate prefix convention)
function decodeWorldKoreaKW(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'World Musical Instruments Co Ltd',
        country: 'South Korea',
        notes: `KW prefix is an alternate convention for World Musical Instruments Co Ltd in South Korea (same factory as WK prefix). Production sequence: ${sequence}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-world-korea-kw-yymm-sequence',
        patternLabel: 'Dean World Korea KW-prefix YYMM sequence',
        additionalContext: {
            title: 'Dean KW-prefix (World Korea) serial',
            summary: `This serial follows the KW-prefix format — an alternate prefix convention for World Musical Instruments Co Ltd in South Korea, the same facility as WK-prefix guitars.`,
            highlights: [
                'KW is an alternate prefix convention for World Musical Instruments Co Ltd (same factory as WK).',
                `${yearDigits} decodes as production year ${year}.`,
                monthName ? `${monthDigits} decodes as ${monthName}.` : `${monthDigits} is the month code.`,
                `${sequence} is the production sequence number (unit ${sequenceNumber}).`,
            ],
            caveats: [
                'KW and WK are both seen on World factory guitars — the initials may be reversed depending on the stamping convention used.',
                'This format does not encode the exact model name.',
            ],
            verificationTips: [
                'Check the back of the headstock for a Made in Korea stamp.',
                'Compare hardware and finish against Dean Korea import catalog from the decoded year.',
                'Contact Dean support with photos if exact authentication is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial follows the KW-prefix format — an alternate prefix convention for World Musical Instruments Co Ltd in South Korea, the same facility as WK-prefix guitars.</p><h3>How This Pattern Is Typically Read</h3><p>KW identifies World Musical Instruments Co Ltd (same factory as WK). The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${monthName || 'the month code'}. The final digits ${sequence} are the production sequence (unit ${sequenceNumber}).</p><h3>What To Verify</h3><ul><li>KW and WK are both seen on World factory guitars — the initials may be reversed depending on the label stamping convention used.</li><li>This format does not encode the exact model name — confirm from headstock, label, and hardware.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a South Korea import decode from ${year}. Verify the model from the headstock and compare against Dean's Korea import lineup.</p>`,
    };
}
function decodeFPrefixFactory(serial) {
    const yearDigits = serial.substring(1, 3);
    const sequence = serial.substring(3);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year,
        factory: 'F-prefix import factory (China or Indonesia)',
        country: 'China or Indonesia (check label)',
        notes: `Dean F-prefix import format. The "F" prefix identifies an overseas contract factory. The digits "${yearDigits}" indicate production year ${year}. The remaining digits "${sequence}" are the production sequence. Confirm the country of origin from the label inside the guitar or the back of the headstock.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-f-prefix-yy-sequence',
        patternLabel: 'Dean F-prefix import factory YY sequence',
        additionalContext: {
            title: 'Dean F-prefix import serial',
            summary: 'This serial matches a Dean F-prefix import format where "F" identifies an overseas contracted factory and the following digits encode the production year and sequence.',
            highlights: [
                'The "F" prefix identifies a contracted overseas factory (China or Indonesia).',
                `The digits "${yearDigits}" decode as production year ${year}.`,
                `The remaining digits "${sequence}" are the production sequence.`,
            ],
            caveats: [
                'The exact factory and country of origin should be confirmed from the interior label or headstock markings.',
                'Dean has used F-prefix serials across multiple factories over the years.',
            ],
            verificationTips: [
                'Check the interior label or back of the headstock for country-of-origin markings.',
                `Compare the body style, pickups, and hardware against Dean import catalogs from ${year}.`,
                'Contact Dean Guitars support with photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Dean F-prefix import format. The "F" prefix identifies a contracted overseas factory, followed by a two-digit year and production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>The "F" prefix identifies a contracted overseas factory (China or Indonesia). The digits "${yearDigits}" decode as production year ${year}. The remaining digits "${sequence}" are the production sequence.</p><h3>What To Verify</h3><ul><li>Check the interior label or back of the headstock for country-of-origin markings.</li><li>Compare the body style and hardware against Dean import catalogs from ${year}.</li></ul>`,
    };
}
// 9-digit numeric import: YYMM + 5-digit sequence
function decodeNumeric9DigitYYMMSeq(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Asian import factory (China or Indonesia)',
        country: 'China or Indonesia',
        notes: `9-digit numeric import format: YYMM + 5-digit sequence. ${yearDigits} = ${year}, ${monthDigits} = ${monthName || 'month code'}, ${sequence} = production sequence ${sequenceNumber}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-numeric-9digit-yymm-sequence',
        patternLabel: 'Dean 9-digit numeric import YYMM sequence',
        additionalContext: {
            title: 'Dean 9-digit numeric import serial',
            summary: `This serial follows a 9-digit numeric import format used by Dean for guitars manufactured in Asian factories.`,
            highlights: [
                `${yearDigits} decodes as production year ${year}.`,
                monthName ? `${monthDigits} decodes as ${monthName}.` : `${monthDigits} is the month code.`,
                `${sequence} is the 5-digit production sequence (unit ${sequenceNumber}).`,
            ],
            caveats: [
                '9-digit numeric Dean serials without a factory prefix are seen on import guitars from China and Indonesia.',
                'Country of origin should be confirmed from headstock or label markings.',
                'This format does not encode the exact model name.',
            ],
            verificationTips: [
                'Check the back of the headstock or a neck label for the country of origin.',
                'Compare hardware and model design against Dean import catalog from the decoded year.',
                'Contact Dean support if factory identification is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial follows a 9-digit numeric import format used by Dean for guitars manufactured in Asian factories.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits ${yearDigits} decode as production year ${year}. The next two digits ${monthDigits} decode as ${monthName || 'the month code'}. The remaining digits ${sequence} are the production sequence (unit ${sequenceNumber}).</p><h3>What To Verify</h3><ul><li>9-digit numeric Dean serials without a prefix are seen on import guitars from China and Indonesia — check headstock or label for country of origin.</li><li>This format does not encode the exact model name — confirm from headstock markings and catalog specs.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a Dean import decode from ${year}. Verify the model and country from the guitar's physical markings.</p>`,
    };
}
// World Korea: E prefix (older format, 2000-2015)
function decodeWorldKoreaE(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    if (yearNum >= 0 && yearNum <= 25) {
        year = (2000 + yearNum).toString();
    }
    else {
        year = `Possibly 20${yearDigits}`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: 'World Musical Instruments Co Ltd',
        country: 'South Korea',
        notes: `E prefix indicates World factory in Korea (older designation, primarily 2000-2015). Production sequence: ${sequence}. Note: Some E-prefix serials from early 2000s may have inconsistent year coding.`,
    };
    return { success: true, info };
}
// Legacy Korea E-prefix import line: E + Y + 5-digit sequence
function decodeLegacyKoreaESingleYearDigit(serial) {
    const yearDigit = serial[1];
    const sequence = serial.substring(2);
    const firstCandidate = `199${yearDigit}`;
    const secondCandidate = `200${yearDigit}`;
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: `${firstCandidate} or ${secondCandidate} (estimated)`,
        factory: 'Korean import production line',
        country: 'South Korea',
        notes: `E prefix is seen on Korean-made Dean imports. In this shorter E-prefix format, the first digit after E is commonly treated as a year digit, so ${yearDigit} may indicate ${firstCandidate} or ${secondCandidate}; the remaining digits are production sequence ${parseInt(sequence, 10)}. Verify with a Made in Korea headstock stamp, model features, and Dean support when exact dating matters.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-legacy-korea-e-single-year-digit',
        patternLabel: 'Dean legacy Korea E-prefix single-year-digit format',
        additionalContext: {
            title: 'Dean legacy Korea E-prefix serial',
            summary: 'This serial matches a shorter E-prefix format seen on Korean-made Dean imports.',
            highlights: [
                'The E prefix is associated with Korean import production on many Dean guitars.',
                `The first digit after E is treated as a year digit, giving likely candidates of ${firstCandidate} or ${secondCandidate}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Dean import serials can be inconsistent, especially across older Korean production runs.',
                'This decode identifies a likely country and era, not an exact model.',
                'The same year digit can overlap decades, so physical markings matter.',
            ],
            verificationTips: [
                'Check the back of the headstock for a Made in Korea stamp.',
                'Compare the guitar to Korean Dean models from the likely era, such as Icon, Vendetta, or Cadillac variants.',
                'Contact Dean support if a definitive production record is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a shorter E-prefix format seen on Korean-made Dean imports.</p><h3>How This Pattern Is Typically Read</h3><p>The E prefix is associated with Korean import production on many Dean guitars. The first digit after E is treated as a year digit, giving likely candidates of ${firstCandidate} or ${secondCandidate}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Dean import serials can be inconsistent, especially across older Korean production runs.</li><li>This decode identifies a likely country and era, not an exact model.</li><li>The same year digit can overlap decades, so physical markings matter.</li></ul><h3>Coal Creek Guitars Note</h3><p>Check for a Made in Korea headstock stamp, compare the model to Korean Dean specs from the likely era, and contact Dean support if exact dating is required.</p>`,
    };
}
// YooJin China: Y prefix (2006+)
function decodeYooJinChina(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    let monthName;
    if (month >= 1 && month <= 12) {
        monthName = getMonthName(month);
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'YooJin Factory',
        country: 'China',
        notes: `Y prefix indicates YooJin factory in China. YooJin has produced Dean guitars since 2006. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// YooJin China: shorter Y + 7-digit variant (Y + YYMM + 3-digit sequence)
function decodeYooJinChinaShort(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'YooJin Factory',
        country: 'China',
        notes: `Y prefix indicates YooJin factory in China (shorter 7-digit variant: Y + YYMM + 3-digit sequence). Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// YooJin China: two-letter YC variant
function decodeYooJinChinaYC(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'YooJin Factory',
        country: 'China',
        notes: `YC prefix indicates YooJin factory in China — a two-letter variant of the plain Y prefix. Production sequence: ${sequence}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-yc-yoojin-china-yymm-sequence',
        patternLabel: 'Dean YC YooJin China YYMM sequence',
    };
}
// World Sound China: WS prefix
function decodeWorldSoundWS(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Asian contract factory (WS)',
        country: 'China',
        notes: `WS prefix identifies an Asian contract factory used for Dean's Chinese-produced import instruments. Production sequence: ${sequence}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-ws-china-yymm-sequence',
        patternLabel: 'Dean WS China YYMM sequence',
    };
}
// Onetek China: 0C prefix (digit zero + letter C, commonly entered/printed as letter "O")
function decodeOnetekChina0C(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Onetek Factory',
        country: 'China',
        notes: `0C prefix indicates the Onetek factory in China (the second character is the digit zero, commonly entered or printed as the letter "O" — both are treated identically). Digits ${yearDigits} decode as production year ${year}; ${sequence} is the production sequence (unit ${sequenceNumber}).`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-0c-onetek-china-yy-sequence',
        patternLabel: 'Dean 0C Onetek China YY sequence',
    };
}
// Asian partner import line: shorter A + 6-digit variant (A + YY + 4-digit sequence, no month)
function decodeAsianPartnerAShort(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    const year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Asian partner import production line',
        country: 'China or Indonesia',
        notes: `A-prefix Dean import format (shorter 6-digit variant: A + YY + 4-digit sequence, no month encoded). The A prefix identifies an Asian partner factory code. Digits ${yearDigits} indicate ${year}; ${sequence} is the production sequence (unit ${sequenceNumber}). Dean import serials identify production tracking more reliably than exact model identity, so verify the model from headstock markings and catalog specs.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-asian-partner-a-yy-sequence-short',
        patternLabel: 'Dean Asian partner A-prefix YY sequence (short)',
    };
}
// UnSung Korea: shorter US + 6-digit variant (US + YY + 4-digit sequence, no month)
function decodeUnSungKoreaShort(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    const year = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'UnSung Factory, Incheon',
        country: 'South Korea',
        notes: `US prefix indicates UnSung factory in Korea (shorter 6-digit variant: US + YY + 4-digit sequence, no month encoded). Digits ${yearDigits} indicate ${year}; ${sequence} is the production sequence (unit ${sequenceNumber}). Note: Do not confuse "US" prefix with USA-made guitars.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-unsung-korea-us-yy-sequence-short',
        patternLabel: 'Dean UnSung Korea US-prefix YY sequence (short)',
    };
}
// D Series / DS model (Tropical Music era, Korea 1994-1996): D + 4-digit sequence, no date encoded
function decodeDSeriesTropicalKorea(serial) {
    const sequence = serial.substring(1);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: '1994-1996 (Tropical Music era)',
        factory: 'Samick, Korea (Tropical Music ownership era)',
        country: 'South Korea',
        notes: `D prefix identifies the D Series (DS model) product line built in Korea between 1994 and 1996, under Tropical Music ownership. This prefix denotes the product line, not a factory code, and the 4-digit sequence "${sequence}" does not encode a production date. Dean guitars from 1986-1995 generally lack reliably dated serial numbers. Physical traits consistent with this era include a four-bolt neck plate and a three-per-side "shrimp fork" headstock — verify these to confirm the era.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-d-series-tropical-korea-sequential',
        patternLabel: 'Dean D Series Tropical Music Korea sequential (no date)',
    };
}
// China import line: Z prefix
// Typical pattern: Z + YY + production sequence
function decodeChinaZ(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'China import production line',
        country: 'China',
        notes: `Z prefix is commonly seen on Chinese-made Dean imports. Interpreted as Z + YY + production sequence, so ${yearDigits} indicates ${year}. Production sequence: ${sequence}. Verify with country-of-origin markings when exact authentication matters.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-china-z-yy-sequence',
        patternLabel: 'Dean China Z-prefix YY sequence format',
        additionalContext: {
            title: 'Dean China Z-prefix serial',
            summary: 'This serial matches a Z-prefix format seen on Chinese-made Dean imports.',
            highlights: [
                'The Z prefix is commonly associated with Chinese Dean import production.',
                `The first two digits after Z are treated as the production year: ${year}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Dean import serials can vary by factory and production run.',
                'This decode identifies the likely country and year, not a complete authenticity guarantee.',
            ],
            verificationTips: [
                'Check for a Made in China marking on the headstock, neck plate, or label.',
                'Compare the model features against Dean import specs from the decoded year.',
                'Contact Dean support if a definitive factory record is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Z-prefix format seen on Chinese-made Dean imports.</p><h3>How This Pattern Is Typically Read</h3><p>The Z prefix is commonly associated with Chinese Dean import production. The first two digits after Z are treated as the production year, giving ${year}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Dean import serials can vary by factory and production run.</li><li>This decode identifies the likely country and year, not a complete authenticity guarantee.</li></ul><h3>Coal Creek Guitars Note</h3><p>Check for a Made in China marking, compare the guitar to Dean import specs from ${year}, and contact Dean support if exact dating is required.</p>`,
    };
}
function decodeAsianPartnerA(serial) {
    const digits = serial.substring(1);
    // 9-digit variant encodes a factory/line code at position 0 before YY+MM+seq
    const offset = digits.length === 9 ? 1 : 0;
    const yearDigits = digits.substring(offset, offset + 2);
    const monthDigits = digits.substring(offset + 2, offset + 4);
    const sequence = digits.substring(offset + 4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Asian partner import production line',
        country: 'China or Indonesia',
        notes: `A-prefix Dean import format interpreted as A + YYMM + production sequence. The A prefix identifies an Asian partner factory code; ${yearDigits} indicates ${year}; ${monthDigits} indicates ${monthName || 'an unverified month code'}; ${sequence} is the production sequence. Dean import serials identify production tracking more reliably than exact model identity, so verify the model from headstock markings and catalog specs.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-asian-partner-a-yymm-sequence',
        patternLabel: 'Dean Asian partner A-prefix YYMM sequence',
        additionalContext: {
            title: 'Dean A-prefix import serial',
            summary: 'This serial matches an A-prefix Dean import format used by Asian manufacturing partners.',
            highlights: [
                'A is treated as an Asian partner factory code.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                monthName ? `The digits ${monthDigits} decode as ${monthName}.` : `The digits ${monthDigits} are treated as a month or internal production code.`,
                `The final digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Dean import prefix letters can vary by partner and production run.',
                'This decode identifies likely production timing, not the exact model name.',
                'Country should be confirmed from Made in China, Made in Indonesia, label, or headstock markings.',
            ],
            verificationTips: [
                'Check the back of the headstock and neck plate for country-of-origin markings.',
                'Compare the guitar against 2007 Dean import specs such as Dimebag, EVO, Vendetta, and related import lines.',
                'Contact Dean support with photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an A-prefix Dean import format used by Asian manufacturing partners.</p><h3>How This Pattern Is Typically Read</h3><p>A is treated as an Asian partner factory code. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits}${monthName ? ` decode as ${monthName}` : ' are treated as a month or internal production code'}. The final digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Dean import prefix letters can vary by partner and production run.</li><li>This decode identifies likely production timing, not the exact model name.</li><li>Confirm country of origin from headstock, neck plate, label, or other physical markings.</li></ul>`,
    };
}
function decodeAsianPartnerD(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Asian partner import production line',
        country: 'China, South Korea, or Indonesia',
        notes: `D-prefix Dean import format interpreted as D + YYMM + production sequence. The D prefix identifies an Asian partner factory code; ${yearDigits} indicates ${year}; ${monthDigits} indicates ${monthName || 'an unverified month code'}; ${sequence} is production sequence ${sequenceNumber}. Dean factory codes can shift by run, so confirm country and exact model from headstock markings and catalog specs.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-asian-partner-d-yymm-sequence',
        patternLabel: 'Dean Asian partner D-prefix YYMM sequence',
        additionalContext: {
            title: 'Dean D-prefix import serial',
            summary: 'This serial matches a D-prefix Dean import format used by Asian manufacturing partners.',
            highlights: [
                'D is treated as an Asian partner factory code.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                monthName ? `The digits ${monthDigits} decode as ${monthName}.` : `The digits ${monthDigits} are treated as a month or internal production code.`,
                `The final digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'Dean import prefix letters can vary by partner and production run.',
                'This decode identifies likely production timing, not the exact model name.',
                'Country should be confirmed from Made in markings, label, or headstock details.',
            ],
            verificationTips: [
                'Check the back of the headstock for country-of-origin markings.',
                'Compare hardware, body shape, and finish against Dean import specs from the decoded year.',
                'Contact Dean support with photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a D-prefix Dean import format used by Asian manufacturing partners.</p><h3>How This Pattern Is Typically Read</h3><p>D is treated as an Asian partner factory code. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits}${monthName ? ` decode as ${monthName}` : ' are treated as a month or internal production code'}. The final digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Dean import prefix letters can vary by partner and production run.</li><li>This decode identifies likely production timing, not the exact model name.</li><li>Confirm country of origin from headstock, neck plate, label, or other physical markings.</li></ul>`,
    };
}
// Legacy Korea D-prefix import line (1990s World Music Instruments): D + YY + 4-digit sequence
function decodeLegacyKoreaD(serial) {
    const yearDigits = serial.substring(1, 3);
    const sequence = serial.substring(3);
    const year = 1900 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'World Music Instruments, Korea',
        country: 'South Korea',
        notes: `Legacy D-prefix Dean import format used at the World Music Instruments factory in Korea during the 1990s. Interpreted as D + YY + 4-digit sequence (no month encoded). Digits ${yearDigits} indicate production year ${year}; ${sequence} is the production sequence (unit ${sequenceNumber}). This shorter D-prefix format predates the modern D + YYMM + sequence Asian partner format used on later Dean imports. Verify with a Made in Korea headstock stamp and model features.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-legacy-korea-d-yy-sequence',
        patternLabel: 'Dean legacy Korea D-prefix YY sequence (no month)',
        additionalContext: {
            title: 'Dean legacy Korea D-prefix serial',
            summary: 'This serial matches a shorter 1990s D-prefix format used at the World Music Instruments factory in Korea, distinct from the modern D + YYMM + sequence import format.',
            highlights: [
                'D identifies World Music Instruments in Korea during the 1990s.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber} — no month is encoded in this shorter format.`,
            ],
            caveats: [
                'This 6-digit D-prefix format is distinct from the modern 8-digit D + YYMM + sequence Dean import format.',
                'Dean import serials can be inconsistent across factories and eras.',
            ],
            verificationTips: [
                'Check the back of the headstock for a Made in Korea stamp.',
                'Compare hardware and model features against Dean Korea import catalogs from the 1990s.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a shorter 1990s D-prefix format used at the World Music Instruments factory in Korea, distinct from the modern D + YYMM + sequence import format.</p><h3>How This Pattern Is Typically Read</h3><p>D identifies World Music Instruments in Korea during the 1990s. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber} — no month is encoded in this shorter format.</p><h3>What To Verify</h3><ul><li>This 6-digit D-prefix format is distinct from the modern 8-digit D + YYMM + sequence Dean import format.</li><li>Check the back of the headstock for a Made in Korea stamp and compare against 1990s Dean Korea import catalogs.</li></ul>`,
    };
}
function decodeAsianPartnerP(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Asian partner import production line',
        country: 'China, South Korea, or Indonesia',
        notes: `P-prefix Dean import format interpreted as P + YYMM + production sequence. The P prefix identifies an Asian partner factory code; ${yearDigits} indicates ${year}; ${monthDigits} indicates ${monthName || 'an unverified month code'}; ${sequence} is production sequence ${sequenceNumber}. Verify country and exact model from headstock markings and catalog specs.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-asian-partner-p-yymm-sequence',
        patternLabel: 'Dean Asian partner P-prefix YYMM sequence',
        additionalContext: {
            title: 'Dean P-prefix import serial',
            summary: 'This serial matches a P-prefix Dean import format used by Asian manufacturing partners.',
            highlights: [
                'P is treated as an Asian partner factory code.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                monthName ? `The digits ${monthDigits} decode as ${monthName}.` : `The digits ${monthDigits} are treated as a month or internal production code.`,
                `The final digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'Dean import prefix letters can vary by partner and production run.',
                'This decode identifies likely production timing, not the exact model name.',
                'Country should be confirmed from Made in markings, label, or headstock details.',
            ],
            verificationTips: [
                'Check the back of the headstock for country-of-origin markings.',
                'Compare hardware, body shape, and finish against Dean import specs from the decoded year.',
                'Contact Dean support with photos if exact factory confirmation is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a P-prefix Dean import format used by Asian manufacturing partners.</p><h3>How This Pattern Is Typically Read</h3><p>P is treated as an Asian partner factory code. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits}${monthName ? ` decode as ${monthName}` : ' are treated as a month or internal production code'}. The final digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Dean import prefix letters can vary by partner and production run.</li><li>Confirm country of origin from headstock, neck plate, label, or other physical markings.</li></ul>`,
    };
}
// Indonesia: IW prefix
function decodeIndonesiaIW(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    let monthName;
    if (month >= 1 && month <= 12) {
        monthName = getMonthName(month);
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Indonesia',
        country: 'Indonesia',
        notes: `IW prefix indicates Indonesian production. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Indonesia: CT prefix
function decodeIndonesiaCT(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    let monthName;
    if (month >= 1 && month <= 12) {
        monthName = getMonthName(month);
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Indonesia (CT factory)',
        country: 'Indonesia',
        notes: `CT prefix indicates Indonesian production. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Japan FujiGen: JF prefix
function decodeJapanFujiGen(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    if (yearNum >= 80 && yearNum <= 99) {
        year = `19${yearDigits}`;
    }
    else if (yearNum >= 0 && yearNum <= 30) {
        year = `20${yearDigits.padStart(2, '0')}`;
    }
    else {
        year = `Possibly 19${yearDigits} or 20${yearDigits}`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: 'FujiGen Gakki',
        country: 'Japan',
        notes: `JF prefix indicates FujiGen factory in Japan. FujiGen is known for high-quality production. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// India JI/JL prefix: JI or JL + YY + 5-digit sequence
function decodeIndiaJIL(serial) {
    const factoryLetter = serial[1];
    const yearDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Indian production facility',
        country: 'India',
        notes: `JI/JL prefix indicates Indian factory production. The letter "${factoryLetter}" identifies the factory or production line; ${yearDigits} indicates year ${year}; ${sequence} is the production sequence (unit ${sequenceNumber}). Dean introduced Indian-made budget lines in the early 2010s.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-india-jil-yy-sequence',
        patternLabel: 'Dean India JI/JL-prefix YY sequence format',
        additionalContext: {
            title: 'Dean India JI/JL-prefix serial',
            summary: 'This serial matches the JI/JL prefix format used on Indian-made Dean guitars.',
            highlights: [
                `The prefix J${factoryLetter} indicates Indian factory production.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'Indian-made Dean guitars are primarily entry-level and mid-range import instruments.',
                'Country of origin should be confirmed from headstock or neck label markings.',
            ],
            verificationTips: [
                'Check the back of the headstock or a neck label for "Made in India".',
                'Compare hardware and finish against Dean import catalog for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the JI/JL prefix format used on Indian-made Dean guitars.</p><h3>How This Pattern Is Typically Read</h3><p>The prefix J${factoryLetter} indicates Indian factory production. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock or a neck label for "Made in India".</li><li>Indian-made Dean guitars are primarily entry-level and mid-range import instruments.</li></ul>`,
    };
}
// Japan: J prefix
function decodeJapanJ(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    if (yearNum >= 80 && yearNum <= 99) {
        year = `19${yearDigits}`;
    }
    else if (yearNum >= 0 && yearNum <= 30) {
        year = `20${yearDigits.padStart(2, '0')}`;
    }
    else {
        year = `Possibly 19${yearDigits} or 20${yearDigits}`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: 'Japan (possibly FujiGen or similar)',
        country: 'Japan',
        notes: `J prefix indicates Japanese production (possibly FujiGen or China in some cases). Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Samick Korea: S prefix (1993-1996)
function decodeSamickWorldSW(serial) {
    const yearDigits = serial.substring(2, 4);
    const monthDigits = serial.substring(4, 6);
    const sequence = serial.substring(6);
    const yearNum = parseInt(yearDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const monthNum = parseInt(monthDigits, 10);
    const month = monthNum >= 1 && monthNum <= 12 ? getMonthName(monthNum) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year,
        month,
        factory: 'Samick World Musical Instruments Co. Ltd (SW)',
        country: 'South Korea',
        notes: `SW-prefix Dean import serial. SW identifies the Samick World Musical Instruments facility in Korea. Year digits ${yearDigits} decode as ${year}. Month digits ${monthDigits} decode as ${month || 'the production month'}. Unit sequence: ${sequenceNumber}. Samick World produced Dean import models throughout the 2000s and early 2010s.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-sw-samick-world-yymm-sequence',
        patternLabel: 'Dean SW Samick World Korea YYMM sequence',
        additionalContext: {
            title: 'Dean SW Samick World Korea serial',
            summary: 'This serial uses the Dean SW-prefix format identifying a guitar built at the Samick World Musical Instruments facility in Korea.',
            highlights: [
                'SW identifies the Samick World Musical Instruments production facility in South Korea.',
                `Year digits ${yearDigits} decode as ${year}.`,
                month ? `Month digits ${monthDigits} decode as ${month}.` : `Month digits ${monthDigits} are the production month code.`,
                `Unit production sequence: ${sequenceNumber}.`,
            ],
            caveats: [
                'The serial identifies the factory and production date; the exact model must be confirmed from the headstock markings and body specs.',
                'Samick World produced Dean import models across multiple body shapes — the serial alone does not identify the model.',
            ],
            verificationTips: [
                'Check the back of the headstock for a Made in Korea stamp.',
                'Confirm the model (Z-shape, ML, V, Razorback, etc.) from body shape, pickups, and headstock markings.',
                `Compare the model against Dean import catalog specs for ${year}.`,
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial uses the Dean SW-prefix format for guitars built at the Samick World Musical Instruments facility in South Korea. SW + two-digit year + two-digit month + production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>Year digits ${yearDigits} decode as ${year}. Month digits ${monthDigits} decode as ${month || 'the production month'}. Unit sequence: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for a Made in Korea stamp.</li><li>Confirm the model from body shape, pickups, and headstock markings.</li><li>Compare against Dean import catalog specs for ${year}.</li></ul>`,
    };
}
function decodeSamickKorea(serial) {
    const digits = serial.substring(1);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: '1993-1996 (exact year uncertain)',
        factory: 'Samick',
        country: 'South Korea',
        notes: `S prefix indicates Samick factory in Korea, used from 1993-1996. Serial number format from this era does not reliably encode the year. Production number: ${digits}.`,
    };
    return { success: true, info };
}
// China: O prefix
function decodeChinaO(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'China',
        country: 'China',
        notes: `O prefix indicates Chinese production. Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// Korea: W prefix (DBZ Bolero and others)
function decodeKoreaW(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const sequence = digits.substring(2);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Korea',
        country: 'South Korea',
        notes: `W prefix indicates Korean production (often seen on DBZ Bolero models). Production sequence: ${sequence}.`,
    };
    return { success: true, info };
}
// India import line: H prefix
// Typical pattern: H + YYMM + sequence (variable sequence length in the wild)
function decodeIndiaH(serial) {
    const digits = serial.substring(1);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.length >= 4 ? digits.substring(2, 4) : '';
    const sequence = digits.length > 4 ? digits.substring(4) : '';
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = monthDigits ? parseInt(monthDigits, 10) : NaN;
    let year;
    if (!Number.isNaN(yearNum)) {
        const fullYear = 2000 + yearNum;
        if (fullYear <= new Date().getFullYear()) {
            year = fullYear.toString();
        }
        else if (yearNum >= 80) {
            year = (1900 + yearNum).toString();
        }
        else {
            year = `20${yearDigits}`;
        }
    }
    const month = !Number.isNaN(monthNum) && monthNum >= 1 && monthNum <= 12
        ? getMonthName(monthNum)
        : undefined;
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year,
        month,
        factory: 'India import production line',
        country: 'India',
        notes: `H prefix import format interpreted as H + YYMM + sequence. Parsed digits: ${digits}.${sequence ? ` Sequence: ${sequence}.` : ''} Spacing/hyphen differences are normalization variants of the same serial.`
    };
    return { success: true, info };
}
// USA-made: 7-digit format
function decodeUSA7Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    let notes;
    if (yearNum >= 77 && yearNum <= 85) {
        year = `19${yearDigits}`;
        notes = `USA-made Dean from the original Zelinsky era (1977-1985). These guitars were made in Evanston, IL (1976-1978) or Chicago (1979+). Production sequence: ${sequence}.`;
    }
    else if (yearNum >= 86 && yearNum <= 95) {
        // Tropical Music era - unreliable
        year = `Possibly 19${yearDigits} (uncertain)`;
        notes = `This serial number format suggests 19${yearDigits}, but guitars from 1986-1995 (Tropical Music era) have inconsistent serial numbers. Check if the serial is stamped on the last fret - if so, dating is unreliable. Production sequence: ${sequence}.`;
    }
    else if (yearNum >= 96 && yearNum <= 99) {
        year = `19${yearDigits}`;
        notes = `USA-made Dean from the Armadillo Enterprises era (1997+). Production returned to consistent serial numbering. Production sequence: ${sequence}.`;
    }
    else if (yearNum >= 0 && yearNum <= 30) {
        year = `20${yearDigits.padStart(2, '0')}`;
        notes = `USA-made Dean (Armadillo Enterprises era). 7-digit serials indicate USA production. Production sequence: ${sequence}.`;
    }
    else {
        year = `Unknown (first digits: ${yearDigits})`;
        notes = `7-digit format typically indicates USA production. First two digits (${yearDigits}) should indicate year. Production sequence: ${sequence}.`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: 'Dean USA',
        country: 'USA',
        notes: notes,
    };
    return { success: true, info };
}
// Czech Republic or USA: 5-6 digit format
function decode5or6Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const sequence = serial.substring(2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    let country;
    let factory;
    let notes;
    if (yearNum >= 97 && yearNum <= 99) {
        // Likely Czech Republic 1997-1999
        year = `19${yearDigits}`;
        country = 'Czech Republic (likely) or USA';
        factory = 'Strunal Schönbach (Czech Republic) or Dean USA';
        notes = `5-6 digit serial from 1997-2000 era. Dean guitars were made in Czech Republic during this period at Strunal Schönbach factory. These are sought after for their build quality. If marked "Made in USA" it's American; otherwise likely Czech. Production sequence: ${sequence}.`;
    }
    else if (yearNum === 0) {
        year = '2000';
        country = 'Czech Republic (likely) or USA';
        factory = 'Strunal Schönbach (Czech Republic) or Dean USA';
        notes = `5-6 digit serial from ~2000. Could be Czech Republic production (phased out early 2000s) or USA. Production sequence: ${sequence}.`;
    }
    else if (yearNum >= 77 && yearNum <= 85) {
        year = `19${yearDigits}`;
        country = 'USA';
        factory = 'Dean USA (Evanston/Chicago)';
        notes = `Early USA-made Dean from the original Zelinsky era (1977-1985). Production sequence: ${sequence}.`;
    }
    else if (serial.length === 5) {
        year = 'Unknown (likely late 1990s-early 2000s Czech import or vintage USA, verify markings)';
        country = 'Czech Republic or USA';
        factory = 'Dean European Custom Select / Strunal Schönbach or Dean USA';
        notes = `5-digit numeric Dean serial treated as a sequential production number rather than a reliable embedded date. This format is seen on some Czech Republic European Custom Select instruments from the late 1990s to early 2000s, and can overlap visually with older USA Dean numeric stamps. Sequence/tracking number: ${parseInt(serial, 10)}. Check for "Handcrafted in the Czech Republic", "Made in USA", headstock markings, and model details before assigning a factory or year.`;
    }
    else if (yearNum >= 1 && yearNum <= 30) {
        year = `20${yearDigits}`;
        country = 'USA or Asian import';
        factory = 'Dean USA or Asian import facility';
        notes = `5-6 digit format. First two digits (${yearDigits}) interpreted as year 20${yearDigits}. Verify country of origin from "Made in" marking on the instrument. Production sequence: ${sequence}.`;
    }
    else {
        year = `Possibly 19${yearDigits} or 20${yearDigits}`;
        country = 'Unknown';
        factory = 'Unknown';
        notes = `5-6 digit format. First two digits (${yearDigits}) may indicate year. Could be Czech Republic (1997-2000), USA, or import. Check for "Made in" marking on instrument. Production sequence: ${sequence}.`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: factory,
        country: country,
        model: serial.length === 5 && !(yearNum >= 77 && yearNum <= 85) && !(yearNum >= 97 && yearNum <= 99)
            ? '5-digit numeric Dean format'
            : undefined,
        notes: notes,
    };
    if (serial.length === 5 && !(yearNum >= 77 && yearNum <= 85) && !(yearNum >= 97 && yearNum <= 99)) {
        return {
            success: true,
            info,
            patternKey: 'dean-five-digit-sequential-czech-or-usa',
            patternLabel: 'Dean 5-digit sequential Czech/USA ambiguous format',
            additionalContext: {
                title: 'Dean 5-digit numeric serial',
                summary: 'This serial matches a 5-digit Dean numeric format best treated as a sequential tracking number unless country markings provide more context.',
                highlights: [
                    `The full number ${serial} is treated as sequence/tracking number ${parseInt(serial, 10)}.`,
                    'This style can be seen on late-1990s to early-2000s Czech European Custom Select instruments.',
                    'A visually similar 5-digit numeric stamp can also appear on older USA Dean instruments.',
                ],
                caveats: [
                    'The digits do not reliably encode an exact year or month by themselves.',
                    'Do not assign Czech Republic or USA production from the serial alone.',
                    'Model, logo, country stamp, and construction details are required for confident identification.',
                ],
                verificationTips: [
                    'Look for Handcrafted in the Czech Republic or Made in USA near the serial or on the headstock.',
                    'Compare the body shape and hardware against Dean European Custom Select and vintage USA catalog examples.',
                    'Contact Dean support with photos if exact dating or authentication matters.',
                ],
            },
            additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 5-digit Dean numeric format best treated as a sequential tracking number unless country markings provide more context.</p><h3>How This Pattern Is Typically Read</h3><p>The full number ${serial} is treated as sequence/tracking number ${parseInt(serial, 10)}. This style can be seen on late-1990s to early-2000s Czech European Custom Select instruments, while visually similar 5-digit numeric stamps can also appear on older USA Dean instruments.</p><h3>What To Verify</h3><ul><li>The digits do not reliably encode an exact year or month by themselves.</li><li>Do not assign Czech Republic or USA production from the serial alone.</li><li>Check for Handcrafted in the Czech Republic, Made in USA, model markings, and period-correct construction details.</li></ul>`,
        };
    }
    return { success: true, info };
}
// General numeric format (various eras)
function decodeNumericGeneral(serial) {
    const length = serial.length;
    const yearDigits = serial.substring(0, 2);
    const yearNum = parseInt(yearDigits, 10);
    let year;
    let notes;
    if (length === 4) {
        // Very short - likely early production or Tropical era
        year = 'Unknown (short serial)';
        notes = `4-digit serial number. This format was used in various eras. If the serial is on the last fret rather than headstock, it's from the Tropical Music era (1986-1995) and cannot be reliably dated.`;
    }
    else if (length === 8) {
        // 8-digit without prefix - likely import
        if (yearNum >= 0 && yearNum <= 30) {
            year = `20${yearDigits.padStart(2, '0')}`;
        }
        else if (yearNum >= 80 && yearNum <= 99) {
            year = `19${yearDigits}`;
        }
        else {
            year = `Unknown (first digits: ${yearDigits})`;
        }
        notes = `8-digit numeric serial without letter prefix. First two digits (${yearDigits}) likely indicate year. This may be an import guitar - check for "Made in" marking.`;
    }
    else {
        if (yearNum >= 77 && yearNum <= 99) {
            year = `Possibly 19${yearDigits}`;
        }
        else if (yearNum >= 0 && yearNum <= 30) {
            year = `Possibly 20${yearDigits.padStart(2, '0')}`;
        }
        else {
            year = 'Unknown';
        }
        notes = `${length}-digit serial number. Dating is uncertain without additional context. If serial is on the last fret, it's from the Tropical Music era (1986-1995) and cannot be reliably dated.`;
    }
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year,
        factory: 'Unknown',
        country: 'Unknown (check "Made in" marking)',
        notes: notes,
    };
    return { success: true, info };
}
function decodeCortKoreaC(serial) {
    const yearDigits = serial.substring(1, 3);
    const batchDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort, Daejeon, South Korea',
        country: 'South Korea',
        notes: `C prefix identifies the Cort/Cor-Tek facility in Daejeon, South Korea. Format: C + YY + batch + sequence. The digits ${yearDigits} decode as production year ${year}. Batch code: ${batchDigits}. Production sequence: ${sequence}. Dean has used Cort as a manufacturing partner for many mid-range and import models.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-cort-korea-c-yy-batch-sequence',
        patternLabel: 'Dean Cort Korea C-prefix YY batch sequence',
    };
}
function decodeKHFactory(serial) {
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'KH overseas import factory (Korea or China)',
        country: 'South Korea or China',
        notes: `KH prefix identifies an overseas import factory (Korea or China). Format: KH + YY + MM + 5-digit sequence. Year digits ${yearDigits} decode as ${year}. Month digits ${monthDigits} decode as ${monthName || monthDigits}. Production sequence: ${sequence} (unit ${sequenceNumber}).`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-kh-factory-yymm-sequence',
        patternLabel: 'Dean KH factory YYMM sequence',
        additionalContext: {
            title: 'Dean KH-prefix serial',
            summary: `This serial uses the KH-prefix format identifying an overseas import factory (Korea or China). Year ${year}, ${monthName || `month ${monthDigits}`}.`,
            highlights: [
                `KH prefix designates an overseas import manufacturing facility.`,
                `${yearDigits} decodes as production year ${year}.`,
                monthName ? `${monthDigits} decodes as ${monthName}.` : `${monthDigits} is the month code.`,
                `${sequence} is the production sequence number (unit ${sequenceNumber}).`,
            ],
            caveats: [
                'The specific KH factory (Korean or Chinese) is not publicly documented; the import country should be confirmed from headstock or inside-label markings.',
                'This format does not encode the exact model name.',
            ],
            verificationTips: [
                'Check the back of the headstock or inside the body for a Made in Korea or Made in China marking.',
                'Compare hardware and finish against Dean import catalog from the decoded year.',
                'Contact Dean support with photos if exact factory authentication is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial uses the KH-prefix format, which identifies an overseas import manufacturing facility for Dean guitars. The specific factory is either in South Korea or China.</p><h3>How It Decodes</h3><p>KH identifies the import factory. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${monthName || 'the production month'}. The final five digits ${sequence} are the production sequence (unit ${sequenceNumber}).</p><h3>Coal Creek Guitars Note</h3><p>Verify the country of manufacture from the headstock or inside-label markings. Compare the serial format and hardware against Dean's import catalog for ${year} to confirm model identification.</p>`,
    };
}
// World factory numeric-prefix: [digit]W + YYMM + sequence
function decodeWorldNumericPrefixYYMM(serial) {
    const batchCode = serial[0];
    const digits = serial.substring(2);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: `World Musical Instruments Co Ltd (batch ${batchCode})`,
        country: 'South Korea',
        notes: `Numeric-prefix World factory format (${batchCode}W + YYMM + sequence). The leading digit "${batchCode}" identifies a production batch at World Musical Instruments in South Korea. ${yearDigits} decodes as production year ${year}; ${monthDigits} decodes as ${monthName || 'the production month'}; ${sequence} is the production sequence (unit ${sequenceNumber}).`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-world-numeric-prefix-yymm-sequence',
        patternLabel: 'Dean World factory numeric-prefix YYMM sequence',
        additionalContext: {
            title: 'Dean numeric-prefix World factory serial',
            summary: `This serial uses a numeric-prefix World factory format: a leading batch digit, then W, then YYMM, then sequence. Manufactured at World Musical Instruments Co Ltd in South Korea.`,
            highlights: [
                `The leading digit "${batchCode}" identifies a production batch at World Musical Instruments Co Ltd.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                monthName ? `The digits ${monthDigits} decode as ${monthName}.` : `The digits ${monthDigits} are the month code.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'The leading digit is a batch identifier at the World factory, not a standalone year.',
                'This format does not encode the exact model name.',
            ],
            verificationTips: [
                'Check the back of the headstock for a Made in Korea stamp.',
                'Compare hardware and finish against Dean Korea import catalog from the decoded year.',
                'Contact Dean support with photos if exact factory authentication is needed.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial uses a numeric-prefix World factory format where the leading digit identifies a production batch at World Musical Instruments Co Ltd in South Korea.</p><h3>How This Pattern Is Typically Read</h3><p>The leading digit "${batchCode}" identifies a production batch at World Musical Instruments. The digits ${yearDigits} decode as production year ${year}. The digits ${monthDigits} decode as ${monthName || 'the production month'}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for a Made in Korea stamp.</li><li>Compare hardware and finish against Dean Korea import catalog from the decoded year.</li><li>Contact Dean support with photos if exact factory authentication is needed.</li></ul>`,
    };
}
function decodeUSACustomShop(serial) {
    const yearDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Dean USA Custom Shop, Tampa, Florida',
        country: 'United States',
        notes: `USA prefix confirms hand-crafted production at the Dean USA Custom Shop in Tampa, Florida. Year: ${year}. Production sequence: ${parseInt(sequence, 10)}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-usa-custom-shop-yy-sequence',
        patternLabel: 'Dean USA Custom Shop YY + sequence',
    };
}
function decodeKoreanImportK(serial) {
    const yearDigits = serial.substring(1, 3);
    const monthDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'Asian contracted facility (K-prefix)',
        country: 'South Korea',
        notes: `K prefix indicates an Asian contracted facility used by Dean for import production. Year: ${year}. Month: ${monthName ?? monthDigits}. Sequence: ${parseInt(sequence, 10)}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-k-prefix-asian-import-yymm-sequence',
        patternLabel: 'Dean K-prefix Asian import YYMM + sequence',
    };
}
// WSM factory (World Sound Music / Yeou Chern Instruments, China)
// Serial format: WSM + YY(2) + MM(2) + batch-letter + 2-digit batch-seq [+ optional unit]
function decodeWSMFactory(serial) {
    const suffix = serial.substring(3);
    const yearDigits = suffix.substring(0, 2);
    const monthDigits = suffix.substring(2, 4);
    const batchCode = suffix.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = month >= 1 && month <= 12 ? getMonthName(month) : undefined;
    const info = {
        brand: 'Dean',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'World Sound Music (Yeou Chern Instruments)',
        country: 'China',
        notes: `WSM prefix identifies the World Sound Music factory (also known as Yeou Chern Instruments), a major Chinese OEM producer for Dean import lines such as the Vendetta XM. Year: ${year}. Month: ${monthName ?? monthDigits}. Batch/sequence code: ${batchCode}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'dean-wsm-china-yymm-batch-sequence',
        patternLabel: 'Dean WSM (World Sound Music) China YYMM + batch',
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
