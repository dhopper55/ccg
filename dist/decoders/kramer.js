/**
 * Kramer Guitar Serial Number Decoder
 *
 * Kramer serials are inconsistent across eras, so this decoder focuses on
 * broad ranges and common prefix patterns. Supported formats include:
 * - Single-letter prefix A-F (USA Neptune, NJ era, early 1980s)
 * - H-prefix (ESP Japan contract build, 1990-1991)
 * - V-prefix (vintage/import plates, mid-to-late 1980s)
 * - SB-prefix (mid-to-late 1980s Striker import, Samick Korea or Japan)
 * - S-prefix variants: SA, SE, SD, SP, SF, SC, SJ, SI (various import eras)
 * - Short S-prefix 1-4 digits (vintage Striker sequential, no year encoding)
 * - JK-prefix (Gibson/Epiphone-era Indonesian factory, YYMM format, late 1990s–2000s)
 * - U-prefix (Unsung Korea factory, Gibson/MusicYo era, YYMM format)
 * - Plain 4-digit numeric (unverified era; import or USA with possible worn/missing prefix)
 * - Modern Gibson/MusicYo-era numeric formats (8-, 9-, and 11-digit YYMM)
 */
export function decodeKramer(serial) {
    const cleaned = serial.trim().toUpperCase();
    const normalized = cleaned.replace(/[\s-]/g, '');
    if (!normalized) {
        return {
            success: false,
            error: 'Please enter a serial number.',
        };
    }
    // Letter prefix A-F (early USA era)
    if (/^[A-F]\d+$/.test(normalized)) {
        const prefix = normalized.charAt(0);
        const yearRange = getPrefixYearRange(prefix);
        const info = {
            brand: 'Kramer',
            serialNumber: cleaned,
            year: yearRange,
            notes: `${prefix}-prefix serial. These generally indicate early Kramer production periods and should be cross-referenced with headstock and neck-plate details for accuracy.`,
        };
        return { success: true, info };
    }
    // H-prefix: late-era Japanese ESP-built Kramer (1990-1991)
    if (/^H\d{3,6}$/.test(normalized)) {
        const sequence = parseInt(normalized.substring(1), 10);
        const info = {
            brand: 'Kramer',
            serialNumber: cleaned,
            year: '1990–1991',
            factory: 'ESP factory, Japan (contract build for Kramer)',
            country: 'Japan',
            notes: `H-prefix serial. These identify late-era Japanese Kramer exports built by ESP under contract, produced right at the end of the original Kramer company's lifespan before their bankruptcy in early 1991. Common on the Pacer Custom I and similar premium Japanese export models, typically featuring Seymour Duncan pickups and Floyd Rose tremolo. The serial number is usually deeply stamped into the back neck plate. Production sequence: ${sequence}. Because Kramer ceased operations shortly after these were made, H-prefix guitars are relatively rare and collectible.`,
        };
        return {
            success: true,
            info,
            patternKey: 'kramer-h-prefix-japan-esp-1990-1991',
            patternLabel: 'Kramer H-prefix late-era Japan ESP build (1990–1991)',
            additionalContext: {
                title: 'Kramer H-prefix Japan serial (1990–1991)',
                summary: 'H-prefix Kramers are late-era Japanese export models built by ESP under contract, produced in the final period before Kramer\'s original company went bankrupt in early 1991.',
                highlights: [
                    '"H" identifies a late-era Japanese Kramer export built by ESP.',
                    'Production year: 1990–1991.',
                    `Production sequence: ${sequence}.`,
                    'Common on Pacer Custom I and similar premium export models with Seymour Duncan pickups and Floyd Rose tremolo.',
                ],
                caveats: [
                    'Kramer ceased operations in early 1991, making H-prefix guitars relatively rare.',
                    'The serial alone does not confirm the exact model — verify from the headstock logo and body features.',
                    'The neck plate is the most common location for this stamp.',
                ],
                verificationTips: [
                    'Check the back neck plate for the deeply stamped H-prefix serial.',
                    'Look for the classic Kramer banana/pointy headstock and a Floyd Rose-style tremolo.',
                    'Compare the pickup configuration and hardware against known Pacer Custom I specs.',
                ],
            },
            additionalContextRichText: `<h3>Overview</h3><p>H-prefix Kramers are late-era Japanese export models built by ESP under contract, produced in the final period before Kramer's original company went bankrupt in early 1991.</p><h3>How This Pattern Is Typically Read</h3><p>"H" identifies a late-era Japanese Kramer export built by ESP. Production year: 1990–1991. Production sequence: ${sequence}. Common on Pacer Custom I and similar premium export models.</p><h3>What To Verify</h3><ul><li>Check the back neck plate for the deeply stamped H-prefix serial.</li><li>Look for the classic Kramer banana/pointy headstock and Floyd Rose-style tremolo.</li><li>Compare the pickup configuration and hardware against known 1990–1991 Pacer Custom I specs.</li></ul>`,
        };
    }
    // V-prefix vintage/import plates (often Vanguard/Voyager-era, non-chronological)
    if (/^V\d{4,6}$/.test(normalized)) {
        const sequence = normalized.substring(1);
        const info = {
            brand: 'Kramer',
            serialNumber: cleaned,
            year: 'mid-to-late 1980s (estimated)',
            notes: `V-prefix plate serial. These are commonly seen on 1980s import-era Kramer runs (often Vanguard/Voyager-associated), but plate numbers were not always chronological. Sequence: ${sequence}. Confirm era with headstock shape, logo style, and neck-plate markings.`,
        };
        return { success: true, info };
    }
    // Saemyung China / MusicYo-era import format: SJ + YYMM + sequence
    if (/^SJ\d{8}$/.test(normalized)) {
        return decodeSaemyungChinaSJ(normalized, cleaned);
    }
    // Samick Indonesia modern import format: SI + YYMM + sequence
    if (/^SI\d{8}$/.test(normalized)) {
        return decodeSamickIndonesiaSI(normalized, cleaned);
    }
    // Vintage 1980s Striker/Aerostar import: S + 5-digit sequential (no year encoding)
    // Identified by first two digits that cannot be a plausible modern production year (> current decade).
    // Must be checked before MusicYo check so future-rejected year digits route here instead.
    if (/^S[6-9]\d{4}$/.test(normalized)) {
        return decodeVintage1980sSStrikerSequential(normalized, cleaned);
    }
    // MusicYo/Gibson-era Striker format: S + YY + sequence
    if (/^S\d{5}$/.test(normalized)) {
        return decodeMusicYoStrikerS(normalized, cleaned);
    }
    // SF-prefix: Japanese-made import era (late 1980s – early 1990s)
    if (/^SF\d{3,6}$/.test(normalized)) {
        const sequence = normalized.substring(2);
        const info = {
            brand: 'Kramer',
            serialNumber: cleaned,
            year: 'late 1980s to early 1990s',
            country: 'Japan',
            notes: `SF-prefix neck plate serial. The "SF" prefix is associated with Japanese-made overseas-produced Kramer models from the late 1980s to early 1990s, commonly found on Focus series and Pro Axe models. These were typically manufactured by Matsumoku or similar Japanese factories. American-made Kramers from this era used single letters (A–G) or purely numeric serials. Because Kramer's records from this era are incomplete, exact dating is difficult. Production sequence: ${sequence}. Confirm the specific model with headstock shape, pickup configuration, and hardware details.`,
        };
        return { success: true, info };
    }
    // SC-prefix: Japanese overseas Focus/Striker-era plate serials (2-4 digit sequence)
    if (/^SC\d{2,4}$/.test(normalized)) {
        return decodeJapanSC(normalized, cleaned);
    }
    // SE-prefix: Samick Korea overseas models, commonly late-1980s Striker/Aerostar/Focus era
    if (/^SE\d{4}$/.test(normalized)) {
        return decodeSamickKoreaSE(normalized, cleaned);
    }
    // SD-prefix Samick Korea Striker/import-era plates (trailing letter variant: SD704D)
    if (/^SD\d{3,6}[A-Z]?$/.test(normalized)) {
        return decodeSamickKoreaSD(normalized, cleaned);
    }
    // SP-prefix: 1980s Korean Striker Plus/Striker import (Samick or similar Korean factory)
    if (/^SP\d{4,6}$/.test(normalized)) {
        return decodeKoreanStrikerSP(normalized, cleaned);
    }
    // SA-prefix: mid-to-late 1980s Striker import, Samick Korea (A sub-batch variant)
    if (/^SA\d{3,6}$/.test(normalized)) {
        return decodeKoreanStrikerSA(normalized, cleaned);
    }
    // SB-prefix: mid-to-late 1980s Striker import, Samick Korea or Japanese factory
    if (/^SB\d{3,6}$/.test(normalized)) {
        return decodeVintage1980sSBStriker(normalized, cleaned);
    }
    // Gibson/Epiphone-era Indonesian factory format: JK + YYMM + sequence
    if (/^JK\d{7,8}$/.test(normalized)) {
        return decodeGibsonEraJKIndonesia(normalized, cleaned);
    }
    // KB-prefix: Gibson/MusicYo-era budget import line (Korean or Indonesian)
    // Must come before generic ^[A-Z]{2}\d+ handler which returns a vague result
    if (/^KB\d{4,8}$/.test(normalized)) {
        return decodeKBModernImport(normalized, cleaned);
    }
    // Short S-prefix import/Striker serials (1-4 digits): S + short sequence, no year encoding.
    // Covers short plates from the 1980s Striker/Samick era (e.g. S356, S0356).
    // Must come after all two-letter S+letter handlers (SA, SB, SC, SD, SE, SF, SI, SJ, SP)
    // which are already dispatched above.
    if (/^S\d{1,4}$/.test(normalized)) {
        return decodeShortSPlateSerial(normalized, cleaned);
    }
    // Unsung Korea factory / Gibson-era YYMM format: U + YYMM + sequence
    // e.g. U04020181 = Unsung Korea, 2004, February, seq 0181
    // Must come before the generic two-letter handler and after USA U-prefix handlers above.
    if (/^U\d{7,9}$/.test(normalized)) {
        return decodeUnsungKoreaU(normalized, cleaned);
    }
    // Two-letter overseas prefixes (e.g., FA, FB, CF, XL)
    if (/^[A-Z]{2}\d+$/.test(normalized)) {
        const prefix = normalized.substring(0, 2);
        const yearRange = getOverseasYearRange(prefix);
        const country = getOverseasCountry(prefix);
        const model = prefix === 'XL' ? 'XL Series (budget import line)' : undefined;
        const info = {
            brand: 'Kramer',
            serialNumber: cleaned,
            year: yearRange,
            country,
            ...(model ? { model } : {}),
            notes: prefix === 'CF'
                ? `Overseas model prefix ${prefix}. This prefix is commonly associated with Japan-built Focus/Striker-era instruments from the mid-to-late 1980s (often around 1985-1989). Verify with headstock shape, neck-plate details, and hardware.`
                : prefix === 'XL'
                    ? `Overseas model prefix XL. Kramer's XL Series (XL I, XL II, XL III) was a budget-friendly entry-level line built overseas during the late 1980s to capture the entry-level shred market. Unlike premium American Kramers, the neck plate is typically a plain stamped chrome or black plate without a "Neptune, N.J." factory stamp. Verify with headstock shape (pointy/beak-style), neck-plate finish, and whether a Floyd Rose tremolo is present.`
                    : `Overseas model prefix ${prefix}. The second letter often indicates the production year range, but verification with features is recommended.`,
        };
        return { success: true, info };
    }
    // Modern Samick import pattern: S + YYMM + sequence (8-9 digits after S)
    if (/^S\d{8,9}$/.test(normalized)) {
        return decodeModernSamickS(normalized, cleaned);
    }
    // S / SS prefixes on some overseas Striker-era plates (format often SS-YYMM-RR)
    if (/^S{1,2}\d{6,8}$/.test(normalized)) {
        const prefixMatch = normalized.match(/^S{1,2}/);
        const prefix = prefixMatch ? prefixMatch[0] : 'S';
        const remainder = normalized.substring(prefix.length);
        const yearPart = remainder.substring(0, 2);
        const monthPart = remainder.substring(2, 4);
        const yearValue = parseInt(yearPart, 10);
        const monthValue = parseInt(monthPart, 10);
        const fullYear = Number.isNaN(yearValue) ? undefined : `20${yearPart}`;
        const monthName = getMonthName(monthValue);
        const yearDisplay = fullYear && monthName ? `${monthName} ${fullYear}` : fullYear;
        const sequence = remainder.length > 4 ? remainder.substring(4) : undefined;
        const info = {
            brand: 'Kramer',
            serialNumber: cleaned,
            year: yearDisplay,
            notes: `${prefix}-prefix serial often appears on overseas models (including some Strikers). Interpreted as ${prefix}-YYMM-RR${sequence ? ` with sequence ${sequence}` : ''}. Confirm with country-of-origin markings and hardware details.`,
        };
        return { success: true, info };
    }
    // Plain 4-digit numeric serials (no letter prefix)
    // USA Series used A–F prefixes; a bare 4-digit number does not match that format.
    // Some import models (Striker, Focus) used plain stamped plates with no date encoding.
    if (/^\d{4}$/.test(normalized)) {
        const sequence = parseInt(normalized, 10);
        return {
            success: true,
            info: {
                brand: 'Kramer',
                serialNumber: cleaned,
                year: '1980s (estimated)',
                country: 'USA or import (unverified)',
                notes: `Plain 4-digit numeric serials are ambiguous in Kramer's history. The USA Neptune, NJ American Series from the early-to-mid 1980s used single-letter prefixes (A, B, C, D, G, or S) before the number — a bare 4-digit number without a letter prefix does not match the official American Series format. Some 1980s import models (Striker, Focus) used plain stamped neck plates or stickers without clear sequential coding. Because Kramer's factory records from the Neptune, NJ era are largely lost, confirming authenticity or precise dating from an un-prefixed 4-digit serial is difficult. Sequence: ${sequence}. Check whether the serial appears on a stamped metal neck plate or headstock decal, look carefully for a worn or faint letter prefix, note the headstock shape (beak, pointy, or banana), and see if the neck plate references Neptune, NJ.`,
            },
            patternKey: 'kramer-plain-4-digit-plate-unverified',
            patternLabel: 'Kramer plain 4-digit plate serial (unverified era)',
            additionalContext: {
                title: 'Kramer plain 4-digit serial',
                summary: 'Plain 4-digit numeric serials are ambiguous in Kramer\'s history. The USA American Series used letter prefixes (A–F); a bare 4-digit number does not match that format and may indicate an import model or a plate with a worn/missing prefix.',
                highlights: [
                    'The USA Neptune, NJ American Series used single-letter prefixes (A, B, C, D, G, or S) before the number.',
                    'A plain 4-digit number without a letter prefix does not match the official American Series format.',
                    'Some 1980s import models (Striker, Focus) used plain stamped plates or stickers without clear date coding.',
                    `Serial digits: ${sequence}.`,
                ],
                caveats: [
                    'Kramer factory records from the Neptune, NJ era are largely lost — exact dating and provenance are difficult to confirm from a plain numeric serial alone.',
                    'A letter prefix may be worn, faded, or partially obscured — inspect the neck plate or headstock carefully.',
                    'Without a confirmed letter prefix, this serial cannot be verified as an American Series Kramer.',
                ],
                verificationTips: [
                    'Check whether the serial is on a stamped metal neck plate (back of body) or a headstock decal.',
                    'Look carefully for a worn or faint letter prefix before the digits.',
                    'Note the headstock shape: beak, pointy, or banana-style.',
                    'Check if the neck plate references Neptune, NJ.',
                    'Compare against the Vintage Kramer Serial Numbers Guide or the Kramer Serial Number Research Database.',
                ],
            },
            additionalContextRichText: `<h3>Overview</h3><p>Plain 4-digit numeric serials are ambiguous in Kramer's history. The USA Neptune, NJ American Series used single-letter prefixes (A, B, C, D, G, or S) before the number — a bare 4-digit number does not match the official American Series format and may indicate an import model or a plate with a worn or missing prefix.</p><h3>How This Pattern Is Typically Read</h3><p>The USA Neptune, NJ American Series used letter prefixes (A–F) preceding the number. A plain 4-digit serial does not fit the official American Series format. Some 1980s import models (Striker, Focus) used plain stamped plates or stickers without clear sequential coding. Because Kramer's factory records from this era are largely lost, exact dating requires physical verification. Serial digits: ${sequence}.</p><h3>What To Verify</h3><ul><li>Check whether the serial appears on a stamped metal neck plate (back of body) or a headstock decal.</li><li>Look carefully for a worn or faint letter prefix before the digits — a partially worn stamp could hide an A, B, C, D, G, or S prefix.</li><li>Note the headstock shape (beak, pointy, or banana-style) and whether the neck plate references Neptune, NJ.</li><li>Compare against the Vintage Kramer Serial Numbers Guide or the Kramer Serial Number Research Database.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a general 1980s Kramer estimate. Physical inspection — particularly checking for a worn letter prefix, headstock shape, and neck-plate markings — is the most reliable way to determine model and era.</p>`,
        };
    }
    // 10-digit numeric + single suffix letter: YYMM + factory(2) + seq(4) + letter
    // e.g. 2206290147S = 2022, June, factory 29, seq 0147, suffix S
    if (/^\d{10}[A-Z]$/.test(normalized)) {
        return decodeModernNumericWithSuffix(normalized, cleaned);
    }
    // Musicyo reissue style (e.g., 04xxxx)
    if (/^\d{5,}$/.test(normalized)) {
        // 5-digit numeric plate serials are commonly seen on 1980s Neptune, NJ
        // neck-plate-era instruments and related import/USA-associated runs.
        if (/^\d{5}$/.test(normalized)) {
            const info = {
                brand: 'Kramer',
                serialNumber: cleaned,
                year: '1980s (estimated)',
                factory: 'Neptune, NJ plate-era production',
                country: 'USA or Japan',
                notes: `5-digit numeric serials are commonly seen on Kramer neck plates from the 1980s Neptune, NJ era. These plate numbers were not always chronological and can appear on American- and Japanese-associated production runs. Sequence: ${normalized}. Confirm with neck-plate text, headstock style, and hardware details for more precise dating.`,
            };
            return {
                success: true,
                info,
                patternKey: 'kramer-vintage-5-digit-plate',
                patternLabel: 'Kramer vintage 5-digit plate serial',
                additionalContext: {
                    title: 'Kramer vintage 5-digit plate serial',
                    summary: 'This serial matches a 5-digit numeric Kramer neck-plate pattern commonly associated with 1980s Neptune, NJ era instruments.',
                    highlights: [
                        'Five-digit numeric plate serials are commonly associated with 1980s Kramer neck-plate usage.',
                        `The plate sequence here is ${parseInt(normalized, 10)}.`,
                        'This pattern is useful for era attribution, but not as a precise chronological date code.',
                    ],
                    caveats: [
                        'Kramer vintage serial records are incomplete and plate numbers were not always assigned in strict order.',
                        'The serial alone does not cleanly distinguish all USA versus Japanese-associated production.',
                        'Exact model and production period should be verified from neck-plate wording, headstock style, and hardware.',
                    ],
                    verificationTips: [
                        'Check whether the neck plate references Neptune, NJ.',
                        'Compare the logo, body shape, and hardware to known 1980s Kramer catalog examples.',
                    ],
                },
                additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 5-digit numeric Kramer neck-plate pattern commonly associated with 1980s Neptune, NJ era instruments.</p><h3>How This Pattern Is Typically Read</h3><p>Five-digit numeric plate serials are commonly associated with 1980s Kramer neck-plate usage. The plate sequence here is ${parseInt(normalized, 10)}. This pattern is useful for era attribution, but not as a precise chronological date code.</p><h3>What To Verify</h3><ul><li>Kramer vintage serial records are incomplete and plate numbers were not always assigned in strict order.</li><li>The serial alone does not cleanly distinguish all USA versus Japanese-associated production.</li><li>Exact model and production period should be verified from neck-plate wording, headstock style, and hardware.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a practical 1980s Kramer plate-era decode, then confirm the exact model and provenance from physical instrument details.</p>`,
            };
        }
        // 7-digit numeric serials beginning with 5 are commonly tied to
        // late-1980s/early-1990s Korean import-era runs (often Striker/Focus-adjacent).
        if (/^5\d{6}$/.test(normalized)) {
            const info = {
                brand: 'Kramer',
                serialNumber: cleaned,
                year: '1987-1991 (estimated)',
                factory: 'Korean import production line',
                country: 'South Korea',
                notes: `7-digit numeric format beginning with 5 is commonly associated with late-1980s to early-1990s Korean import-era Kramer production. Sequence: ${normalized.substring(1)}. Confirm with headstock style, neckplate text, and hardware details.`,
            };
            return { success: true, info };
        }
        // 7-digit numeric that doesn't start with 5: Gibson/MusicYo era import
        // e.g. 4081404 — exact year encoding unclear, era ~2000-2015
        if (/^\d{7}$/.test(normalized) && !/^5\d{6}$/.test(normalized)) {
            const info = {
                brand: 'Kramer',
                serialNumber: cleaned,
                year: '2000–2015 (estimated Gibson/MusicYo era)',
                factory: 'Gibson/MusicYo-era import factory (Korea, China, or Indonesia)',
                country: 'South Korea',
                notes: `7-digit numeric Kramer serial from the Gibson/MusicYo production era (approximately 2000–2015). The exact date-code convention for this run is not publicly documented and the year cannot be extracted reliably from digit positions alone. Confirm the era from the headstock markings, model features, and Kramer label text. Gibson reacquired the Kramer brand from MusicYo in 2009; instruments from this period range from Korean and Chinese factory builds to later Indonesian production.`,
            };
            return {
                success: true,
                info,
                patternKey: 'kramer-modern-numeric-yymm-sequence',
                patternLabel: 'Kramer modern numeric YYMM sequence',
            };
        }
        // Modern Gibson/Epiphone-era 9-digit import format:
        // FF YY M SSSS (e.g., 311763081 => factory 31, 2017, June, sequence 3081).
        if (/^\d{9}$/.test(normalized)) {
            return decodeModernGibsonEraFactoryNumeric(normalized, cleaned);
        }
        // Modern Gibson-era all-numeric import format shared with Epiphone:
        // YY MM FF SSSSS (e.g., 25051300004 => 2025, May, factory 13, sequence 00004).
        if (/^\d{11}$/.test(normalized)) {
            return decodeModernGibsonEraNumeric(normalized, cleaned);
        }
        const yearPrefix = normalized.substring(0, 2);
        const yearValue = parseInt(yearPrefix, 10);
        // Accept year digits 00-35 as modern production year codes (covers up to 2035).
        // Values in the 36-89 range are ambiguous (could be 1980s-era) and fall to the generic note.
        if (!Number.isNaN(yearValue) && (yearValue <= 35 || yearValue >= 90)) {
            const fullYear = yearValue >= 90 ? 1900 + yearValue : 2000 + yearValue;
            const monthDigits = normalized.substring(2, 4);
            const monthNum = parseInt(monthDigits, 10);
            const monthName = (monthNum >= 1 && monthNum <= 12) ? getMonthName(monthNum) : undefined;
            const sequence = normalized.substring(monthName ? 4 : 2);
            const info = {
                brand: 'Kramer',
                serialNumber: cleaned,
                year: fullYear.toString(),
                ...(monthName ? { month: monthName } : {}),
                notes: `Numeric Kramer serial. Year decoded from first two digits: ${fullYear}${monthName ? `, month: ${monthName}` : ''}. Sequence: ${parseInt(sequence, 10)}. Confirm with model features and hardware details.`,
            };
            return {
                success: true,
                info,
                patternKey: 'kramer-modern-numeric-yymm-sequence',
                patternLabel: 'Kramer modern numeric YYMM sequence',
            };
        }
        const info = {
            brand: 'Kramer',
            serialNumber: cleaned,
            notes: 'Numeric-only serials are common on some USA-era instruments and do not always encode the date. Use the Vintage Kramer registry and feature checks for accurate dating.',
        };
        return { success: true, info };
    }
    return {
        success: false,
        error: 'Unable to decode this Kramer serial number. Kramer serials vary by era, and many vintage records were lost. Common known formats: single-letter A–F (USA era), H-prefix (Japan ESP build), JK-prefix (Indonesian factory, Gibson/Epiphone era), SB/SE/SD/SP/SF/SC/SJ/SI-prefix (import eras), plain 4-digit numeric (import or USA with possible worn prefix), and numeric formats. Try the Vintage Kramer registry or HTPG serial search for additional context.',
    };
}
function decodeVintage1980sSBStriker(normalized, cleaned) {
    const sequence = normalized.substring(2);
    const sequenceNumber = parseInt(sequence, 10);
    return {
        success: true,
        info: {
            brand: 'Kramer',
            serialNumber: cleaned,
            year: '1986–1989 (estimated)',
            factory: 'Samick Korea or Japanese contracted facility',
            country: 'South Korea or Japan',
            model: 'Striker Series (Striker 100, 200, or 300) or related import line',
            notes: `SB-prefix Kramer serial. The "SB" designation is primarily associated with the mid-to-late 1980s Striker series — Kramer's budget and mid-tier overseas import line designed to capture the 1980s shred market. Production sequence: ${sequenceNumber}. Unlike the premium American Series (which used single-letter prefixes A–F on thick die-cast neck plates), SB serials appear on narrower stamped chrome or black steel overseas neck plates typically manufactured at Samick in South Korea or at Japanese contracted facilities. Because Kramer's original records were largely lost when the company went bankrupt in 1991, exact production months and precise factory attribution cannot be confirmed from the serial alone. Cross-reference the headstock logo style (pointy/beak shape), neck plate dimensions, tremolo type, and body construction against known Striker variants for more precise dating. Community resources such as the Vintage Kramer Serial Guide can provide corroborating evidence.`,
        },
        patternKey: 'kramer-sb-striker-1980s-sequential',
        patternLabel: 'Kramer SB Striker import 1980s sequential',
        additionalContext: {
            title: 'Kramer SB-prefix Striker import serial',
            summary: 'This serial matches the Kramer SB-prefix import format primarily associated with mid-to-late 1980s Striker series models produced at Samick Korea or Japanese contracted facilities.',
            highlights: [
                '"SB" is primarily associated with the Kramer Striker Series — the budget/mid-tier overseas import line from the 1980s shred era.',
                'Estimated production window: 1986–1989.',
                `Production sequence: ${sequenceNumber}.`,
                'Manufactured at Samick Korea or Japanese contracted facilities; not at the Neptune, NJ American Series production line.',
                'Overseas neck plates from this era are narrower stamped steel (chrome or black) rather than the thicker USA die-cast plates.',
            ],
            caveats: [
                'Kramer original factory records were largely lost when the company went bankrupt in 1991.',
                'Exact production month and precise factory attribution cannot be confirmed from the serial alone.',
                'Some SB neck plates display a Neptune, NJ address — this is the importer/corporate address and does not indicate USA manufacture.',
            ],
            verificationTips: [
                'Check the headstock shape: the beak/pointy headstock is characteristic of late-1980s Striker/import models.',
                'Compare the neck plate dimensions and finish (narrower stamped steel vs thick USA die-cast).',
                'Identify the tremolo type and pickup count to narrow the exact Striker model (100, 200, or 300).',
                'Look for Made in Korea or Made in Japan markings on the neck pocket or body cavity.',
                'Consult the Vintage Kramer Serial Guide for corroborating serial examples.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Kramer SB-prefix import format primarily associated with mid-to-late 1980s Striker series models produced at Samick Korea or Japanese contracted facilities.</p><h3>How This Pattern Is Typically Read</h3><p>"SB" is primarily associated with the Kramer Striker Series — the budget/mid-tier overseas import line from the 1980s shred era. The estimated production window is 1986–1989. The digits after SB are the production sequence (${sequenceNumber}). These guitars were manufactured at Samick Korea or Japanese contracted facilities, not the Neptune, NJ American Series production line.</p><h3>What To Verify</h3><ul><li>Kramer original factory records were lost in the 1991 bankruptcy — exact month and factory attribution require physical evidence.</li><li>Check the headstock shape (beak/pointy), neck plate dimensions (narrower stamped steel vs thick die-cast USA plate), and tremolo type to narrow the Striker variant.</li><li>Look for Made in Korea or Made in Japan markings in the neck pocket or body cavity.</li><li>A Neptune, NJ neck plate address is the importer/corporate address, not a Made in USA indicator.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed mid-to-late 1980s Kramer Striker import decode. Physical inspection — headstock shape, neck plate, tremolo, pickup count, and country markings — is the most reliable way to pin down the exact model and year within this era.</p>`,
    };
}
function decodeKoreanStrikerSA(normalized, cleaned) {
    const sequence = normalized.substring(2);
    const sequenceNumber = parseInt(sequence, 10);
    return {
        success: true,
        info: {
            brand: 'Kramer',
            serialNumber: cleaned,
            year: 'mid-to-late 1980s (estimated)',
            factory: 'Samick Korea',
            country: 'South Korea',
            model: 'Striker Series (Striker 100, 200, or 300) or related import line',
            notes: `SA-prefix Kramer serial. The SA designation is associated with mid-to-late 1980s Striker series imports built at the Samick plant in South Korea. The "S" prefix identifies the Samick/Striker overseas import line and "A" denotes a sub-batch production window. Production sequence: ${sequenceNumber}. Because Kramer's original records were lost when the company went bankrupt in 1991, exact production months cannot be confirmed from the serial alone. Cross-reference headstock shape, neck-plate dimensions, tremolo type, and body construction against known Striker variants. Community resources such as the Vintage Kramer Serial Guide can provide corroborating evidence.`,
        },
        patternKey: 'kramer-sa-samick-korea-striker-sequence',
        patternLabel: 'Kramer SA Samick Korea Striker import 1980s sequential',
        additionalContext: {
            title: 'Kramer SA-prefix Striker import serial',
            summary: 'This serial matches the Kramer SA-prefix import format associated with mid-to-late 1980s Striker series models built at Samick Korea.',
            highlights: [
                '"SA" is associated with the Kramer Striker Series — the budget/mid-tier overseas import line from the 1980s shred era.',
                '"S" identifies the Samick/Striker import line; "A" denotes a sub-batch production window.',
                'Estimated production window: mid-to-late 1980s.',
                `Production sequence: ${sequenceNumber}.`,
                'Manufactured at Samick Korea; not the Neptune, NJ American Series production line.',
            ],
            caveats: [
                'Kramer original factory records were lost when the company went bankrupt in 1991.',
                'Exact production month and year cannot be confirmed from the serial alone.',
                'Some SA neck plates display a Neptune, NJ address — this is the importer/corporate address, not a USA manufacture indicator.',
            ],
            verificationTips: [
                'Check the headstock shape: beak/pointy style is characteristic of late-1980s Striker/import models.',
                'Compare neck-plate dimensions and finish (narrower stamped steel vs thick USA die-cast).',
                'Identify the tremolo type and pickup count to narrow the exact Striker model (100, 200, or 300).',
                'Look for Made in Korea markings on the neck pocket or body cavity.',
                'Consult the Vintage Kramer Serial Guide for corroborating serial examples.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Kramer SA-prefix import format associated with mid-to-late 1980s Striker series models built at Samick Korea.</p><h3>How This Pattern Is Typically Read</h3><p>"SA" is associated with the Kramer Striker Series — the budget/mid-tier overseas import line from the 1980s. "S" identifies the Samick/Striker import line and "A" denotes a sub-batch production window. The digits after SA are the production sequence (${sequenceNumber}). These guitars were built at Samick Korea, not the Neptune, NJ American Series line.</p><h3>What To Verify</h3><ul><li>Kramer original factory records were lost in the 1991 bankruptcy — exact month and year require physical evidence.</li><li>Check the headstock shape (beak/pointy), neck-plate dimensions, and tremolo type to narrow the Striker variant.</li><li>Look for Made in Korea markings in the neck pocket or body cavity.</li><li>A Neptune, NJ neck plate address is the importer/corporate address, not a Made in USA indicator.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed mid-to-late 1980s Kramer Striker import decode. Physical inspection — headstock shape, neck plate, tremolo, pickup count, and country markings — is the most reliable way to pin down the exact model and year.</p>`,
    };
}
function decodeKoreanStrikerSP(normalized, cleaned) {
    const sequence = parseInt(normalized.substring(2), 10);
    return {
        success: true,
        info: {
            brand: 'Kramer',
            serialNumber: cleaned,
            year: 'mid-1980s (estimated)',
            factory: 'Korean contract factory (likely Samick or Young Chang)',
            country: 'South Korea',
            model: 'Striker Plus or Striker import series',
            notes: `SP-prefix serials are associated with Korean-built Kramer Striker Plus and import-era Striker models from the mid-1980s. SP is believed to stand for "Striker Plus" or a Korean factory-line identifier. Production sequence: ${sequence}. These guitars were budget/mid-range import models sold under the Kramer brand. Confirm the specific model variant from the headstock logo, body shape, pickup configuration, and neck-plate details.`,
        },
        patternKey: 'kramer-sp-korean-striker-1980s',
        patternLabel: 'Kramer SP Korean Striker import (mid-1980s)',
        additionalContext: {
            title: 'Kramer SP Korean Striker import serial',
            summary: 'This serial matches a Korean-built Kramer SP-prefix format from the mid-1980s, associated with the Striker Plus and Striker import series.',
            highlights: [
                'SP-prefix serials are associated with Korean-built Kramer Striker Plus and import-era Striker models.',
                'SP is believed to stand for "Striker Plus" or a Korean factory-line identifier.',
                `The digits after SP are production sequence ${sequence}.`,
                'These were mid-range import models sold under the Kramer brand in the mid-1980s.',
            ],
            caveats: [
                'Korean Kramer import records from the mid-1980s are incomplete; exact dating is not possible from serial alone.',
                'Multiple Korean factories (Samick, Young Chang, others) produced Kramer imports; the specific factory cannot be confirmed from serial alone.',
                'The serial supports an estimated era; verify the exact model from physical features.',
            ],
            verificationTips: [
                'Check the headstock logo style and any "Made in Korea" country-of-origin text.',
                'Compare body shape (typically a Strat-style or offset variant), pickup layout, and hardware against known mid-1980s Striker specs.',
                'Use online Kramer registry resources or the HTPG serial search for corroborating evidence.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Korean-built Kramer SP-prefix format from the mid-1980s, associated with the Striker Plus and Striker import series.</p><h3>How This Pattern Is Typically Read</h3><p>SP-prefix serials are associated with Korean-built Kramer Striker Plus and import-era Striker models. SP is believed to stand for "Striker Plus" or a Korean factory-line identifier. The digits after SP (${sequence}) are the production sequence. These were mid-range import models sold under the Kramer brand in the mid-1980s.</p><h3>What To Verify</h3><ul><li>Check the headstock logo style and any "Made in Korea" text on the neck plate.</li><li>Compare body shape, pickup layout, and hardware against known mid-1980s Striker specs.</li><li>Use online Kramer registry resources or the HTPG serial search for additional context.</li></ul>`,
    };
}
function decodeModernNumericWithSuffix(normalized, cleaned) {
    const yearDigits = normalized.substring(0, 2);
    const monthDigits = normalized.substring(2, 4);
    const factoryCode = normalized.substring(4, 6);
    const sequence = normalized.substring(6, 10);
    const suffix = normalized[10];
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);
    const year = (yearNum < 50 ? 2000 + yearNum : 1900 + yearNum).toString();
    const monthName = (monthNum >= 1 && monthNum <= 12) ? getMonthName(monthNum) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year,
        ...(monthName ? { month: monthName } : {}),
        factory: 'Gibson/Epiphone-era import facility',
        country: 'South Korea, China, or Indonesia',
        notes: `Modern 10-digit Kramer serial with suffix letter. Year: ${year}${monthName ? `, month: ${monthName}` : ''}; factory code: ${factoryCode}; production sequence: ${sequenceNumber}; suffix: "${suffix}" (may indicate production shift or batch). This format is associated with Gibson/Epiphone-era import production. Verify with headstock markings and model features.`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-modern-10digit-suffix-letter-yymm-sequence',
        patternLabel: 'Kramer modern 10-digit YYMM+factory+sequence+suffix',
        additionalContext: {
            title: 'Kramer modern 10-digit serial with suffix letter',
            summary: 'This serial matches a modern 10-digit Kramer format with a trailing suffix letter, associated with Gibson/Epiphone-era import production.',
            highlights: [
                `Year decoded from first two digits: ${year}.`,
                ...(monthName ? [`Month decoded as ${monthName}.`] : []),
                `Factory code: ${factoryCode}; production sequence: ${sequenceNumber}.`,
                `Suffix letter "${suffix}" may indicate production shift or batch designation.`,
            ],
            caveats: [
                'The suffix letter meaning is not publicly documented for all Kramer import runs.',
                'Country of origin should be confirmed from headstock markings.',
            ],
            verificationTips: [
                'Check the headstock for "Made in Korea", "Made in China", or "Made in Indonesia".',
                'Compare model features against Kramer catalog from the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a modern 10-digit Kramer format with a trailing suffix letter, associated with Gibson/Epiphone-era import production.</p><h3>How This Pattern Is Typically Read</h3><p>Year: ${year}${monthName ? `, month: ${monthName}` : ''}. Factory code: ${factoryCode}. Production sequence: ${sequenceNumber}. Suffix letter "${suffix}" may indicate production shift or batch designation.</p><h3>What To Verify</h3><ul><li>Check the headstock for country-of-origin marking.</li><li>Compare model features against Kramer catalog from the decoded year.</li></ul>`,
    };
}
function decodeSamickKoreaSD(normalized, cleaned) {
    const sequence = parseInt(normalized.substring(2), 10);
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: '1987-1989 (estimated)',
        factory: 'Samick',
        country: 'South Korea',
        model: 'Striker Series or entry-level import line',
        notes: `SD-prefix Kramer import serial. The S prefix is commonly associated with Striker-series imports, and SD is treated as a later Samick Korea batch prefix from roughly 1987-1989. The digits are a production sequence rather than an exact date code. Sequence: ${sequence}. Neck plates from this era may show the Neptune, NJ address even on Korean-built import models; confirm with headstock style, hardware, and body construction.`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-sd-samick-korea-striker-sequence',
        patternLabel: 'Kramer SD Samick Korea Striker/import sequence',
        additionalContext: {
            title: 'Kramer SD Samick Korea import serial',
            summary: 'This serial matches an SD-prefix Kramer import pattern commonly associated with late-1980s Samick Korea Striker-family production.',
            highlights: [
                'SD is treated as a Samick Korea import batch prefix.',
                'This prefix is commonly associated with Striker and other entry-level import lines.',
                `The digits after SD are production sequence ${sequence}.`,
            ],
            caveats: [
                'This format provides an estimated late-1980s era, not an exact production date.',
                'Neptune, NJ neck plates can appear on imported Kramers and do not prove USA manufacture.',
                'Kramer import records from this period are incomplete.',
            ],
            verificationTips: [
                'Check for a pointy late-1980s Kramer headstock and logo style.',
                'Compare the tremolo and hardware to Striker-series specs.',
                'Inspect body construction and electronics cavity details if model identification matters.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches an SD-prefix Kramer import pattern commonly associated with late-1980s Samick Korea Striker-family production.</p><h3>How This Pattern Is Typically Read</h3><p>SD is treated as a Samick Korea import batch prefix. This prefix is commonly associated with Striker and other entry-level import lines. The digits after SD are production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>This format provides an estimated late-1980s era, not an exact production date.</li><li>Neptune, NJ neck plates can appear on imported Kramers and do not prove USA manufacture.</li><li>Kramer import records from this period are incomplete.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as late-1980s Samick Korea import evidence, then verify the exact model from the headstock, tremolo, pickup layout, and construction.</p>`,
    };
}
function decodeModernGibsonEraFactoryNumeric(normalized, cleaned) {
    const factoryCode = normalized.substring(0, 2);
    const yearPart = normalized.substring(2, 4);
    const monthPart = normalized.substring(4, 5);
    const sequence = normalized.substring(5);
    const yearValue = parseInt(yearPart, 10);
    const monthValue = parseInt(monthPart, 10);
    const monthName = getMonthName(monthValue);
    const fullYear = Number.isNaN(yearValue) ? undefined : 2000 + yearValue;
    const sequenceNumber = parseInt(sequence, 10);
    if (!fullYear || !monthName || fullYear < 2008 || fullYear > 2019) {
        return {
            success: false,
            error: 'Unable to decode this Kramer serial number.',
        };
    }
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: fullYear.toString(),
        month: monthName,
        factory: factoryCode === '31' ? 'Qingdao' : `Factory ${factoryCode}`,
        country: factoryCode === '31' ? 'China' : undefined,
        model: 'Modern Gibson-era import model',
        notes: `Modern 9-digit Kramer import serial interpreted as FFYYMSSSS. This Gibson/Epiphone-era format uses the first two digits as factory code, then two-digit year, one-digit month, and a four-digit sequence. Factory code: ${factoryCode}; year: ${fullYear}; month: ${monthName}; production sequence: ${sequenceNumber}. Factory code 31 is commonly associated with Gibson/Epiphone Qingdao production in China. Verify with back-of-headstock serial placement and country-of-origin markings.`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-modern-gibson-era-9-digit-factory-yym-sequence',
        patternLabel: 'Kramer modern Gibson-era 9-digit factory YYM sequence',
        additionalContext: {
            title: 'Kramer modern Gibson-era 9-digit import serial',
            summary: 'This serial matches a 9-digit all-numeric Gibson/Epiphone-era import format used on modern Kramer instruments.',
            highlights: [
                `The factory code is ${factoryCode}${factoryCode === '31' ? ', commonly associated with Qingdao, China' : ''}.`,
                `The digits ${yearPart} decode as production year ${fullYear}.`,
                `The digit ${monthPart} decodes as ${monthName}.`,
                `The final four digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This is not a vintage 1980s Kramer neck-plate serial format.',
                'The serial identifies production date and factory code, not the exact model by itself.',
                'Confirm with country-of-origin markings and model specifications.',
            ],
            verificationTips: [
                'Look for the serial printed, stamped, or stickered on the back of the headstock.',
                'Compare the body style and hardware to modern Pacer, Baretta, Assault, and related import specs.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a 9-digit all-numeric Gibson/Epiphone-era import format used on modern Kramer instruments.</p><h3>How This Pattern Is Typically Read</h3><p>The factory code is ${factoryCode}${factoryCode === '31' ? ', commonly associated with Qingdao, China' : ''}. The digits ${yearPart} decode as production year ${fullYear}. The digit ${monthPart} decodes as ${monthName}. The final four digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This is not a vintage 1980s Kramer neck-plate serial format.</li><li>The serial identifies production date and factory code, not the exact model by itself.</li><li>Confirm with country-of-origin markings and model specifications.</li></ul>`,
    };
}
function decodeModernGibsonEraNumeric(normalized, cleaned) {
    // Primary parse: YY-MM-FF-SSSSS
    let yearPart = normalized.substring(0, 2);
    let monthPart = normalized.substring(2, 4);
    let factoryCode = normalized.substring(4, 6);
    let sequence = normalized.substring(6);
    let yearValue = parseInt(yearPart, 10);
    let monthValue = parseInt(monthPart, 10);
    let monthName = getMonthName(monthValue);
    let fullYear = Number.isNaN(yearValue) ? undefined : 2000 + yearValue;
    let layout = 'YYMMFFSSSSS';
    // Fallback: FF-YY-MM-SSSSS (factory-first layout used on some earlier Gibson-era runs)
    if (!fullYear || !monthName || monthValue < 1 || monthValue > 12) {
        const ffFactory = normalized.substring(0, 2);
        const ffYear = normalized.substring(2, 4);
        const ffMonth = normalized.substring(4, 6);
        const ffSeq = normalized.substring(6);
        const ffYearValue = parseInt(ffYear, 10);
        const ffMonthValue = parseInt(ffMonth, 10);
        const ffMonthName = getMonthName(ffMonthValue);
        const ffFullYear = Number.isNaN(ffYearValue) ? undefined : 2000 + ffYearValue;
        if (ffFullYear && ffMonthName && ffMonthValue >= 1 && ffMonthValue <= 12) {
            yearPart = ffYear;
            monthPart = ffMonth;
            factoryCode = ffFactory;
            sequence = ffSeq;
            yearValue = ffYearValue;
            monthValue = ffMonthValue;
            monthName = ffMonthName;
            fullYear = ffFullYear;
            layout = 'FFYYMMSSSSS';
        }
    }
    if (!fullYear || !monthName || monthValue < 1 || monthValue > 12) {
        return {
            success: false,
            error: 'Unable to decode this Kramer serial number.',
        };
    }
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: fullYear.toString(),
        month: monthName,
        factory: `Factory ${factoryCode}`,
        country: factoryCode === '13' ? 'China' : undefined,
        model: 'Modern Gibson-era import model, commonly Focus, Striker, or entry-level Kramer family',
        notes: `Modern 11-digit Kramer import serial interpreted as ${layout}. Because Gibson owns Kramer, many post-2008 budget/import Kramer models use the all-numeric format also seen on Epiphone instruments. Year: ${fullYear}; month: ${monthName}; factory code: ${factoryCode}; production sequence: ${sequenceNumber}. Factory code 13 is commonly associated with authorized Chinese import production. Verify with the back-of-headstock serial placement, country-of-origin marking, and model specs.`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-modern-gibson-era-11-digit-yymm-factory-sequence',
        patternLabel: 'Kramer modern Gibson-era 11-digit YYMM factory sequence',
        additionalContext: {
            title: 'Kramer modern Gibson-era import serial',
            summary: 'This serial matches the 11-digit all-numeric import format used on many modern Gibson-era Kramer instruments.',
            highlights: [
                `The digits ${yearPart} decode as production year ${fullYear}.`,
                `The digits ${monthPart} decode as ${monthName}.`,
                `The factory code is ${factoryCode}${factoryCode === '13' ? ', commonly associated with Chinese import production' : ''}.`,
                `The final five digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This is not the vintage 1980s Kramer neck-plate serial system.',
                'The serial identifies production date and factory code, not the exact model by itself.',
                'Factory-code public references can be incomplete, so confirm with country-of-origin markings.',
            ],
            verificationTips: [
                'Look for the serial printed or stamped on the back of the headstock.',
                'Check for a nearby Made in China or other country-of-origin sticker or stamp.',
                'Compare hardware and pickup layout against modern Focus, Striker, Baretta, and related import specs.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the 11-digit all-numeric import format used on many modern Gibson-era Kramer instruments.</p><h3>How This Pattern Is Typically Read</h3><p>The digits ${yearPart} decode as production year ${fullYear}. The digits ${monthPart} decode as ${monthName}. The factory code is ${factoryCode}${factoryCode === '13' ? ', commonly associated with Chinese import production' : ''}. The final five digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This is not the vintage 1980s Kramer neck-plate serial system.</li><li>The serial identifies production date and factory code, not the exact model by itself.</li><li>Factory-code public references can be incomplete, so confirm with country-of-origin markings.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a modern Gibson-era Kramer import decode, then confirm the exact model from the headstock serial placement, country marking, hardware, and specs.</p>`,
    };
}
function decodeJapanSC(normalized, cleaned) {
    const sequence = parseInt(normalized.substring(2), 10);
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: 'mid-to-late 1980s (estimated)',
        factory: 'ESP Japan-associated overseas production',
        country: 'Japan',
        model: 'Overseas import model, commonly Focus or Striker family',
        notes: `SC-prefix Kramer plate serials are commonly associated with Japanese-made overseas models from the mid-to-late 1980s, especially Focus and Striker-family instruments. Sequence: ${sequence}. These vintage import serials are generally arbitrary sequence numbers rather than exact date codes. Confirm the model and era from the neck plate style, headstock shape, logo, and hardware.`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-sc-japan-focus-striker-4-digit',
        patternLabel: 'Kramer SC Japan Focus/Striker 4-digit',
        additionalContext: {
            title: 'Kramer SC import serial',
            summary: 'This serial matches a Kramer SC-prefix overseas plate format commonly associated with Japanese-made Focus and Striker-era instruments.',
            highlights: [
                'SC-prefix plate serials are commonly associated with overseas Kramer models from the mid-to-late 1980s.',
                'This pattern is often linked to Japanese-made Focus and Striker-family instruments.',
                `The four digits after SC are best treated as production sequence ${sequence}.`,
            ],
            caveats: [
                'This pattern supports an estimated import era, not an exact production date.',
                'Kramer vintage records are incomplete, and plate sequences were not always chronological.',
                'The serial alone does not identify the exact model or body construction.',
            ],
            verificationTips: [
                'Check whether the guitar has a smaller overseas-style die-cast neck plate.',
                'Compare the headstock shape, logo style, pickups, and tremolo to Focus and Striker examples.',
                'Use the Vintage Kramer registry and physical features for tighter model identification.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Kramer SC-prefix overseas plate format commonly associated with Japanese-made Focus and Striker-era instruments.</p><h3>How This Pattern Is Typically Read</h3><p>SC-prefix plate serials are commonly associated with overseas Kramer models from the mid-to-late 1980s. This pattern is often linked to Japanese-made Focus and Striker-family instruments. The four digits after SC are best treated as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>This pattern supports an estimated import era, not an exact production date.</li><li>Kramer vintage records are incomplete, and plate sequences were not always chronological.</li><li>The serial alone does not identify the exact model or body construction.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as Japanese import-era evidence, then verify the exact model from neck plate style, headstock shape, logo, pickups, tremolo, and registry examples.</p>`,
    };
}
function decodeSamickKoreaSE(normalized, cleaned) {
    const sequence = parseInt(normalized.substring(2), 10);
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: 'late 1980s to early 1990s (estimated)',
        factory: 'Samick',
        country: 'South Korea',
        model: 'Overseas import model, commonly Striker, Aerostar, or Focus family',
        notes: `SE-prefix serials are commonly associated with Korean-made Kramer overseas models from the late 1980s to early 1990s, often from Samick production. Sequence: ${sequence}. This format is generally seen on import lines such as Striker, Aerostar, and Focus rather than USA-made Kramer models. Confirm the exact model from the headstock, neck plate, body construction, and hardware.`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-se-samick-korea-4-digit',
        patternLabel: 'Kramer SE Samick Korea 4-digit',
        additionalContext: {
            title: 'Kramer SE import serial',
            summary: 'This serial matches a Korean-made Kramer SE-prefix import format commonly associated with late-1980s to early-1990s Samick production.',
            highlights: [
                'SE-prefix serials are commonly associated with Korean-made Kramer overseas models.',
                'The format appears on import-era models such as Striker, Aerostar, and Focus-family instruments.',
                `The four digits after SE are best treated as production sequence ${sequence}.`,
            ],
            caveats: [
                'This pattern supports an estimated import era, not an exact production date.',
                'Kramer records from this period are incomplete, so physical feature checks matter.',
                'Some late-1980s overseas models used plywood or laminated bodies, so construction should be verified directly.',
            ],
            verificationTips: [
                'Check headstock logo style, neck-plate markings, and country-of-origin text.',
                'Compare pickup layout, tremolo, and body construction against Striker, Aerostar, and Focus examples.',
                'Use the serial as era evidence, then verify the exact model from physical features.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Korean-made Kramer SE-prefix import format commonly associated with late-1980s to early-1990s Samick production.</p><h3>How This Pattern Is Typically Read</h3><p>SE-prefix serials are commonly associated with Korean-made Kramer overseas models. The format appears on import-era models such as Striker, Aerostar, and Focus-family instruments. The four digits after SE are best treated as production sequence ${sequence}.</p><h3>What To Verify</h3><ul><li>This pattern supports an estimated import era, not an exact production date.</li><li>Kramer records from this period are incomplete, so physical feature checks matter.</li><li>Some late-1980s overseas models used plywood or laminated bodies, so construction should be verified directly.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as Korean import-era evidence, then verify the exact model from headstock logo, neck-plate markings, hardware, and body construction.</p>`,
    };
}
function decodeSaemyungChinaSJ(normalized, cleaned) {
    const yearPart = normalized.substring(2, 4);
    const monthPart = normalized.substring(4, 6);
    const sequence = normalized.substring(6);
    const yy = parseInt(yearPart, 10);
    const monthValue = parseInt(monthPart, 10);
    const monthName = getMonthName(monthValue);
    const fullYear = Number.isNaN(yy)
        ? undefined
        : yy <= 24
            ? 2000 + yy
            : 1900 + yy;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: fullYear ? fullYear.toString() : undefined,
        month: monthName,
        factory: 'Saemyung',
        country: 'China',
        model: 'MusicYo/Gibson-era import model, commonly Striker or Pacer Classic family',
        notes: `SJ-prefix Kramer import format interpreted as SJ + YYMM + sequence. The SJ prefix is commonly associated with Saemyung production in China during the Gibson/MusicYo import era. Year: ${fullYear ?? 'unknown'}; month: ${monthName || 'unknown'}; production sequence: ${sequenceNumber}. This is not a vintage American Series neck-plate format, so verify model and country-of-origin from the back-of-headstock decal, headstock logo, hardware, and Vintage Kramer Registry examples.`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-sj-saemyung-china-yymm-sequence',
        patternLabel: 'Kramer SJ Saemyung China YYMM sequence',
        additionalContext: {
            title: 'Kramer SJ MusicYo-era import serial',
            summary: 'This serial matches a Kramer SJ-prefix import format commonly associated with Saemyung China production during the Gibson/MusicYo era.',
            highlights: [
                'SJ is treated as a Saemyung China import factory prefix.',
                `The digits ${yearPart} decode as production year ${fullYear ?? 'unknown'}.`,
                `The digits ${monthPart} decode as ${monthName || 'unknown month'}.`,
                `The final digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This is not the classic 1980s American Series letter-prefix neck-plate system.',
                'Kramer import records are incomplete, so exact model confirmation requires physical features.',
                'The serial identifies a production date/factory family, not the exact model name.',
            ],
            verificationTips: [
                'Check for a decal serial on the back of the headstock.',
                'Compare hardware, headstock logo, and pickup layout against MusicYo-era Striker and Pacer Classic specs.',
                'Use the Vintage Kramer Registry and model features for confirmation.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a Kramer SJ-prefix import format commonly associated with Saemyung China production during the Gibson/MusicYo era.</p><h3>How This Pattern Is Typically Read</h3><p>SJ is treated as a Saemyung China import factory prefix. The digits ${yearPart} decode as production year ${fullYear ?? 'unknown'}. The digits ${monthPart} decode as ${monthName || 'unknown month'}. The final digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This is not the classic 1980s American Series letter-prefix neck-plate system.</li><li>Check for a decal serial on the back of the headstock.</li><li>Compare hardware, headstock logo, and pickup layout against MusicYo-era Striker and Pacer Classic specs.</li></ul>`,
    };
}
function decodeSamickIndonesiaSI(normalized, cleaned) {
    const yearPart = normalized.substring(2, 4);
    const monthPart = normalized.substring(4, 6);
    const sequence = normalized.substring(6);
    const yy = parseInt(yearPart, 10);
    const monthValue = parseInt(monthPart, 10);
    const monthName = getMonthName(monthValue);
    const fullYear = Number.isNaN(yy)
        ? undefined
        : yy <= 24
            ? 2000 + yy
            : 1900 + yy;
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: fullYear ? fullYear.toString() : undefined,
        month: monthName,
        factory: 'Samick Indonesia',
        country: 'Indonesia',
        notes: `SI-prefix import format interpreted as SI + YYMM + sequence. Sequence: ${sequence}. SI is commonly associated with Samick Indonesia production on modern/import-era Kramer runs.`,
    };
    return { success: true, info };
}
function decodeGibsonEraJKIndonesia(normalized, cleaned) {
    const yearPart = normalized.substring(2, 4);
    const monthPart = normalized.substring(4, 6);
    const sequence = normalized.substring(6);
    const yy = parseInt(yearPart, 10);
    const monthValue = parseInt(monthPart, 10);
    const monthName = getMonthName(monthValue);
    const fullYear = Number.isNaN(yy)
        ? undefined
        : yy <= 24
            ? 2000 + yy
            : 1900 + yy;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: fullYear ? fullYear.toString() : undefined,
        month: monthName,
        factory: 'Indonesian factory (Gibson/Epiphone era)',
        country: 'Indonesia',
        model: 'Modern Gibson/Epiphone-era import model, commonly Focus, Striker, or Pacer Classic',
        notes: `JK-prefix Kramer import format interpreted as JK + YYMM + sequence. The JK prefix identifies an Indonesian factory used during the Gibson/Epiphone ownership era for entry-to-mid tier Kramer models (Focus, Striker, Pacer Classic). This is not a vintage 1980s American Series neck-plate format. Year: ${fullYear ?? 'unknown'}; month: ${monthName || 'unknown'}; production sequence: ${sequenceNumber}. Verify with the back-of-headstock serial placement, country-of-origin marking, and model specs.`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-jk-indonesia-gibson-era-yymm-sequence',
        patternLabel: 'Kramer JK Indonesian factory Gibson/Epiphone era YYMM sequence',
        additionalContext: {
            title: 'Kramer JK Indonesian factory import serial',
            summary: 'This serial matches the Kramer JK-prefix import format used on Gibson/Epiphone-era Indonesian factory instruments. JK identifies a specific Indonesian production facility, and the remaining digits encode year, month, and a rolling production sequence.',
            highlights: [
                'JK identifies an Indonesian factory used during the Gibson/Epiphone ownership era.',
                `The digits ${yearPart} decode as production year ${fullYear ?? 'unknown'}.`,
                `The digits ${monthPart} decode as ${monthName || 'unknown month'}.`,
                `The final four digits decode as production sequence ${sequenceNumber}.`,
                'Common on entry-to-mid tier models: Focus, Striker, and Pacer Classic.',
            ],
            caveats: [
                'This is not the classic 1980s American Series letter-prefix neck-plate system.',
                'The serial identifies production date and factory origin, not the exact model by itself.',
                'Verify country-of-origin from the headstock decal or body markings rather than the serial prefix alone.',
            ],
            verificationTips: [
                'Check for a printed or stickered serial on the back of the headstock.',
                'Look for a "Made in Indonesia" country-of-origin stamp or sticker.',
                'Compare headstock logo style, hardware, and pickup layout against known Focus, Striker, and Pacer Classic specs from this era.',
                'The serial placement and headstock logo style help distinguish this from vintage 1980s Kramer formats.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the Kramer JK-prefix import format used on Gibson/Epiphone-era Indonesian factory instruments. JK identifies a specific Indonesian production facility, and the remaining digits encode year, month, and a rolling production sequence.</p><h3>How This Pattern Is Typically Read</h3><p>JK identifies an Indonesian factory used during the Gibson/Epiphone ownership era. The digits ${yearPart} decode as production year ${fullYear ?? 'unknown'}. The digits ${monthPart} decode as ${monthName || 'unknown month'}. The final four digits decode as production sequence ${sequenceNumber}. Common on entry-to-mid tier models such as the Focus, Striker, and Pacer Classic.</p><h3>What To Verify</h3><ul><li>This is not the classic 1980s American Series letter-prefix neck-plate system.</li><li>Check for a printed or stickered serial on the back of the headstock and a "Made in Indonesia" country-of-origin marking.</li><li>Compare headstock logo style, hardware, and pickup layout against known Focus, Striker, and Pacer Classic specs from this era.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed Gibson/Epiphone-era Indonesian import decode. Physical features — headstock logo, country marking, hardware, and model name — are the most reliable ways to confirm the exact model and variant.</p>`,
    };
}
function decodeVintage1980sSStrikerSequential(normalized, cleaned) {
    const sequence = normalized.substring(1);
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: '1986–1989 (estimated)',
        factory: 'Samick Korea or Japanese contracted facility',
        country: 'South Korea or Japan',
        model: 'Striker Series or Aerostar Series',
        notes: `S-prefix Kramer import serial from the vintage late-1980s Striker/Aerostar production era. The five digits ${sequence} are a sequential production number (${sequenceNumber}) rather than a year-encoded date code. Kramer used S-prefix neck plates on budget overseas import lines — primarily the Striker 100, 200, and 300 and select Aerostar models — manufactured at Samick Korea and Japanese contracted facilities during the peak of the 1980s shred-guitar boom (roughly 1986–1989). Factory records from this era are incomplete and production logs have largely been lost, so exact month/year dating is not possible from the serial alone. Confirm model and origin from the headstock shape (beak/banana-style), pickup count, and neck-plate finish (chrome or black).`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-vintage-1980s-s-striker-sequential',
        patternLabel: 'Kramer vintage 1980s S-prefix Striker/Aerostar sequential',
        additionalContext: {
            title: 'Kramer vintage S-prefix Striker/Aerostar serial',
            summary: 'This serial matches the vintage late-1980s Kramer S-prefix import format used on Striker and Aerostar series overseas models. The five digits are a production sequence, not a date code.',
            highlights: [
                'S indicates a late-1980s Kramer import neck-plate serial, distinct from the American Series.',
                `The digits ${sequence} are a sequential production number (${sequenceNumber}), not a year-encoded date code.`,
                'Typically found on Striker 100/200/300 and Aerostar models from 1986–1989.',
                'Manufactured at Samick Korea or Japanese contracted facilities.',
            ],
            caveats: [
                'Kramer production records from this era are incomplete and largely lost.',
                'Exact month and year cannot be determined from the serial alone.',
                'S-prefix serials are import-line identifiers, not American Series neck-plate codes.',
            ],
            verificationTips: [
                'Check the headstock shape: beak/banana style is characteristic of late-1980s Striker/Aerostar imports.',
                'Note the number of pickups and tremolo type to narrow the exact model (Striker 100, 200, or 300).',
                'Look for a Made in Korea or Made in Japan stamp on the back of the body or neck pocket.',
                'Use the Vintage Kramer Serial Number Research Database to cross-reference similar builds.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches the vintage late-1980s Kramer S-prefix import format used on Striker and Aerostar series models. The five digits are a production sequence, not a year-encoded date code.</p><h3>How This Pattern Is Typically Read</h3><p>S indicates a late-1980s Kramer import neck-plate serial. The digits ${sequence} are sequential production number ${sequenceNumber}. This format was used on the Striker 100, 200, and 300 and select Aerostar models, built at Samick Korea and Japanese contracted facilities from roughly 1986 to 1989. Kramer records from this era are largely lost, so exact dating requires physical inspection.</p><h3>What To Verify</h3><ul><li>Headstock shape: the beak or banana-style pointy headstock is characteristic of late-1980s Striker/Aerostar imports.</li><li>Pickup count and tremolo type help narrow the exact model within the Striker range.</li><li>Look for Made in Korea or Made in Japan markings on the back of the body or neck pocket.</li></ul><h3>Coal Creek Guitars Note</h3><p>Use this as a confirmed late-1980s Kramer import decode. Physical features — headstock shape, hardware, neck-plate finish, and country markings — are the most reliable ways to pin down the exact model and year.</p>`,
    };
}
function decodeMusicYoStrikerS(normalized, cleaned) {
    const yearPart = normalized.substring(1, 3);
    const sequence = normalized.substring(3);
    const yearValue = parseInt(yearPart, 10);
    const fullYear = Number.isNaN(yearValue) ? undefined : 2000 + yearValue;
    const sequenceNumber = parseInt(sequence, 10);
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: fullYear ? fullYear.toString() : undefined,
        factory: 'MusicYo/Gibson-era import production',
        country: 'South Korea or China',
        model: 'Striker Series',
        notes: `S-prefix 5-digit Kramer serial interpreted as a MusicYo/Gibson-era Striker format: S + YY + sequence. The digits ${yearPart} indicate ${fullYear ?? 'an unknown year'} and the remaining digits are production sequence ${sequenceNumber}. This is not a vintage 1980s American Kramer neck-plate format; verify with the headstock logo, back-of-headstock or neck-plate serial placement, country-of-origin markings, and hardware.`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-musicyo-striker-s-yy-sequence',
        patternLabel: 'Kramer MusicYo Striker S-prefix YY sequence',
        additionalContext: {
            title: 'Kramer MusicYo-era Striker serial',
            summary: 'This serial matches a short S-prefix Kramer import format commonly associated with MusicYo-era Striker Series instruments.',
            highlights: [
                'S is treated as a Striker/MusicYo-era import prefix.',
                `The digits ${yearPart} decode as production year ${fullYear ?? 'unknown'}.`,
                `The remaining digits decode as production sequence ${sequenceNumber}.`,
            ],
            caveats: [
                'This is not the vintage 1980s American Series letter-prefix neck-plate system.',
                'Country can vary across MusicYo-era import production, so confirm from physical markings.',
                'The serial identifies likely era/series, not exact model configuration by itself.',
            ],
            verificationTips: [
                'Check for a block-style Kramer logo and MusicYo-era Striker features.',
                'Compare pickup layout and tremolo hardware against 2000s Striker specs.',
                'Look for a country-of-origin stamp or sticker on the back of the headstock.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This serial matches a short S-prefix Kramer import format commonly associated with MusicYo-era Striker Series instruments.</p><h3>How This Pattern Is Typically Read</h3><p>S is treated as a Striker/MusicYo-era import prefix. The digits ${yearPart} decode as production year ${fullYear ?? 'unknown'}. The remaining digits decode as production sequence ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>This is not the vintage 1980s American Series letter-prefix neck-plate system.</li><li>Country can vary across MusicYo-era import production, so confirm from physical markings.</li><li>The serial identifies likely era and series, not exact model configuration by itself.</li></ul>`,
    };
}
function decodeModernSamickS(normalized, cleaned) {
    const yearPart = normalized.substring(1, 3);
    const monthPart = normalized.substring(3, 5);
    let sequence = normalized.substring(5);
    const yearValue = parseInt(yearPart, 10);
    let monthValue = parseInt(monthPart, 10);
    const fullYear = Number.isNaN(yearValue)
        ? undefined
        : yearValue <= 24
            ? 2000 + yearValue
            : 1900 + yearValue;
    let monthName = getMonthName(monthValue);
    // Some S-prefix runs appear to use a single month digit after YY
    // (e.g., S106020848 => YY=10, M=6, sequence=020848).
    if (!monthName) {
        const singleMonthDigit = parseInt(normalized.charAt(3), 10);
        const singleMonthName = getMonthName(singleMonthDigit);
        if (singleMonthName) {
            monthValue = singleMonthDigit;
            monthName = singleMonthName;
            sequence = normalized.substring(4);
        }
    }
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: fullYear ? fullYear.toString() : undefined,
        month: monthName,
        factory: 'Samick',
        country: 'South Korea',
        notes: `Modern S-prefix import format interpreted as S + YYMM + sequence${monthPart && !getMonthName(parseInt(monthPart, 10)) && monthName ? ' (single-digit month fallback applied as S + YY + M + sequence)' : ''}. Sequence: ${sequence}. S prefix is commonly associated with Samick Korea on Gibson-era imports; confirm with country-of-origin stamp for certainty.`,
    };
    return { success: true, info };
}
function getPrefixYearRange(prefix) {
    switch (prefix) {
        case 'A':
            return '1980–early 1981';
        case 'B':
            return 'early 1981–early 1983';
        default:
            return 'mid-1980s (approx.)';
    }
}
function getOverseasYearRange(prefix) {
    if (prefix === 'AB')
        return '1980-1992 (estimated)';
    if (prefix === 'AC')
        return 'late 1980s (estimated)';
    if (prefix === 'CF')
        return '1985-1989 (estimated)';
    if (prefix === 'FA')
        return 'late 1985–1986';
    if (prefix === 'FB')
        return '1987–1988';
    if (prefix === 'XL')
        return 'late 1980s (estimated)';
    return undefined;
}
function getOverseasCountry(prefix) {
    if (prefix === 'AB')
        return 'South Korea';
    if (prefix === 'AC')
        return 'South Korea';
    if (prefix === 'CF')
        return 'Japan';
    if (prefix === 'XL')
        return 'South Korea';
    return undefined;
}
function decodeKBModernImport(normalized, cleaned) {
    const sequence = normalized.substring(2);
    const info = {
        brand: 'Kramer',
        serialNumber: cleaned,
        year: '2000s-2010s (estimated)',
        factory: 'Korean or Indonesian import factory (Gibson/Epiphone era)',
        country: 'South Korea or Indonesia',
        model: 'Modern budget/import line (Kramer under Gibson ownership)',
        notes: `KB-prefix Kramer serial from the Gibson/MusicYo ownership era. KB-prefix instruments are associated with budget and mid-range import lines produced in Korea or Indonesia during the 2000s–2010s. Production sequence: ${parseInt(sequence, 10).toLocaleString()}.`,
    };
    return {
        success: true,
        info,
        patternKey: 'kramer-kb-modern-gibson-era-import',
        patternLabel: 'Kramer KB modern import (Gibson era)',
        additionalContext: {
            title: 'Kramer KB modern import serial',
            summary: 'This KB-prefix serial indicates a Kramer produced under Gibson ownership, likely in Korea or Indonesia during the 2000s–2010s budget import era.',
            highlights: [
                'KB-prefix Kramers were produced in Korea or Indonesia as part of the brand\'s budget and mid-range import lines.',
                'Gibson acquired Kramer in 1997 and re-launched the brand around 2009–2010 with a mix of import and USA models.',
                `Production sequence: ${parseInt(sequence, 10).toLocaleString()}.`,
            ],
            caveats: [
                'No year, month, or specific factory is encoded directly in this KB serial format.',
                'Physical features (headstock logo, hardware style, neck plate) can help narrow the production year.',
            ],
            verificationTips: [
                'Check the back of the headstock and neck plate for country of origin markings (Made in Korea or Made in Indonesia).',
                'Compare the headstock logo and body routing against Gibson-era Kramer catalog images from 2009–2015.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>This KB-prefix serial identifies a Kramer built under Gibson ownership during the 2000s–2010s import era. KB-prefix instruments were produced in Korea or Indonesia as budget and mid-range offerings.</p><h3>Production Context</h3><p>Gibson re-acquired and relaunched the Kramer brand around 2009–2010, producing a range of import instruments alongside USA Custom Shop models. KB-prefix serials are associated with the Korean/Indonesian import side of that lineup.</p><h3>What's Encoded</h3><p>This format is a plain sequential prefix — no year or factory is directly encoded. Check the headstock logo, hardware details, and neck plate against known Gibson-era Kramer catalog images to identify the specific model and approximate year.</p><h3>Coal Creek Guitars Note</h3><p>Production sequence: ${parseInt(sequence, 10).toLocaleString()}.</p>`,
    };
}
function decodeShortSPlateSerial(normalized, cleaned) {
    const sequence = normalized.substring(1);
    const sequenceNumber = parseInt(sequence, 10);
    return {
        success: true,
        info: {
            brand: 'Kramer',
            serialNumber: cleaned,
            year: '1980s (estimated)',
            country: 'South Korea or Japan',
            model: 'Striker Series or related import line',
            notes: `Short S-prefix Kramer serial. The "S" prefix is associated with the Striker import series and overseas Samick/Korean-era production. Short S serials (1–4 digits after the prefix) do not encode a production year; they are treated as sequential plate numbers. Sequence: ${sequenceNumber}. Because Kramer's factory records from this era are largely incomplete, exact dating requires physical inspection — headstock shape, neck-plate dimensions, tremolo type, and country-of-origin markings.`,
        },
        patternKey: 'kramer-short-s-striker-import-sequential',
        patternLabel: 'Kramer short S-prefix Striker import sequential',
        additionalContext: {
            title: 'Kramer short S-prefix serial',
            summary: 'Short S-prefix Kramer serials (1–4 digits) are associated with the Striker import series. These are sequential plate numbers without encoded production dates.',
            highlights: [
                '"S" prefix identifies the Striker import line or Samick/Korean-era Kramer production.',
                `Plate sequence: ${sequenceNumber}.`,
                'These short serials do not encode a production year — era is estimated as 1980s.',
            ],
            caveats: [
                'Kramer factory records from this era are largely incomplete.',
                'Exact year and factory cannot be confirmed from the serial alone.',
            ],
            verificationTips: [
                'Check the headstock shape (beak/pointy) and neck-plate details.',
                'Look for Made in Korea or Made in Japan markings.',
                'Compare hardware and pickup configuration against known Striker series specs.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>Short S-prefix Kramer serials (1–4 digits) are associated with the Striker import series and Samick/Korean-era production. These are sequential plate numbers without encoded production dates.</p><h3>How This Pattern Is Typically Read</h3><p>"S" identifies the Striker import line or Samick/Korean-era Kramer production. Plate sequence: ${sequenceNumber}. These short serials do not encode a production year — era is estimated as 1980s.</p><h3>What To Verify</h3><ul><li>Kramer factory records from this era are largely incomplete — exact year requires physical evidence.</li><li>Check the headstock shape, neck-plate dimensions, and tremolo type to identify the Striker model.</li><li>Look for Made in Korea or Made in Japan markings in the neck pocket or on the neck plate.</li></ul>`,
    };
}
function decodeUnsungKoreaU(normalized, cleaned) {
    const digits = normalized.substring(1);
    const yearDigits = digits.substring(0, 2);
    const monthDigits = digits.substring(2, 4);
    const sequence = digits.substring(4);
    const yearNum = parseInt(yearDigits, 10);
    const monthNum = parseInt(monthDigits, 10);
    const year = (2000 + yearNum).toString();
    const monthName = (monthNum >= 1 && monthNum <= 12) ? getMonthName(monthNum) : undefined;
    const sequenceNumber = parseInt(sequence, 10);
    return {
        success: true,
        info: {
            brand: 'Kramer',
            serialNumber: cleaned,
            year,
            ...(monthName ? { month: monthName } : {}),
            factory: 'Unsung Co., South Korea',
            country: 'South Korea',
            notes: `U-prefix Kramer serial. "U" identifies the Unsung factory in South Korea, which produced Kramer instruments under Gibson/MusicYo-era ownership (late 1990s–2000s). Parsed as U + YYMM + sequence. Year: ${year}${monthName ? `, month: ${monthName}` : ''}. Sequence: ${sequenceNumber}. These are import models — not USA Custom Shop guitars.`,
        },
        patternKey: 'kramer-u-unsung-korea-gibson-era-yymm-sequence',
        patternLabel: 'Kramer Unsung Korea U-prefix YYMM sequence (Gibson era)',
        additionalContext: {
            title: 'Kramer Unsung Korea serial',
            summary: 'U-prefix Kramer serials are associated with the Unsung factory in South Korea, which produced Kramer instruments during the Gibson/MusicYo era (late 1990s–2000s).',
            highlights: [
                '"U" identifies the Unsung Co. factory in South Korea.',
                `The digits ${yearDigits} decode as production year ${year}.`,
                ...(monthName ? [`The digits ${monthDigits} decode as ${monthName}.`] : []),
                `Production sequence: ${sequenceNumber}.`,
            ],
            caveats: [
                'These are Gibson/MusicYo-era import models, not USA Custom Shop guitars.',
                'Confirm the specific model from headstock markings and hardware details.',
            ],
            verificationTips: [
                'Check the back of the headstock for "Made in Korea" markings.',
                'Compare the model and hardware against Gibson-era Kramer catalog offerings for the decoded year.',
            ],
        },
        additionalContextRichText: `<h3>Overview</h3><p>U-prefix Kramer serials are associated with the Unsung factory in South Korea, which produced Kramer instruments during the Gibson/MusicYo ownership era (late 1990s–2000s).</p><h3>How This Pattern Is Typically Read</h3><p>"U" identifies the Unsung Co. factory in South Korea. The digits ${yearDigits} decode as production year ${year}.${monthName ? ` The digits ${monthDigits} decode as ${monthName}.` : ''} Production sequence: ${sequenceNumber}.</p><h3>What To Verify</h3><ul><li>Check the back of the headstock for "Made in Korea" markings.</li><li>These are Gibson/MusicYo-era import instruments — not USA Custom Shop guitars.</li><li>Compare against Gibson-era Kramer catalog specs for ${year}.</li></ul>`,
    };
}
function getMonthName(monthValue) {
    switch (monthValue) {
        case 1:
            return 'January';
        case 2:
            return 'February';
        case 3:
            return 'March';
        case 4:
            return 'April';
        case 5:
            return 'May';
        case 6:
            return 'June';
        case 7:
            return 'July';
        case 8:
            return 'August';
        case 9:
            return 'September';
        case 10:
            return 'October';
        case 11:
            return 'November';
        case 12:
            return 'December';
        default:
            return undefined;
    }
}
