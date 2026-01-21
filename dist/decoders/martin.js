// Martin serial number ranges by year (last serial number for each year)
// Serial numbers started at approximately 8000 in 1898
const MARTIN_RANGES = [
    [8348, 1898], [8716, 1899], [9128, 1900], [9310, 1901], [9528, 1902],
    [9810, 1903], [9988, 1904], [10120, 1905], [10329, 1906], [10727, 1907],
    [10883, 1908], [11018, 1909], [11203, 1910], [11413, 1911], [11565, 1912],
    [11821, 1913], [12047, 1914], [12209, 1915], [12390, 1916], [12988, 1917],
    [13450, 1918], [14512, 1919], [15848, 1920], [16758, 1921], [17839, 1922],
    [19891, 1923], [22008, 1924], [24116, 1925], [28689, 1926], [34435, 1927],
    [37568, 1928], [40843, 1929], [45317, 1930], [49589, 1931], [52590, 1932],
    [55084, 1933], [58679, 1934], [61947, 1935], [65176, 1936], [68865, 1937],
    [71866, 1938], [74061, 1939], [76734, 1940], [80013, 1941], [83107, 1942],
    [86724, 1943], [90149, 1944], [93623, 1945], [98158, 1946], [103468, 1947],
    [108269, 1948], [112961, 1949], [117961, 1950], [122799, 1951], [128436, 1952],
    [134501, 1953], [141345, 1954], [147328, 1955], [152775, 1956], [159061, 1957],
    [165576, 1958], [171047, 1959], [175689, 1960], [181297, 1961], [187384, 1962],
    [193327, 1963], [199626, 1964], [207030, 1965], [217215, 1966], [230095, 1967],
    [241925, 1968], [256003, 1969], [271633, 1970], [294270, 1971], [313302, 1972],
    [333873, 1973], [353387, 1974], [371828, 1975], [388800, 1976], [399625, 1977],
    [407800, 1978], [419900, 1979], [430300, 1980], [436474, 1981], [439627, 1982],
    [446101, 1983], [453300, 1984], [460575, 1985], [468175, 1986], [476216, 1987],
    [483952, 1988], [493279, 1989], [503309, 1990], [512487, 1991], [522655, 1992],
    [535223, 1993], [551696, 1994], [570434, 1995], [592930, 1996], [624799, 1997],
    [668796, 1998], [724077, 1999], [780500, 2000], [845644, 2001], [916759, 2002],
    [978706, 2003], [1042558, 2004], [1115862, 2005], [1197799, 2006], [1268091, 2007],
    [1337042, 2008], [1406715, 2009], [1473461, 2010], [1555767, 2011], [1656742, 2012],
    [1755536, 2013], [1857399, 2014], [1963789, 2015], [2072791, 2016], [2186623, 2017],
    [2299324, 2018], [2418630, 2019], [2538653, 2020], [2664826, 2021], [2791886, 2022],
    [2878810, 2023], [2935987, 2024],
];
// Sigma-Martin serial range (excluded from standard guitar dating)
const SIGMA_RANGE_START = 900001;
const SIGMA_RANGE_END = 902908;
export function decodeMartin(serial) {
    const cleaned = serial.trim();
    const normalized = cleaned.replace(/[\s-]/g, '');
    // Check if it's a numeric serial
    if (!/^\d+$/.test(normalized)) {
        return {
            success: false,
            error: 'Martin serial numbers should be numeric. Check that you entered the number correctly.'
        };
    }
    const serialNum = parseInt(normalized, 10);
    // Check for Sigma-Martin range
    if (serialNum >= SIGMA_RANGE_START && serialNum <= SIGMA_RANGE_END) {
        return decodeSigmaMartin(normalized);
    }
    // Check if serial is too low (pre-1898)
    if (serialNum < 8000) {
        return decodePreSerialMartin(normalized);
    }
    // Find the year using the serial ranges
    return decodeStandardMartin(serialNum, normalized);
}
function decodeStandardMartin(serialNum, serial) {
    // Find the year by checking which range the serial falls into
    let year = null;
    let previousYear = null;
    for (let i = 0; i < MARTIN_RANGES.length; i++) {
        const [maxSerial, rangeYear] = MARTIN_RANGES[i];
        if (serialNum <= maxSerial) {
            year = rangeYear;
            if (i > 0) {
                previousYear = MARTIN_RANGES[i - 1][1];
            }
            break;
        }
    }
    // If serial is higher than our last known range
    if (year === null) {
        const lastKnown = MARTIN_RANGES[MARTIN_RANGES.length - 1];
        const info = {
            brand: 'Martin',
            serialNumber: serial,
            year: '2024 or later',
            factory: 'Nazareth, Pennsylvania',
            country: 'USA',
            notes: `Serial number ${serialNum} is higher than the last documented range (${lastKnown[0]} for ${lastKnown[1]}). This is likely a recent production guitar.`
        };
        return { success: true, info };
    }
    // Calculate approximate position in the year
    let productionInfo = '';
    if (previousYear !== null) {
        const prevIndex = MARTIN_RANGES.findIndex(([, y]) => y === previousYear);
        if (prevIndex >= 0) {
            const prevMax = MARTIN_RANGES[prevIndex][0];
            const currMax = MARTIN_RANGES[MARTIN_RANGES.findIndex(([, y]) => y === year)][0];
            const yearProduction = currMax - prevMax;
            const positionInYear = serialNum - prevMax;
            const percentOfYear = Math.round((positionInYear / yearProduction) * 100);
            if (percentOfYear <= 33) {
                productionInfo = 'Early in the year (approximately first third of production).';
            }
            else if (percentOfYear <= 66) {
                productionInfo = 'Mid-year production (approximately middle third).';
            }
            else {
                productionInfo = 'Late in the year (approximately final third of production).';
            }
        }
    }
    const info = {
        brand: 'Martin',
        serialNumber: serial,
        year: year.toString(),
        factory: 'Nazareth, Pennsylvania',
        country: 'USA',
        notes: `Martin has been using sequential serial numbers since 1898. ${productionInfo} Note: Starting in 1930, Martin also stamped the model number above the serial number inside the guitar.`
    };
    return { success: true, info };
}
function decodeSigmaMartin(serial) {
    const info = {
        brand: 'Martin (Sigma)',
        serialNumber: serial,
        year: '1981-1982',
        factory: 'Japan (Sigma)',
        country: 'Japan',
        notes: 'This serial number falls within the Sigma-Martin range (900001-902908). Sigma guitars were Martin-designed instruments made in Japan from 1970 to 2007. This particular range was used in 1981-1982.'
    };
    return { success: true, info };
}
function decodePreSerialMartin(serial) {
    const serialNum = parseInt(serial, 10);
    const info = {
        brand: 'Martin',
        serialNumber: serial,
        year: 'Pre-1898 (estimated)',
        factory: 'Various (early Martin production)',
        country: 'USA',
        notes: `Serial number ${serialNum} is lower than 8000, which was approximately the starting point when Martin began their current serial number system in 1898. Martin estimated they had built about 8000 instruments before 1898. This could be a very early Martin guitar or may use a different numbering system (such as Little Martin, Backpacker, or mandolin). Contact Martin directly for verification of very early instruments.`
    };
    return { success: true, info };
}
