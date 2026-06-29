export function decodeFender(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // US prefix (2010+): US + 2 digit year + sequence
    const usMatch = normalized.match(/^US(\d{2})(\d+)$/);
    if (usMatch) {
        return decodeUSPrefix(usMatch[1], usMatch[2], normalized);
    }
    // DZ prefix (American Deluxe 2000s)
    const dzMatch = normalized.match(/^DZ(\d)(\d+)$/);
    if (dzMatch) {
        return decodeDZPrefix(dzMatch[1], dzMatch[2], normalized);
    }
    // Z prefix (2000s)
    const zMatch = normalized.match(/^Z(\d)(\d+)$/);
    if (zMatch) {
        return decodeZPrefix(zMatch[1], zMatch[2], normalized);
    }
    // N prefix (1990s)
    const nMatch = normalized.match(/^N(\d)(\d+)$/);
    if (nMatch) {
        return decodeNPrefix(nMatch[1], nMatch[2], normalized);
    }
    // E prefix (1980s)
    const eMatch = normalized.match(/^E(\d)(\d+)$/);
    if (eMatch) {
        return decodeEPrefix(eMatch[1], eMatch[2], normalized);
    }
    // S prefix (1970s)
    const sMatch = normalized.match(/^S(\d)(\d+)$/);
    if (sMatch) {
        return decodeSPrefix(sMatch[1], sMatch[2], normalized);
    }
    // Mexican formats
    // MX prefix (2010+)
    const mxMatch = normalized.match(/^MX(\d{2})(\d+)$/);
    if (mxMatch) {
        return decodeMXPrefix(mxMatch[1], mxMatch[2], normalized);
    }
    // MZ prefix (2000s Mexico)
    const mzMatch = normalized.match(/^MZ(\d)(\d+)$/);
    if (mzMatch) {
        return decodeMZPrefix(mzMatch[1], mzMatch[2], normalized);
    }
    // MN prefix (1990s Mexico)
    const mnMatch = normalized.match(/^MN(\d)(\d+)$/);
    if (mnMatch) {
        return decodeMNPrefix(mnMatch[1], mnMatch[2], normalized);
    }
    // Japanese formats
    // JFF prefix (2019+ Japan "Superstrats" and modern production)
    // Format: JFF + letter (month/factory) + 2-digit year + sequence
    const jffMatch = normalized.match(/^JFF([A-Z])(\d{2})(\d+)$/);
    if (jffMatch) {
        return decodeJFFPrefix(jffMatch[1], jffMatch[2], jffMatch[3], normalized);
    }
    // JD prefix (modern Japan production, ~2012+): JD + 8 digits
    const jdMatch = normalized.match(/^JD(\d{2})(\d{6})$/);
    if (jdMatch) {
        return decodeJDPrefix(jdMatch[1], jdMatch[2], normalized);
    }
    // JV prefix (early 1980s Japan)
    const jvMatch = normalized.match(/^JV(\d+)$/);
    if (jvMatch) {
        return decodeJVPrefix(jvMatch[1], normalized);
    }
    // Single J prefix (Japan)
    const jMatch = normalized.match(/^J(\d+)$/);
    if (jMatch) {
        return decodeJPrefix(jMatch[1], normalized);
    }
    // A, B, C, etc prefixes for Japan (CIJ era)
    const japanLetterMatch = normalized.match(/^([A-H])(\d+)$/);
    if (japanLetterMatch) {
        return decodeJapanLetterPrefix(japanLetterMatch[1], japanLetterMatch[2], normalized);
    }
    // V prefix (American Vintage Reissue)
    const vMatch = normalized.match(/^V(\d+)$/);
    if (vMatch) {
        return decodeVPrefix(vMatch[1], normalized);
    }
    // Korean formats (KO prefix or just K)
    const koMatch = normalized.match(/^K[O]?(\d+)$/);
    if (koMatch) {
        return decodeKoreanPrefix(koMatch[1], normalized);
    }
    // Indonesian formats (IC, ICS prefixes)
    const indoMatch = normalized.match(/^I(?:CS|C|S)?(\d{2})(\d+)$/);
    if (indoMatch) {
        return decodeIndonesianPrefix(indoMatch[1], indoMatch[2], normalized);
    }
    // Grand Reward China factory for Squier: CGS + YY + 5-digit sequence (e.g. CGS0928207 = 2009)
    // C = China, G = Grand Reward factory, S = Squier brand line
    if (/^CGS\d{7}$/.test(normalized)) {
        return decodeCGSSquierGrandReward(normalized);
    }
    // Cort China factory for Fender/Squier: CC + YY + 7-digit sequence (e.g. CC210709447 = 2021)
    if (/^CC\d{9}$/.test(normalized)) {
        return decodeCortChinaCC(normalized);
    }
    // Fender internal part-number style: 00 + 8 digits (not date-coded serial)
    if (/^00\d{8}$/.test(normalized)) {
        return decodeInternalPartNumber(normalized);
    }
    // Vintage 5-6 digit serials (pre-1976)
    if (/^\d{5,6}$/.test(normalized)) {
        return decodeVintageFender(normalized);
    }
    // Some Fender Japan acoustics from the mid-1980s use a plain 7-digit label number
    // rather than a later standardized Fender serial. These usually cannot be fully decoded,
    // but they still carry useful production clues.
    if (/^\d{7}$/.test(normalized)) {
        return decodeJapanAcousticLabelNumber(normalized);
    }
    // 4 digit serials (very early)
    if (/^\d{4}$/.test(normalized)) {
        return decodeEarlyVintage(normalized);
    }
    return {
        success: false,
        error: 'Unrecognized Fender serial number format. Fender serials typically start with a letter prefix (US, MX, S, E, N, Z, J, etc.) followed by digits.'
    };
}
function decodeUSPrefix(year, sequence, serial) {
    const fullYear = '20' + year;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: fullYear,
        factory: 'Corona, California',
        country: 'USA',
        notes: `US prefix indicates American-made Fender (2010 or later). Production sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeJapanAcousticLabelNumber(serial) {
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: '1984-1987 (NOT DEFINITIVE)',
        factory: 'Fender Japan acoustic production / FujiGen-era label format',
        country: 'Japan',
        model: 'Fender Japan acoustic (Gemini-era possible)',
        notes: 'This 7-digit number does not match the later standardized Fender serial formats. ' +
            'On many Fender Japan acoustics from the mid-1980s, a plain 7-digit number on the paper label is a production or batch-style label number rather than a traceable Fender serial. ' +
            'That means the exact year and model usually cannot be confirmed from the number alone, but it is commonly associated with mid-1980s Fender Japan acoustics, including Gemini-era instruments. ' +
            'Use the interior label wording, headstock logo style, and country-of-origin markings to narrow the exact model.',
    };
    return { success: true, info };
}
function decodeDZPrefix(yearDigit, sequence, serial) {
    const year = '200' + yearDigit;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year,
        factory: 'Corona, California',
        country: 'USA',
        model: 'American Deluxe Series',
        notes: `DZ prefix indicates American Deluxe Series from the 2000s. Production sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeZPrefix(yearDigit, sequence, serial) {
    const year = '200' + yearDigit;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year,
        factory: 'Corona, California',
        country: 'USA',
        notes: `Z prefix indicates USA production (2000-2009). Typically American Standard or regular production models. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeNPrefix(yearDigit, sequence, serial) {
    const year = '199' + yearDigit;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year,
        factory: 'Corona, California',
        country: 'USA',
        notes: `N prefix indicates USA production (1990s). Production sequence: ${sequence}. Note: Some Japanese Fenders also used N prefix - check for "Made in Japan" marking.`
    };
    return { success: true, info };
}
function decodeEPrefix(yearDigit, sequence, serial) {
    const year = '198' + yearDigit;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year,
        factory: 'Corona, California (or Fullerton pre-1985)',
        country: 'USA',
        notes: `E prefix indicates USA production (1980s). Production sequence: ${sequence}. Note: Some Japanese Fenders also used E prefix - check for country of origin marking.`
    };
    return { success: true, info };
}
function decodeSPrefix(yearDigit, sequence, serial) {
    const year = '197' + yearDigit;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year,
        factory: 'Fullerton, California',
        country: 'USA',
        notes: `S prefix indicates USA production (late 1970s). Production sequence: ${sequence}. This was during the CBS ownership era.`
    };
    return { success: true, info };
}
function decodeMXPrefix(year, sequence, serial) {
    const fullYear = '20' + year;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: fullYear,
        factory: 'Ensenada',
        country: 'Mexico',
        notes: `MX prefix indicates Mexican production (2010 or later). Production sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeMZPrefix(yearDigit, sequence, serial) {
    const year = '200' + yearDigit;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year,
        factory: 'Ensenada',
        country: 'Mexico',
        notes: `MZ prefix indicates Mexican production (2000s). Production sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeMNPrefix(yearDigit, sequence, serial) {
    const year = '199' + yearDigit;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year,
        factory: 'Ensenada',
        country: 'Mexico',
        notes: `MN prefix indicates Mexican production (1990s). Mexico production began in 1990. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeJFFPrefix(letter, year, sequence, serial) {
    const fullYear = '20' + year;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: fullYear,
        factory: 'Japan',
        country: 'Japan',
        notes: `JFF prefix was adopted by Fender Japan starting in 2019 for specific modern production lines, often referred to as "Superstrats". The fourth letter "${letter}" may indicate the month of production or specific factory within the Japanese manufacturing network. Production sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeJDPrefix(yearDigits, sequence, serial) {
    const fullYear = `20${yearDigits}`;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: fullYear,
        factory: 'Dyna Gakki / Fender Japan network',
        country: 'Japan',
        notes: `JD prefix indicates modern Japanese Fender production (commonly seen from around 2012 onward). Parsed as JD + YY + sequence. Year: ${fullYear}. Production sequence: ${sequence}. Confirm exact plant from model documentation and markings.`,
    };
    return { success: true, info };
}
function decodeJVPrefix(sequence, serial) {
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: '1982-1984',
        factory: 'FujiGen Gakki',
        country: 'Japan',
        notes: `JV prefix indicates early Japanese production (1982-1984). These were high-quality instruments made at FujiGen. Production sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeJPrefix(sequence, serial) {
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: '1980s',
        factory: 'FujiGen Gakki',
        country: 'Japan',
        notes: `J prefix indicates Japanese production from the 1980s. Production sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeJapanLetterPrefix(letter, sequence, serial) {
    // Japanese letter prefixes used in different eras
    const letterYears = {
        'A': '1985-1986, or 1997-1998 (CIJ)',
        'B': '1985-1986, or 1997-1998 (CIJ)',
        'C': '1985-1986, or 1997-1998 (CIJ)',
        'D': '1986 (MIJ)',
        'E': '1984-1987 (MIJ)',
        'F': '1986-1987 (MIJ)',
        'G': '1987-1988 (MIJ)',
        'H': '1988-1989 (MIJ)',
    };
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: letterYears[letter] || 'Mid-1980s to 1990s',
        factory: 'FujiGen Gakki or other Japanese factory',
        country: 'Japan',
        notes: `Letter prefix ${letter} was used on Japanese Fenders. Check for "Made in Japan" (MIJ) or "Crafted in Japan" (CIJ) labels to narrow the date. Production sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeVPrefix(sequence, serial) {
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: 'Various (AVRI series)',
        factory: 'Corona, California',
        country: 'USA',
        model: 'American Vintage Reissue (AVRI)',
        notes: `V prefix indicates American Vintage Reissue series. These serials do not directly correlate to production year. Other features or date stamps should be checked for accurate dating. Sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeKoreanPrefix(sequence, serial) {
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: '1980s-1990s (approximate)',
        factory: 'Korean Factory (Cort, Samick, or other)',
        country: 'South Korea',
        notes: `Korean-made Fender (Squier or budget models). Production sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeIndonesianPrefix(year, sequence, serial) {
    const fullYear = '20' + year;
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: fullYear,
        factory: 'Indonesian Factory (Cort or other)',
        country: 'Indonesia',
        notes: `Indonesian-made Fender (typically Squier line). Production sequence: ${sequence}.`
    };
    return { success: true, info };
}
function decodeCGSSquierGrandReward(serial) {
    const yearDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Grand Reward Musical Instruments, China',
        country: 'China',
        model: 'Squier (CGS prefix)',
        notes: `CGS-prefix serial identifies a Squier instrument made at the Grand Reward factory in China. C = China, G = Grand Reward factory, S = Squier brand. Year code ${yearDigits} decodes as ${year}. Production sequence: ${sequenceNumber}. Instruments with this prefix are typically Squier Classic Vibe or related China-built Squier models. Verify the model and branding from the headstock logo.`,
    };
    return {
        success: true,
        info,
        patternKey: 'fender-squier-cgs-grand-reward-china-yy-sequence',
        patternLabel: 'Fender/Squier Grand Reward China CGS-prefix YY sequence',
        additionalContext: {
            title: 'Squier Grand Reward China (CGS-prefix) serial',
            summary: `This serial uses the CGS-prefix format: C=China, G=Grand Reward factory, S=Squier. Year ${year}, sequence ${sequenceNumber}.`,
            highlights: [
                'CGS: C=China, G=Grand Reward factory, S=Squier brand line.',
                `Year code ${yearDigits} decodes as ${year}.`,
                `Production sequence: unit ${sequenceNumber}.`,
                'Associated with Squier Classic Vibe and related China-built Squier models from this era.',
            ],
            caveats: [
                'CGS is a Squier prefix, not a Fender USA prefix — the headstock should say Squier.',
                'A CGS serial on a guitar with a Fender (not Squier) headstock is a counterfeit warning sign.',
                'Some Fender Modern Player China-built instruments use a CGF prefix (F=Fender) rather than CGS.',
            ],
            verificationTips: [
                'Verify the headstock reads Squier, not Fender.',
                'Check the back of the headstock for a Made in China stamp.',
                'Compare the model, hardware, and finish against Squier Classic Vibe catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial uses the CGS-prefix format identifying a Squier instrument made at the Grand Reward factory in China: C=China, G=Grand Reward, S=Squier.</p><h3>How It Decodes</h3><p>Year code ${yearDigits} decodes as ${year}. Production sequence: ${sequenceNumber}. This format is associated with Squier Classic Vibe and related Squier models manufactured at Grand Reward in China.</p><h3>What To Verify</h3><ul><li>Verify the headstock reads Squier — CGS is a Squier prefix, and a Fender logo with a CGS serial is a counterfeit red flag.</li><li>Check the back of the headstock for a Made in China marking.</li><li>Compare the model against Squier Classic Vibe catalog specs for ${year}.</li></ul>`,
    };
}
function decodeCortChinaCC(serial) {
    const yearDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cort, China (CC factory prefix)',
        country: 'China',
        notes: `CC-prefix serial identifies a Cort China factory instrument made for Fender or Squier. Format: CC + YY (production year) + 7-digit sequence. Year code ${yearDigits} decodes as ${year}. Production sequence: ${sequence} (unit ${sequenceNumber}).`,
    };
    return {
        success: true,
        info,
        patternKey: 'fender-cc-cort-china-yy-sequence',
        patternLabel: 'Fender/Squier Cort China CC-prefix YY sequence',
        additionalContext: {
            title: 'Fender/Squier Cort China (CC-prefix) serial',
            summary: `This serial uses the CC-prefix format identifying a Cort China factory instrument produced for Fender or Squier. CC = Cort China, ${yearDigits} = ${year}.`,
            highlights: [
                'CC prefix indicates the Cort manufacturing facility in China.',
                `${yearDigits} decodes as production year ${year}.`,
                `${sequence} is the production sequence number (unit ${sequenceNumber}).`,
            ],
            caveats: [
                'Cort China produces instruments for multiple brands; the exact model should be confirmed from headstock and label markings.',
                'This format is used on both Fender and Squier branded instruments from this factory.',
            ],
            verificationTips: [
                'Check the back of the headstock for "Made in China" and the Fender or Squier brand name.',
                'Compare hardware, finish, and specs against Fender/Squier China import catalog from the decoded year.',
                'Use the Fender serial number lookup tool to cross-reference this serial against indexed records.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial uses the CC-prefix format, identifying an instrument produced at the Cort manufacturing facility in China for Fender or its Squier sub-brand.</p><h3>How It Decodes</h3><p>CC identifies the Cort China factory. The digits ${yearDigits} decode as production year ${year}. The remaining seven digits (${sequence}) are the production sequence number (unit ${sequenceNumber}).</p><h3>Coal Creek Guitars Note</h3><p>Verify the brand (Fender or Squier) and model from the headstock and any interior labels. Compare the decoded year (${year}) against the catalog to confirm model specifications.</p>`,
    };
}
function decodeInternalPartNumber(serial) {
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        model: 'Internal Fender part number (not date-coded serial)',
        notes: `10-digit numeric value beginning with "00" is commonly an internal Fender part/product identifier (for example on replacement components) rather than a standard date-coded guitar serial number. Use model markings, neck stamps, and component details for dating.`
    };
    return { success: true, info };
}
function decodeVintageFender(serial) {
    const num = parseInt(serial, 10);
    let year = 'Pre-1976';
    let notes = '';
    // Rough serial ranges for vintage Fenders
    if (num < 10000) {
        year = '1950-1954';
        notes = 'Early Fender production. These serials were on the bridge plate or neck plate.';
    }
    else if (num < 20000) {
        year = '1954-1956';
        notes = 'Mid-1950s production.';
    }
    else if (num < 50000) {
        year = '1956-1959';
        notes = 'Late 1950s production.';
    }
    else if (num < 100000) {
        year = '1959-1963';
        notes = 'Early 1960s production. The golden era of Fender.';
    }
    else if (num < 200000) {
        year = '1963-1965';
        notes = 'Pre-CBS era (CBS acquired Fender in January 1965).';
    }
    else if (num < 300000) {
        year = '1965-1969';
        notes = 'Early CBS era.';
    }
    else if (num < 400000) {
        year = '1969-1972';
        notes = 'CBS era production.';
    }
    else if (num < 600000) {
        year = '1972-1976';
        notes = 'CBS era. Serial numbering became less consistent during this period.';
    }
    else {
        year = '1970s';
        notes = 'Later CBS era. Consider checking neck date stamps for more accuracy.';
    }
    notes += ' Vintage Fender dating can be complex - neck dates, pot codes, and other features should be checked for verification.';
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year,
        factory: 'Fullerton, California',
        country: 'USA',
        notes
    };
    return { success: true, info };
}
function decodeEarlyVintage(serial) {
    const info = {
        brand: 'Fender',
        serialNumber: serial,
        year: '1950-1954 (approximate)',
        factory: 'Fullerton, California',
        country: 'USA',
        notes: 'Very early Fender production. Four-digit serials were used on the earliest Fender guitars. Dating requires examination of other features like pickups, hardware, and construction details.'
    };
    return { success: true, info };
}
