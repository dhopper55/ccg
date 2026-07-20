/**
 * Squier Guitar Serial Number Decoder
 *
 * Supports:
 * - Japan JV series (1982-1984) - FujiGen
 * - Japan SQ series (1983-1984) - FujiGen
 * - Japan E series (1984-1987) - FujiGen
 * - Japan Letter prefixes (A-U, 1985-2008) - FujiGen/Tokai/Dyna
 * - Korea S prefix (Samick, late 80s-90s)
 * - Korea E prefix (Young Chang, late 80s-90s)
 * - Korea M prefix (early 90s)
 * - Korea VN prefix (Sunghan, 1990s)
 * - Korea KC/KV prefixes (Cor-Tek/Sunghan, 2-digit year)
 * - Korea CN prefix (Cor-Tek)
 * - Korea numeric-only (first digit = year)
 * - Indonesia IC/ICF/ICO prefix (Cort)
 * - Indonesia ICS + YY prefix (Cort)
 * - Indonesia ICS + letter prefix (Cort, 2021+)
 * - Indonesia IS/ISS/SI prefix (Samick)
 * - China CY/YN prefix (Yako)
 * - China CXS/CA/CAE prefix (AXL)
 * - China CGS/CGR/CGT prefix (Grand Reward)
 * - China COB/COS prefix (Cor-Tek)
 * - China CSS prefix (Samick)
 * - China CYK + letter prefix (Yako, 2020+)
 * - China CRN + letter prefix (Re-New contracted facility, 2020+)
 * - China NC prefix (mid-90s)
 * - China SE Strat Pack numeric-only (9 digits, YYMM + sequence)
 * - Mexico MN prefix (1990s)
 * - Mexico MZ prefix (2000s)
 * - USA E prefix (1980s)
 * - USA N prefix (1990s)
 * - Leading "S/N" label prefix (stripped before decoding the underlying factory code)
 */
// Japan letter prefixes for Crafted in Japan (CIJ) era
const JAPAN_LETTER_YEARS = {
    'A': { years: '1997-1998', factory: 'Tokai/Dyna' },
    'B': { years: '1998-1999', factory: 'Tokai/Dyna' },
    'N': { years: '1995-1996', factory: 'Tokai/Dyna' },
    'O': { years: '1997-2000', factory: 'Tokai/Dyna' },
    'P': { years: '1999-2002', factory: 'Tokai/Dyna' },
    'Q': { years: '2002-2004', factory: 'Tokai/Dyna' },
    'R': { years: '2004-2006', factory: 'Tokai/Dyna' },
    'S': { years: '2006-2008', factory: 'Tokai/Dyna' },
    'T': { years: '2007-2008', factory: 'Tokai/Dyna' },
    'U': { years: '2008+', factory: 'Tokai/Dyna' },
};
// Month letter codes used in modern serials (2020+)
const MONTH_LETTERS = {
    'A': 'January',
    'B': 'February',
    'C': 'March',
    'D': 'April',
    'E': 'May',
    'F': 'June',
    'G': 'July',
    'H': 'August',
    'I': 'September',
    'J': 'October',
    'K': 'November',
    'L': 'December',
};
export function decodeSquier(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Strip a leading "S/N" (Serial Number) label — sometimes printed right next to the
    // actual factory code/serial rather than being part of it — and decode what remains.
    if (/^S\/N/.test(normalized)) {
        return decodeSquier(normalized.replace(/^S\/N/, ''));
    }
    // Japan JV prefix (1982-1984) - FujiGen, highly collectible
    if (/^JV\d{5,6}$/.test(normalized)) {
        return decodeJapanJV(normalized);
    }
    // Japan SQ prefix (1983-1984) - FujiGen
    if (/^SQ\d{5,6}$/.test(normalized)) {
        return decodeJapanSQ(normalized);
    }
    // Japan E prefix (1984-1987) - FujiGen (when Made in Japan marked)
    // Note: E prefix is also used for USA 1980s and Korea Young Chang
    if (/^E\d{6,7}$/.test(normalized)) {
        return decodeEPrefix(normalized);
    }
    // Japan letter prefixes A-U (1985-2008) - CIJ era
    const japanLetterMatch = normalized.match(/^([A-U])(\d{6,7})$/);
    if (japanLetterMatch && JAPAN_LETTER_YEARS[japanLetterMatch[1]]) {
        return decodeJapanLetter(japanLetterMatch[1], japanLetterMatch[2], normalized);
    }
    // K prefix: Japan MIJ era 1990-1991 (FujiGen Gakki) or early Korean production
    // K is not in the CIJ table (which starts at A=1997) but was used in the earlier MIJ/Squier Japan run.
    if (/^K\d{6,7}$/.test(normalized)) {
        return decodeJapanOrKoreaMIJK(normalized);
    }
    // Korea VN prefix (Sunghan, 1990s)
    if (/^VN\d{6,7}$/.test(normalized)) {
        return decodeKoreaVN(normalized);
    }
    // Korea KC prefix (Cor-Tek, 2-digit year)
    if (/^KC\d{8}$/.test(normalized)) {
        return decodeKoreaKC(normalized);
    }
    // Korea KV prefix (Sunghan, 2-digit year)
    if (/^KV\d{8}$/.test(normalized)) {
        return decodeKoreaKV(normalized);
    }
    // Korea CN prefix (Cor-Tek)
    if (/^CN\d{6,7}$/.test(normalized)) {
        return decodeKoreaCN(normalized);
    }
    // Korea S prefix (Samick)
    if (/^S\d{6,7}$/.test(normalized)) {
        return decodeKoreaS(normalized);
    }
    // Korea M prefix (early 90s)
    if (/^M\d{7}$/.test(normalized)) {
        return decodeKoreaM(normalized);
    }
    // Indonesia ICS + YY prefix (Cort)
    const icsYearMatch = normalized.match(/^ICS(\d{2})(\d+)$/);
    if (icsYearMatch) {
        return decodeIndonesiaICSYear(icsYearMatch[1], icsYearMatch[2], normalized);
    }
    // Indonesia ICS + letter prefix (Cort, 2021+)
    const icsMatch = normalized.match(/^ICS([A-L])(\d{2})(\d+)$/);
    if (icsMatch) {
        return decodeIndonesiaICS(icsMatch[1], icsMatch[2], icsMatch[3], normalized);
    }
    // Indonesia IC/ICF/ICO prefix (Cort)
    const icMatch = normalized.match(/^IC[FO]?(\d{2})(\d+)$/);
    if (icMatch) {
        return decodeIndonesiaIC(icMatch[1], icMatch[2], normalized);
    }
    // Indonesia ISS + month-letter prefix (Samick, 2020+ format: ISS + month-letter + YY + seq)
    const issLetterMatch = normalized.match(/^ISS([A-L])(\d{2})(\d+)$/);
    if (issLetterMatch) {
        return decodeIndonesiaISSLetter(issLetterMatch[1], issLetterMatch[2], issLetterMatch[3], normalized);
    }
    // Indonesia ISS prefix (Samick)
    if (/^ISS\d{6}$/.test(normalized)) {
        return decodeIndonesiaISS(normalized);
    }
    // Indonesia IS prefix (Samick)
    const isMatch = normalized.match(/^IS(\d{2})(\d+)$/);
    if (isMatch) {
        return decodeIndonesiaIS(isMatch[1], isMatch[2], normalized);
    }
    // Indonesia SI prefix (Samick)
    const siMatch = normalized.match(/^SI(\d{2})(\d+)$/);
    if (siMatch) {
        return decodeIndonesiaSI(siMatch[1], siMatch[2], normalized);
    }
    // China CMC prefix (Muse factory, 2020+ four-letter format: CMC + month-letter + YY + sequence)
    const cmcMatch = normalized.match(/^CMC([A-L])(\d{2})(\d+)$/);
    if (cmcMatch) {
        return decodeChinaCMC(cmcMatch[1], cmcMatch[2], cmcMatch[3], normalized);
    }
    // China CYK + letter or digit prefix (Yako, 2020+)
    const cykMatch = normalized.match(/^CYK([A-L0-9])(\d{2})(\d+)$/);
    if (cykMatch) {
        return decodeChinaCYK(cykMatch[1], cykMatch[2], cykMatch[3], normalized);
    }
    // China CSK prefix (SK contracted facility): CSK + YY + sequence
    if (/^CSK\d{8}$/.test(normalized)) {
        return decodeChinaCSK(normalized);
    }
    // China CWS prefix (WS contracted facility): CWS + YY + sequence
    if (/^CWS\d{7}$/.test(normalized)) {
        return decodeChinaCWS(normalized);
    }
    // China CRN + letter/digit prefix (Re-New contracted facility, 2020+: CRN + month-code + YY + sequence)
    // Month code is normally A-L (alphabetical), but some serials use a digit (e.g. '0' for January/October)
    const crnMatch = normalized.match(/^CRN([A-L0-9])(\d{2})(\d+)$/);
    if (crnMatch) {
        return decodeChinaCRN(crnMatch[1], crnMatch[2], crnMatch[3], normalized);
    }
    // China CSV + letter prefix (SV contracted facility, 2020+: CSV + month-letter + YY + sequence)
    // e.g. CSVH24000004 = August 2024, seq 000004; CSVH2400004 = August 2024, seq 00004
    const csvMatch = normalized.match(/^CSV([A-L])(\d{2})(\d+)$/);
    if (csvMatch) {
        return decodeChinaCSV(csvMatch[1], csvMatch[2], csvMatch[3], normalized);
    }
    // China CY prefix (Yako)
    const cyMatch = normalized.match(/^CY(\d{2})(\d+)$/);
    if (cyMatch) {
        return decodeChinaCY(cyMatch[1], cyMatch[2], normalized);
    }
    // China C prefix (Yako, early 2000s)
    const cChinaMatch = normalized.match(/^C(\d{2})(\d{4,6})$/);
    if (cChinaMatch) {
        return decodeChinaCSinglePrefix(cChinaMatch[1], cChinaMatch[2], normalized);
    }
    // China YN prefix (Yako)
    if (/^YN\d{5,7}$/.test(normalized)) {
        return decodeChinaYN(normalized);
    }
    // China CXS prefix (AXL)
    const cxsMatch = normalized.match(/^CXS(\d{2})(\d{2})(\d+)$/);
    if (cxsMatch) {
        return decodeChinaCXS(cxsMatch[1], cxsMatch[2], cxsMatch[3], normalized);
    }
    // China CA/CAE prefix (AXL)
    const caMatch = normalized.match(/^CAE?(\d{2})(\d+)$/);
    if (caMatch) {
        return decodeChinaCA(caMatch[1], caMatch[2], normalized);
    }
    // China CGS/CGR/CGT prefix (Grand Reward)
    const cgMatch = normalized.match(/^CG[SRT](\d{2})(\d+)$/);
    if (cgMatch) {
        return decodeChinaCG(cgMatch[1], cgMatch[2], normalized);
    }
    // China COB/COS prefix (Cor-Tek)
    const coMatch = normalized.match(/^CO[BS](\d{2})(\d+)$/);
    if (coMatch) {
        return decodeChinaCO(coMatch[1], coMatch[2], normalized);
    }
    // China CSS + month-letter prefix (Samick/Axl, 2020+): CSS + [A-L] + YY + sequence
    const cssLetterMatch = normalized.match(/^CSS([A-L])(\d{2})(\d+)$/);
    if (cssLetterMatch) {
        return decodeChinaCSSLetterMonth(cssLetterMatch[1], cssLetterMatch[2], cssLetterMatch[3], normalized);
    }
    // China CSS prefix (Samick) — older numeric-only format
    const cssMatch = normalized.match(/^CSS(\d{2})(\d+)$/);
    if (cssMatch) {
        return decodeChinaCSS(cssMatch[1], cssMatch[2], normalized);
    }
    // China NC prefix (mid-90s)
    if (/^NC\d{6}$/.test(normalized)) {
        return decodeChinaNC(normalized);
    }
    // Mexico MN prefix (1990s)
    const mnMatch = normalized.match(/^MN(\d)(\d+)$/);
    if (mnMatch) {
        return decodeMexicoMN(mnMatch[1], mnMatch[2], normalized);
    }
    // Mexico MZ prefix (2000s)
    const mzMatch = normalized.match(/^MZ(\d)(\d+)$/);
    if (mzMatch) {
        return decodeMexicoMZ(mzMatch[1], mzMatch[2], normalized);
    }
    // USA N prefix (1990s) - rare for Squier
    if (/^N\d{6,7}$/.test(normalized)) {
        return decodeUSAN(normalized);
    }
    // China Squier SE 10-digit numeric: YYMM + 6-digit sequence
    if (/^\d{10}$/.test(normalized)) {
        return decodeChinaSquierSE10Digit(normalized);
    }
    // China Squier SE / Strat Pack numeric-only format: YYMM + sequence
    if (/^\d{9}$/.test(normalized)) {
        return decodeChinaSquierSE9Digit(normalized);
    }
    // Korea numeric-only (6-7 digits, first digit = year)
    if (/^\d{6,7}$/.test(normalized)) {
        return decodeKoreaNumeric(normalized);
    }
    // Known 2004 China Squier SE / Strat Pack sticker format: YYMM + sequence
    if (/^04(0[1-9]|1[0-2])\d{4}$/.test(normalized)) {
        return decodeChinaSquierSE8Digit2004(normalized);
    }
    if (/^\d{8}$/.test(normalized)) {
        return {
            success: false,
            error: 'Unable to decode this Squier serial number. Eight-digit numeric-only Squier serials are not a standard supported pattern. Most Squier serials include a factory or country prefix such as IC, ICS, CY, CG, CO, MN, or MZ. Verify the number and check for a "Made in..." or "Crafted in..." label on the guitar.',
        };
    }
    return {
        success: false,
        error: 'Unable to decode this Squier serial number. The format was not recognized. Please verify the serial number is correct and check for a "Made in..." label on the guitar.',
    };
}
function decodeJapanJV(serial) {
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: '1982-1984',
        factory: 'FujiGen Gakki',
        country: 'Japan',
        notes: 'Legendary JV (Japanese Vintage) series. These early Squiers are highly collectible and considered equal or superior to American Fenders of the same era. Made at the renowned FujiGen factory.',
    };
    return { success: true, info };
}
function decodeJapanSQ(serial) {
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: '1983-1984',
        factory: 'FujiGen Gakki',
        country: 'Japan',
        notes: 'SQ series with 70s Reissue specifications. Made at the FujiGen factory in Japan. These are well-regarded vintage Squiers.',
    };
    return { success: true, info };
}
function decodeEPrefix(serial) {
    const yearDigit = serial[1];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `198${yearDigit}`,
        notes: 'E prefix guitars from this era could be: (1) Made in Japan at FujiGen (1984-1987), (2) Made in USA (rare), or (3) Made in Korea by Young Chang. Check the guitar for "Made in..." label to confirm origin.',
    };
    return { success: true, info };
}
function decodeJapanLetter(letter, sequence, serial) {
    const letterInfo = JAPAN_LETTER_YEARS[letter];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: letterInfo.years,
        factory: letterInfo.factory,
        country: 'Japan',
        notes: `Crafted in Japan (CIJ) era Squier. Letter prefix ${letter} indicates ${letterInfo.years} production at ${letterInfo.factory} factory.`,
    };
    return { success: true, info };
}
function decodeJapanOrKoreaMIJK(serial) {
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: '1990-1991',
        factory: 'FujiGen Gakki (Japan, MIJ era)',
        country: 'Japan',
        notes: `K-prefix Squier serial. The "K" prefix was primarily used by FujiGen Gakki in Japan for the Squier MIJ (Made in Japan) run circa 1990-1991, following Fender Japan's letter-year conventions. Some Korean Squier II production from 1987 or 1997 also used a K prefix — check the headstock for "Made in Japan" or "Made in Korea" to confirm origin. Confirm with neck-pocket markings or body label.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-japan-mij-k-prefix-sequence',
        patternLabel: 'Squier K-prefix Japan MIJ or Korea sequence',
        additionalContext: {
            title: 'Squier K-prefix serial (Japan MIJ or Korea)',
            summary: 'K-prefix Squiers are associated with Japanese MIJ production circa 1990-1991 (FujiGen) or early Korean production from 1987/1997.',
            highlights: [
                '"K" prefix identifies either Japan MIJ (FujiGen Gakki, 1990-1991) or Korean contracted production.',
                'FujiGen-built MIJ Squiers are among the most collectible and highest-quality Squier instruments.',
                'Check the headstock or neck heel for "Made in Japan" or "Made in Korea" to confirm origin.',
            ],
            caveats: [
                'Without a country-of-origin marking, exact factory attribution is uncertain.',
                'Squier serial number documentation from the late 1980s–early 1990s is incomplete in official records.',
            ],
            verificationTips: [
                'Look for "Made in Japan" or "Made in Korea" on the headstock, neck heel, or label.',
                'FujiGen-built MIJ Squiers typically have superior fretwork, fit, and finish compared to Korean imports.',
                'Unscrew the neck to check for a date stamp in the neck pocket (common on Japanese production).',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>The "K" prefix identifies either Japan MIJ production (FujiGen Gakki, circa 1990-1991) or early Korean contracted Squier production. Check the headstock or neck heel for "Made in Japan" or "Made in Korea" to confirm.</p><h3>What To Verify</h3><ul><li>Check the headstock or neck heel for "Made in Japan" or "Made in Korea".</li><li>FujiGen MIJ Squiers typically have very clean fretwork and Japanese-standard construction quality.</li><li>Unscrew the neck — Japanese factories frequently date-stamped the neck pocket.</li></ul>`,
    };
}
function decodeKoreaVN(serial) {
    const yearDigit = serial[2];
    const year = `199${yearDigit}`;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year,
        factory: 'Saehan/Sunghan',
        country: 'South Korea',
        notes: 'VN prefix indicates Korean production at the Saehan (also known as Sunghan) factory in the 1990s.',
    };
    return { success: true, info };
}
function decodeKoreaKC(serial) {
    const yearDigits = serial.substring(2, 4);
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cor-Tek (Cort)',
        country: 'South Korea',
        notes: 'KC prefix indicates Korean production at the Cor-Tek (Cort) factory.',
    };
    return { success: true, info };
}
function decodeKoreaKV(serial) {
    const yearDigits = serial.substring(2, 4);
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Saehan/Sunghan',
        country: 'South Korea',
        notes: 'KV prefix indicates Korean production at the Saehan/Sunghan factory.',
    };
    return { success: true, info };
}
function decodeKoreaCN(serial) {
    const yearDigit = serial[2];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit}`,
        factory: 'Cor-Tek (Cort)',
        country: 'South Korea',
        notes: 'CN prefix indicates Korean production at the Cor-Tek factory in the 1990s.',
    };
    return { success: true, info };
}
function decodeKoreaS(serial) {
    const yearDigit = serial[1];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `Late 1980s - early 1990s (digit ${yearDigit})`,
        factory: 'Samick',
        country: 'South Korea',
        notes: 'S prefix indicates Korean production at the Samick factory. Common in late 1980s and early 1990s.',
    };
    return { success: true, info };
}
function decodeKoreaM(serial) {
    const yearDigit = serial[1];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit}`,
        country: 'South Korea',
        notes: 'M prefix Korean Squiers from the early 1990s. These often featured high gloss maple necks and slimmer 40mm bodies made from plywood.',
    };
    return { success: true, info };
}
function decodeKoreaNumeric(serial) {
    const yearDigit = serial[0];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit}`,
        country: 'South Korea',
        notes: `Korean Squier with numeric-only serial. First digit (${yearDigit}) indicates the year 199${yearDigit}.`,
    };
    return { success: true, info };
}
// China Squier SE / Strat Pack 2004 sticker format: YYMM + sequence
function decodeChinaSquierSE8Digit2004(serial) {
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const year = 2004;
    const month = getMonthName(parseInt(monthDigits, 10));
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'China Strat Pack / SE production',
        country: 'China',
        model: 'Squier Strat SE (Special Edition)',
        notes: `8-digit numeric Squier serial interpreted as a 2004 Chinese Squier SE / Strat Pack sticker serial. Year: ${year}; month: ${month}; production sequence: ${sequence}. Verify with SE features such as the Squier Strat logo, full-thickness body, and a headstock sticker serial rather than a stamped neck plate.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-se-2004-8-digit-yymm-sequence',
        patternLabel: 'Squier China SE 2004 8-digit YYMM sequence format',
        additionalContext: {
            title: 'Squier SE 2004 numeric serial',
            summary: 'This serial matches a known 8-digit numeric sticker format associated with 2004 Chinese-made Squier SE Strat Pack guitars.',
            highlights: [
                'The first two digits decode as production year 2004.',
                `The next two digits decode as ${month}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'This is treated as a narrow 2004 SE / Strat Pack pattern, not as a general Squier numeric-only format.',
                'Many Squier SE serials were stickers and may be missing or replaced.',
                'Fender lookup coverage can be incomplete for budget Squier models from this era.',
            ],
            verificationTips: [
                'Look for a headstock that says Squier Strat rather than Squier Stratocaster.',
                'Check for a full-thickness body, commonly associated with the SE.',
                'Confirm the serial is on a headstock sticker and compare against known 2004 Strat Pack SE features.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a known 8-digit numeric sticker format associated with 2004 Chinese-made Squier SE Strat Pack guitars.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits decode as production year 2004. The next two digits decode as ${month}. The remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Look for a headstock that says Squier Strat rather than Squier Stratocaster.</li><li>Check for a full-thickness body, commonly associated with the SE.</li><li>Confirm the serial is on a headstock sticker and compare against known 2004 Strat Pack SE features.</li></ul>`,
    };
}
// China Squier SE 10-digit: YYMM + 6-digit sequence
function decodeChinaSquierSE10Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);
    const year = 2000 + yearNum;
    const month = getMonthName(monthNum);
    const currentYear = new Date().getFullYear();
    if (year > currentYear + 2 || monthNum < 1 || monthNum > 12) {
        const altYearNum = parseInt(serial.substring(2, 4), 10);
        const altYear = 2000 + altYearNum;
        if (altYear <= currentYear + 2) {
            return {
                success: true,
                info: {
                    brand: 'Squier',
                    serialNumber: serial,
                    year: altYear.toString(),
                    factory: 'China Squier production',
                    country: 'China',
                    notes: `10-digit numeric Squier serial. Standard YYMM decode gave an invalid date; interpreted as factory-code(2) + YY(2) + seq(6). Year: ${altYear}. Sequence: ${serial.substring(4)}. Verify with "Made in China" marking on the headstock.`,
                },
                patternKey: 'squier-china-se-10-digit-yymm-sequence',
                patternLabel: 'Squier China SE 10-digit YYMM sequence format',
            };
        }
        return {
            success: true,
            info: {
                brand: 'Squier',
                serialNumber: serial,
                factory: 'China Squier production',
                country: 'China',
                notes: '10-digit numeric Squier serial from Chinese production. The year could not be determined. Verify with "Made in China" marking on the headstock.',
            },
            patternKey: 'squier-china-se-10-digit-yymm-sequence',
            patternLabel: 'Squier China SE 10-digit YYMM sequence format',
        };
    }
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'China Strat Pack / SE production',
        country: 'China',
        notes: `10-digit numeric Squier serial interpreted as YYMM + 6-digit sequence. This format is associated with Chinese-made Squier SE Strat Pack instruments. Year: ${year}; month: ${month}; production sequence: ${sequence}. Verify with model features such as the Squier Strat headstock logo and "Made in China" marking.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-se-10-digit-yymm-sequence',
        patternLabel: 'Squier China SE 10-digit YYMM sequence format',
    };
}
// China Squier SE / Strat Pack numeric-only format: YYMM + sequence
function decodeChinaSquierSE9Digit(serial) {
    const yearDigits = serial.substring(0, 2);
    const monthDigits = serial.substring(2, 4);
    const sequence = serial.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);
    const year = 2000 + yearNum;
    const month = getMonthName(monthNum);
    const currentYear = new Date().getFullYear();
    // If YYMM parse gives invalid month or future year, try factory(2)+YY(2)+seq(5)
    if (year > currentYear + 2 || monthNum < 1 || monthNum > 12) {
        const altYearNum = parseInt(serial.substring(2, 4), 10);
        const altYear = 2000 + altYearNum;
        if (altYear <= currentYear + 2) {
            return {
                success: true,
                info: {
                    brand: 'Squier',
                    serialNumber: serial,
                    year: altYear.toString(),
                    factory: 'China Squier production',
                    country: 'China',
                    notes: `9-digit numeric Squier serial. Standard YYMM decode gave a future or invalid date; interpreted as factory-code(2)+YY(2)+seq(5). Year from digits 3-4: ${altYear}. Production sequence: ${serial.substring(4)}. Verify with model features and "Made in China" marking on the headstock.`,
                },
                patternKey: 'squier-china-se-9-digit-yymm-sequence',
                patternLabel: 'Squier China SE 9-digit YYMM sequence format',
            };
        }
        // Both parses give future/invalid — return with just country/factory
        return {
            success: true,
            info: {
                brand: 'Squier',
                serialNumber: serial,
                factory: 'China Squier production',
                country: 'China',
                notes: `9-digit numeric Squier serial from Chinese production. The year could not be determined from standard YYMM encoding. Verify with "Made in China" marking on the headstock and model features.`,
            },
            patternKey: 'squier-china-se-9-digit-yymm-sequence',
            patternLabel: 'Squier China SE 9-digit YYMM sequence format',
        };
    }
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'China Strat Pack / SE production',
        country: 'China',
        model: 'Squier Strat SE (Special Edition)',
        notes: `9-digit numeric Squier serial interpreted as YYMM + sequence. This format is associated with Chinese-made Squier SE Strat Pack instruments. Year: ${year}; month: ${month}; production sequence: ${sequence}. Many SE serials were applied as stickers on the back of the headstock, so verify with model features such as the Squier Strat headstock logo and full-thickness body.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-se-9-digit-yymm-sequence',
        patternLabel: 'Squier China SE 9-digit YYMM sequence format',
        additionalContext: {
            title: 'Squier SE numeric serial',
            summary: 'This serial matches the 9-digit numeric format associated with Chinese-made Squier SE Strat Pack guitars.',
            highlights: [
                `The first two digits decode as production year ${year}.`,
                `The next two digits decode as ${month}.`,
                `The remaining digits decode as production sequence ${parseInt(sequence, 10)}.`,
            ],
            caveats: [
                'Many Squier SE serials were stickers and may be missing or replaced.',
                'Fender lookup coverage can be incomplete for budget Squier models from this era.',
            ],
            verificationTips: [
                'Look for a headstock that says Squier Strat rather than Squier Stratocaster.',
                'Check for a full-thickness body, commonly associated with the SE.',
                'Confirm Chinese origin markings and compare against known Strat Pack SE features.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the 9-digit numeric format associated with Chinese-made Squier SE Strat Pack guitars.</p><h3>How This Pattern Is Typically Read</h3><p>The first two digits decode as production year ${year}; the next two digits decode as ${month}; the remaining digits decode as production sequence ${parseInt(sequence, 10)}.</p><h3>What To Verify</h3><ul><li>Look for a headstock that says Squier Strat rather than Squier Stratocaster.</li><li>Check for a full-thickness body, commonly associated with the SE.</li><li>Many Squier SE serials were stickers and may be missing or replaced.</li></ul>`,
    };
}
function decodeIndonesiaICS(monthLetter, yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const month = MONTH_LETTERS[monthLetter] || 'Unknown';
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'Cor-Tek (Cort)',
        country: 'Indonesia',
        notes: 'ICS prefix indicates Indonesian Cort production (2021+). Uses modern 4-letter prefix format with month code.',
    };
    return { success: true, info };
}
function decodeIndonesiaICSYear(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cor-Tek (Cort)',
        country: 'Indonesia',
        notes: `ICS prefix indicates Indonesian Squier production at Cor-Tek/Cort. Parsed as ICS + two-digit year (${yearDigits}) + production sequence ${sequenceNumber}. This format is commonly seen on modern Indonesian-made Squier instruments, including Classic Vibe and Contemporary-era models. Verify exact model and origin from the headstock/back-of-headstock markings because Fender lookup coverage can be incomplete for some Squier runs.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-indonesia-ics-yy-sequence',
        patternLabel: 'Squier Indonesia ICS YY sequence format',
        additionalContext: {
            title: 'Squier ICS Indonesia serial',
            summary: 'This serial matches a Squier ICS-prefix Indonesian Cor-Tek/Cort format parsed as factory prefix plus production year and sequence.',
            highlights: [
                'ICS indicates Indonesian Cor-Tek/Cort production for Squier.',
                `The two digits after ICS decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'The serial identifies production year and factory family, not the exact model.',
                'Fender serial lookup coverage can be incomplete for some Squier/import runs.',
            ],
            verificationTips: [
                'Confirm the headstock/back-of-headstock country-of-origin marking.',
                'Compare the instrument against Indonesian Squier specs for the decoded year.',
                'Use physical model features to distinguish Classic Vibe, Contemporary, and other series.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Squier ICS-prefix Indonesian Cor-Tek/Cort format parsed as factory prefix plus production year and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>ICS indicates Indonesian Cor-Tek/Cort production for Squier. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>The serial identifies production year and factory family, not the exact model.</li><li>Confirm the Made in Indonesia marking near the serial.</li><li>Compare model features against Indonesian Squier specs for the decoded year.</li></ul>`,
    };
}
function decodeIndonesiaIC(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cor-Tek (Cort)',
        country: 'Indonesia',
        notes: 'IC prefix indicates Indonesian production at the Cort factory.',
    };
    return { success: true, info };
}
function decodeIndonesiaISSLetter(monthLetter, yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const month = MONTH_LETTERS[monthLetter] || 'Unknown';
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        ...(month !== 'Unknown' ? { month } : {}),
        factory: 'Samick',
        country: 'Indonesia',
        notes: `ISS prefix with month-letter code (modern Indonesian Samick format). "ISS" identifies Indonesian production at the Samick factory; "${monthLetter}" indicates ${month} using alphabetical month coding (A=January through L=December); ${yearDigits} indicates ${year}; production sequence: ${sequenceNumber}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-indonesia-iss-month-letter-yy-sequence',
        patternLabel: 'Squier Indonesia ISS month-letter YY sequence',
        additionalContext: {
            title: 'Squier Indonesia ISS-prefix serial with month code',
            summary: 'This serial matches the modern ISS-prefix Squier format from the Indonesian Samick facility with an alphabetical month code.',
            highlights: [
                '"ISS" identifies Indonesian production at the Samick factory.',
                `"${monthLetter}" decodes as ${month} using alphabetical month coding.`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'Confirm Indonesian origin from headstock or neck label markings.',
            ],
            verificationTips: [
                'Look for "Made in Indonesia" on the back of the headstock.',
                'Compare model features against Squier catalog from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the modern ISS-prefix Squier format from the Indonesian Samick facility with an alphabetical month code.</p><h3>How This Pattern Is Typically Read</h3><p>"ISS" identifies Indonesian production at Samick. "${monthLetter}" decodes as ${month}. The digits ${yearDigits} decode as year ${year}. The remaining digits are production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Look for "Made in Indonesia" on the back of the headstock.</li></ul>`,
    };
}
function decodeIndonesiaISS(serial) {
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        factory: 'Samick',
        country: 'Indonesia',
        notes: 'ISS prefix indicates Indonesian production at the Samick factory.',
    };
    return { success: true, info };
}
function decodeIndonesiaIS(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Samick',
        country: 'Indonesia',
        notes: 'IS prefix indicates Indonesian production at the Samick factory.',
    };
    return { success: true, info };
}
function decodeIndonesiaSI(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Samick',
        country: 'Indonesia',
        notes: 'SI prefix indicates Indonesian Squier production at the Samick factory.',
    };
    return { success: true, info };
}
function decodeChinaCSinglePrefix(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Yako / Chinese Squier production',
        country: 'China',
        notes: `C prefix indicates Chinese-made Squier production, commonly associated with Yako-era Affinity/Bullet/Standard instruments. Parsed as C + two-digit year (${yearDigits}) + production sequence ${sequenceNumber}. Verify the model from the headstock logo, body thickness, bridge style, and country-of-origin marking.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-c-prefix-yy-sequence',
        patternLabel: 'Squier China C-prefix YY sequence format',
        additionalContext: {
            title: 'Squier C-prefix China serial',
            summary: 'This serial matches an early-2000s Chinese Squier C-prefix format parsed as factory/country prefix plus production year and sequence.',
            highlights: [
                'C indicates Chinese-made Squier production.',
                `The next two digits decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This serial identifies likely production year and origin, not the exact model.',
                'Fender lookup coverage can be incomplete for early-2000s import Squier models.',
            ],
            verificationTips: [
                'Check the headstock logo and series markings to distinguish Affinity, Bullet, and Standard models.',
                'Confirm the Made in China or Crafted in China marking near the serial.',
                'Use body thickness and bridge style as model clues, especially on Affinity-era instruments.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an early-2000s Chinese Squier C-prefix format parsed as factory/country prefix plus production year and sequence.</p><h3>How This Pattern Is Typically Read</h3><p>C indicates Chinese-made Squier production. The next two digits decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock logo and series markings to distinguish Affinity, Bullet, and Standard models.</li><li>Confirm the Made in China or Crafted in China marking near the serial.</li><li>Use body thickness and bridge style as model clues, especially on Affinity-era instruments.</li></ul>`,
    };
}
function decodeChinaCMC(monthLetter, yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const month = MONTH_LETTERS[monthLetter] || 'Unknown';
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'Muse factory, China (Squier contract)',
        country: 'China',
        notes: `Modern Squier CMC four-letter prefix format. "C" identifies China; "M" identifies the Muse manufacturing facility; "C" indicates the Squier contract line; "${monthLetter}" indicates ${month} using alphabetical month coding (A=January through L=December); ${yearDigits} indicates ${year}; production sequence: ${sequenceNumber}. This format is used on modern Squier lines including Contemporary, Paranormal, and Affinity series.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-cmc-month-letter-yy-sequence',
        patternLabel: 'Squier China CMC month-letter YY sequence',
        additionalContext: {
            title: 'Squier China CMC serial (Muse factory)',
            summary: `This serial matches the modern Squier four-letter CMC prefix format from the Muse factory in China.`,
            highlights: [
                '"CMC" identifies China (C), Muse factory (M), Squier contract (C).',
                `"${monthLetter}" decodes as ${month} using alphabetical month coding (A=January through L=December).`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This serial identifies factory, production month, year, and sequence — not the exact model name.',
                'The model series (Contemporary, Paranormal, Affinity, etc.) must be confirmed from the headstock or body markings.',
            ],
            verificationTips: [
                'Check the headstock front for the Squier model series name.',
                'Look for "Made in China" on the back of the headstock.',
                'Compare the instrument against Squier catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the modern Squier four-letter CMC prefix format from the Muse factory in China.</p><h3>How This Pattern Is Typically Read</h3><p>"CMC" identifies China (C), the Muse factory (M), and the Squier contract line (C). "${monthLetter}" decodes as ${month}. The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock front for the Squier model series name.</li><li>Look for "Made in China" on the back of the headstock.</li><li>Compare the instrument against Squier catalog specs from ${year}.</li></ul>`,
    };
}
function decodeChinaCYK(monthLetter, yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const MONTH_NAMES_LIST = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const isDigitMonth = /\d/.test(monthLetter);
    const month = isDigitMonth
        ? (MONTH_NAMES_LIST[parseInt(monthLetter, 10) - 1] || undefined)
        : (MONTH_LETTERS[monthLetter] || 'Unknown');
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        ...(month ? { month } : {}),
        factory: 'Yako',
        country: 'China',
        notes: `CYK prefix indicates Chinese Yako factory production (2020+). C=China, YK=Yako factory; "${monthLetter}" indicates ${month || 'month'} using ${isDigitMonth ? 'numeric month coding' : 'alphabetical month coding (A=January through L=December)'}; ${yearDigits} indicates ${year}; production sequence: ${sequenceNumber}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-cyk-month-yy-sequence',
        patternLabel: 'Squier China CYK Yako month YY sequence',
    };
}
function decodeChinaCSK(serial) {
    const yearDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'China SK contracted facility',
        country: 'China',
        notes: `Modern Squier CSK prefix format. "C" identifies China; "SK" identifies the contracted production facility; ${yearDigits} indicates ${year}; production sequence: ${sequenceNumber}. This format is used on modern Squier lines.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-csk-yy-sequence',
        patternLabel: 'Squier China CSK YY sequence',
        additionalContext: {
            title: 'Squier China CSK serial',
            summary: `This serial matches the Squier CSK-prefix format: C=China, SK=facility, ${yearDigits}=${year}.`,
            highlights: [
                '"C" identifies China; "SK" identifies the contracted production facility.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'The serial identifies factory, year, and sequence — not the specific model name.',
            ],
            verificationTips: [
                'Check the headstock for the Squier model series name.',
                'Look for "Made in China" on the back of the headstock.',
                'Compare the instrument against Squier catalog specs for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Squier CSK-prefix format from a contracted Chinese production facility. C=China, SK=facility, ${yearDigits}=${year}.</p><h3>How This Pattern Is Typically Read</h3><p>"C" identifies China; "SK" identifies the contracted production facility. The digits ${yearDigits} decode as ${year}. The remaining digits are production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock front for the Squier model series name.</li><li>Look for "Made in China" on the back of the headstock.</li><li>Compare the instrument against Squier catalog specs from ${year}.</li></ul>`,
    };
}
function decodeChinaCWS(serial) {
    const yearDigits = serial.substring(3, 5);
    const sequence = serial.substring(5);
    const year = 2000 + parseInt(yearDigits, 10);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'China WS contracted facility',
        country: 'China',
        notes: `CWS-prefix Squier format. "C" identifies China; "WS" identifies the contracted production facility (associated with Starcaster and starter-pack Stratocaster lines); ${yearDigits} indicates ${year}; production sequence: ${sequenceNumber}. Verify model from the headstock or interior label.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-cws-yy-sequence',
        patternLabel: 'Squier China CWS YY sequence',
        additionalContext: {
            title: 'Squier China CWS serial',
            summary: `This serial matches the Squier CWS-prefix format: C=China, WS=facility, ${yearDigits}=${year}.`,
            highlights: [
                '"C" identifies China; "WS" identifies the contracted production facility.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'CWS-prefix serials are associated with budget Squier lines including the Starcaster and starter-pack Stratocasters.',
                'The serial identifies factory, year, and sequence — not the specific model name.',
            ],
            verificationTips: [
                'Check the headstock for the Squier model name.',
                'Look for "Made in China" on the back of the headstock.',
                'Compare against Squier catalog specs for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Squier CWS-prefix format from a contracted Chinese production facility. C=China, WS=facility, ${yearDigits}=${year}.</p><h3>How This Pattern Is Typically Read</h3><p>"C" identifies China; "WS" identifies the contracted production facility associated with Starcaster and starter-pack Stratocaster lines. The digits ${yearDigits} decode as ${year}. The remaining digits are production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock for the Squier model series name.</li><li>Look for "Made in China" on the back of the headstock.</li><li>Compare against Squier catalog specs from ${year}.</li></ul>`,
    };
}
function decodeChinaCSV(monthLetter, yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const month = MONTH_LETTERS[monthLetter] || 'Unknown';
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        month,
        factory: 'China SV contracted facility',
        country: 'China',
        notes: `Modern Squier CSV four-letter prefix format. "C" identifies China; "SV" identifies the contracted production facility; "${monthLetter}" indicates ${month} using alphabetical month coding (A=January through L=December); ${yearDigits} indicates ${year}; production sequence: ${sequenceNumber}. This format is used on modern entry-level Squier lines.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-csv-month-letter-yy-sequence',
        patternLabel: 'Squier China CSV month-letter YY sequence',
        additionalContext: {
            title: 'Squier China CSV serial',
            summary: 'This serial matches the modern Squier four-letter CSV prefix format from a contracted Chinese production facility.',
            highlights: [
                '"C" identifies China; "SV" identifies the contracted production facility.',
                `"${monthLetter}" decodes as ${month} using alphabetical month coding (A=January through L=December).`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This serial identifies factory, production month, year, and sequence — not the exact model name.',
                'The model series must be confirmed from the headstock or body markings.',
                'CSV-prefix serials from modern Chinese production may not appear in all Fender serial databases.',
            ],
            verificationTips: [
                'Check the headstock front for the Squier model series name.',
                'Look for "Made in China" on the back of the headstock.',
                'Compare the instrument against Squier catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the modern Squier four-letter CSV prefix format from a contracted Chinese production facility.</p><h3>How This Pattern Is Typically Read</h3><p>"C" identifies China; "SV" identifies the contracted production facility. "${monthLetter}" decodes as ${month} using alphabetical month coding (A=January through L=December). The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock front for the Squier model series name.</li><li>Look for "Made in China" on the back of the headstock.</li><li>Compare the instrument against Squier catalog specs from ${year}.</li></ul>`,
    };
}
function decodeChinaCRN(monthLetter, yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const month = MONTH_LETTERS[monthLetter];
    const sequenceNumber = parseInt(sequence, 10);
    const monthDesc = month || (monthLetter.match(/\d/) ? `numeric code ${monthLetter}` : 'Unknown');
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        ...(month ? { month } : {}),
        factory: 'China RN contracted facility',
        country: 'China',
        notes: `Modern Squier CRN four-letter prefix format. "C" identifies China; "RN" identifies the contracted production facility; "${monthLetter}" indicates ${monthDesc}${month ? ' using alphabetical month coding (A=January through L=December)' : ' (numeric month variant)'}; ${yearDigits} indicates ${year}; production sequence: ${sequenceNumber}. This format is used on modern entry-level Squier lines including Debut and Sonic series.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-crn-month-letter-yy-sequence',
        patternLabel: 'Squier China CRN month-letter YY sequence',
        additionalContext: {
            title: 'Squier China CRN serial',
            summary: 'This serial matches the modern Squier four-letter CRN prefix format from a contracted Chinese production facility.',
            highlights: [
                '"C" identifies China; "RN" identifies the contracted production facility.',
                `"${monthLetter}" decodes as ${month} using alphabetical month coding (A=January through L=December).`,
                `The digits ${yearDigits} decode as production year ${year}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This serial identifies factory, production month, year, and sequence — not the exact model name.',
                'The model series (Debut, Sonic, etc.) must be confirmed from the headstock or body markings.',
                'CRN-prefix serials from modern Chinese production may not appear in all Fender serial databases.',
            ],
            verificationTips: [
                'Check the headstock front for the Squier model series name.',
                'Look for "Made in China" on the back of the headstock.',
                'Compare the instrument against Squier catalog specs from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the modern Squier four-letter CRN prefix format from a contracted Chinese production facility.</p><h3>How This Pattern Is Typically Read</h3><p>"C" identifies China; "RN" identifies the contracted production facility. "${monthLetter}" decodes as ${month} using alphabetical month coding (A=January through L=December). The digits ${yearDigits} decode as production year ${year}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the headstock front for the Squier model series name.</li><li>Look for "Made in China" on the back of the headstock.</li><li>Compare the instrument against Squier catalog specs from ${year}.</li></ul>`,
    };
}
function decodeChinaCY(yearDigits, sequence, serial) {
    let year = parseInt(yearDigits, 10);
    year = year >= 90 ? 1900 + year : 2000 + year;
    // If the decoded year is implausibly far in the future, re-interpret using a single-digit year.
    // e.g. CY31117497: 2-digit year 31 → 2031 (impossible); try year=3 → 2003 instead.
    if (year > new Date().getFullYear() + 2 && yearDigits.length >= 2) {
        return decodeChinaCY(yearDigits[0], yearDigits.slice(1) + sequence, serial);
    }
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Yako (Taiwan-owned)',
        country: 'China',
        notes: 'CY prefix indicates Chinese production at the Yako facility. Often marked as "Crafted in China".',
    };
    return { success: true, info };
}
function decodeChinaYN(serial) {
    const yearDigit = serial[2];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit} or 200${yearDigit}`,
        factory: 'Yako',
        country: 'China',
        notes: 'YN prefix indicates Chinese production at the Yako factory.',
    };
    return { success: true, info };
}
function decodeChinaCXS(monthDigits, yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const month = parseInt(monthDigits, 10);
    const monthName = getMonthName(month);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        month: monthName,
        factory: 'AXL',
        country: 'China',
        notes: 'CXS prefix indicates Chinese production at the AXL factory (2007-2012).',
    };
    return { success: true, info };
}
function decodeChinaCA(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'AXL',
        country: 'China',
        notes: 'CA/CAE prefix indicates Chinese production at the AXL factory.',
    };
    return { success: true, info };
}
function decodeChinaCG(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Grand Reward',
        country: 'China',
        notes: 'CGS/CGR/CGT prefix indicates Chinese production at the Grand Reward factory.',
    };
    return { success: true, info };
}
function decodeChinaCO(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Cor-Tek (Cort)',
        country: 'China',
        notes: 'COB/COS prefix indicates Chinese production at the Cor-Tek factory.',
    };
    return { success: true, info };
}
function decodeChinaCSSLetterMonth(monthLetter, yearDigits, sequence, serial) {
    const MONTH_LETTERS = {
        'A': 'January', 'B': 'February', 'C': 'March', 'D': 'April',
        'E': 'May', 'F': 'June', 'G': 'July', 'H': 'August',
        'I': 'September', 'J': 'October', 'K': 'November', 'L': 'December',
    };
    const month = MONTH_LETTERS[monthLetter];
    const year = '20' + yearDigits;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year,
        month,
        factory: 'Samick China (Axl factory, CSS line)',
        country: 'China',
        notes: `CSS prefix with month code indicates Samick-contracted (Axl) Chinese production (2020+ format). Month: ${monthLetter} = ${month ?? 'unknown'}. Year: ${year}. Sequence: ${parseInt(sequence, 10)}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'squier-china-css-month-letter-yy-sequence',
        patternLabel: 'Squier China CSS month-letter YY + sequence',
    };
}
function decodeChinaCSS(yearDigits, sequence, serial) {
    const year = 2000 + parseInt(yearDigits, 10);
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Samick',
        country: 'China',
        notes: 'CSS prefix indicates Chinese production at the Samick factory.',
    };
    return { success: true, info };
}
function decodeChinaNC(serial) {
    const yearDigit = serial[2];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit}`,
        country: 'China',
        notes: 'NC prefix with "Made in China" on neck plate. Used between late 1994-1997.',
    };
    return { success: true, info };
}
function decodeMexicoMN(yearDigit, sequence, serial) {
    const year = `199${yearDigit}`;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year,
        factory: 'Ensenada',
        country: 'Mexico',
        notes: 'MN prefix indicates Mexican production in the 1990s. Squier production started in Mexico in 1991.',
    };
    return { success: true, info };
}
function decodeMexicoMZ(yearDigit, sequence, serial) {
    const year = `200${yearDigit}`;
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year,
        factory: 'Ensenada',
        country: 'Mexico',
        notes: 'MZ prefix indicates Mexican production in the 2000s.',
    };
    return { success: true, info };
}
function decodeUSAN(serial) {
    const yearDigit = serial[1];
    const info = {
        brand: 'Squier',
        serialNumber: serial,
        year: `199${yearDigit}`,
        country: 'USA',
        notes: 'N prefix USA-made Squier. These are rare - most N prefix guitars are Fenders, not Squiers. Verify the "Squier by Fender" logo on headstock.',
    };
    return { success: true, info };
}
function getMonthName(month) {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || 'Unknown';
}
