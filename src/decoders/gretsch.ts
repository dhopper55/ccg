import { DecodeResult, GuitarInfo } from '../types.js';

export function decodeGretsch(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Fender Era (2003+): Two letter prefix + 8 digits (LLYYMMNNNN)
  // Factory codes: JT, JD, JF, CS, CY, KP, KS
  if (/^(JT|JD|JF|CS|CY|KP|KS)\d{8}$/.test(normalized)) {
    return decodeFenderEra(normalized);
  }

  // Japan Revival Era (1989-2002): 6 digits + hyphen + 3 digits (YYMMMODEL-SEQ)
  // Format: xxxxxx-xxx or xxxxxxxxx (9 digits if hyphen removed)
  if (/^\d{6}-?\d{3}$/.test(cleaned)) {
    return decodeJapanRevival(cleaned);
  }

  // Baldwin Era with hyphen (1972-1981): M-NNN or MM-NNN
  if (/^\d{1,2}-\d{3}$/.test(cleaned)) {
    return decodeBaldwinHyphen(cleaned);
  }

  // Baldwin Era date-coded (1966-1972): MYNDDD or MMYDDD (5-6 digits)
  if (/^\d{5,6}$/.test(normalized)) {
    const possibleBaldwin = tryBaldwinDateCode(normalized);
    if (possibleBaldwin) {
      return possibleBaldwin;
    }
    // Could also be pre-Baldwin sequential
    return decodePreBaldwinSequential(normalized);
  }

  // Pre-Baldwin sequential (1939-1966): 3-5 digits
  if (/^\d{3,5}$/.test(normalized)) {
    return decodePreBaldwinSequential(normalized);
  }

  return {
    success: false,
    error: 'Unable to decode this Gretsch serial number. The format was not recognized. Please check the serial number and try again.'
  };
}

function decodeFenderEra(serial: string): DecodeResult {
  const factoryCode = serial.substring(0, 2);
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const productionNum = parseInt(serial.substring(6), 10);

  const { factory, country } = getFactoryInfo(factoryCode);
  const monthName = getMonthName(month);

  let modelNote = '';
  if (productionNum >= 1 && productionNum <= 100) {
    modelNote = 'Prototype, sample, or special instrument (production numbers 0001-0100 reserved).';
  } else {
    modelNote = 'Regular production model.';
  }

  const info: GuitarInfo = {
    brand: 'Gretsch',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: factory,
    country: country,
    notes: `Fender era (2003+). Production #${productionNum} for ${year}. ${modelNote}`
  };
  return { success: true, info };
}

function decodeJapanRevival(serial: string): DecodeResult {
  // Format: YYMMMODEL-SEQ or YYMMMODELSEQ
  const normalized = serial.replace('-', '');

  const year = parseInt(normalized.substring(0, 2), 10);
  const month = parseInt(normalized.substring(2, 4), 10);
  const modelCode = normalized.substring(4, 7);
  const sequence = normalized.substring(7);

  // Year: 89-99 = 1989-1999, 00-02 = 2000-2002
  const fullYear = year >= 89 ? 1900 + year : 2000 + year;
  const monthName = getMonthName(month);

  // Model code corresponds to Gretsch model numbers (e.g., 120 = G6120)
  const modelNum = modelCode.replace(/^0+/, '');

  const info: GuitarInfo = {
    brand: 'Gretsch',
    serialNumber: serial,
    year: fullYear.toString(),
    month: monthName,
    factory: 'Terada Factory',
    country: 'Japan',
    model: modelNum ? `G6${modelNum} (or similar)` : undefined,
    notes: `Japan Revival Era (1989-2002). Model code: ${modelCode}. Sequence: ${sequence}.`
  };
  return { success: true, info };
}

function decodeBaldwinHyphen(serial: string): DecodeResult {
  // Format: M-NNN or MM-NNN (1972-1981)
  const parts = serial.split('-');
  const month = parseInt(parts[0], 10);
  const sequence = parts[1];

  // Year is determined by context (1972-1981), can't be precise
  const monthName = getMonthName(month);

  const info: GuitarInfo = {
    brand: 'Gretsch',
    serialNumber: serial,
    year: '1972-1981',
    month: monthName,
    factory: 'Booneville, Arkansas (or Mexico)',
    country: 'USA',
    notes: `Baldwin era with hyphen format. Month: ${month}. Production #${sequence} for that month. Exact year requires additional research.`
  };
  return { success: true, info };
}

function tryBaldwinDateCode(serial: string): DecodeResult | null {
  // Baldwin date-coded format (1966-1972): MYNDDD or MMYDDD
  // M/MM = month (1-12), Y = year digit (6-2 for 1966-1972), DDD = sequence

  let month: number;
  let yearDigit: number;
  let sequence: string;

  if (serial.length === 5) {
    // MYNDDD format
    month = parseInt(serial[0], 10);
    yearDigit = parseInt(serial[1], 10);
    sequence = serial.substring(2);
  } else {
    // MMYDDD format (6 digits)
    const firstTwo = parseInt(serial.substring(0, 2), 10);
    if (firstTwo >= 1 && firstTwo <= 12) {
      month = firstTwo;
      yearDigit = parseInt(serial[2], 10);
      sequence = serial.substring(3);
    } else {
      // First digit is month (1-9), second is year
      month = parseInt(serial[0], 10);
      yearDigit = parseInt(serial[1], 10);
      sequence = serial.substring(2);
    }
  }

  // Validate month
  if (month < 1 || month > 12) {
    return null;
  }

  // Year digit 6-9 = 1966-1969, 0-2 = 1970-1972
  let year: number;
  if (yearDigit >= 6 && yearDigit <= 9) {
    year = 1960 + yearDigit;
  } else if (yearDigit >= 0 && yearDigit <= 2) {
    year = 1970 + yearDigit;
  } else {
    return null;
  }

  const monthName = getMonthName(month);

  const info: GuitarInfo = {
    brand: 'Gretsch',
    serialNumber: serial,
    year: year.toString(),
    month: monthName,
    factory: year < 1970 ? 'Brooklyn, New York' : 'Booneville, Arkansas',
    country: 'USA',
    notes: `Baldwin era date-coded format (1966-1972). Production #${parseInt(sequence, 10)} for ${monthName} ${year}.`
  };
  return { success: true, info };
}

function decodePreBaldwinSequential(serial: string): DecodeResult {
  const num = parseInt(serial, 10);

  // Pre-Baldwin sequential ranges (approximate)
  const ranges: { min: number; max: number; years: string; notes: string }[] = [
    { min: 1, max: 999, years: '1939-1946', notes: 'Very early production, possibly handwritten' },
    { min: 1000, max: 3999, years: '1947-1949', notes: 'Post-war production' },
    { min: 4000, max: 5999, years: '1950-1951', notes: '' },
    { min: 6000, max: 9999, years: '1952-1953', notes: '' },
    { min: 10000, max: 14999, years: '1954-1955', notes: '' },
    { min: 15000, max: 20999, years: '1956-1957', notes: '' },
    { min: 21000, max: 25999, years: '1957-1958', notes: 'Orange oval label era begins ~25001' },
    { min: 26000, max: 34999, years: '1958-1959', notes: '' },
    { min: 35000, max: 39999, years: '1960', notes: '' },
    { min: 40000, max: 45999, years: '1961', notes: '' },
    { min: 46000, max: 52999, years: '1962', notes: '' },
    { min: 53000, max: 63999, years: '1963', notes: '' },
    { min: 64000, max: 71999, years: '1964', notes: '' },
    { min: 72000, max: 77999, years: '1965', notes: '' },
    { min: 78000, max: 85000, years: '1965-1966', notes: 'Late pre-Baldwin era' },
  ];

  for (const range of ranges) {
    if (num >= range.min && num <= range.max) {
      const info: GuitarInfo = {
        brand: 'Gretsch',
        serialNumber: serial,
        year: range.years,
        factory: 'Brooklyn, New York',
        country: 'USA',
        notes: `Pre-Baldwin sequential serial. ${range.notes}`.trim()
      };
      return { success: true, info };
    }
  }

  // If number is higher than known ranges, could be late production or different format
  if (num > 85000) {
    const info: GuitarInfo = {
      brand: 'Gretsch',
      serialNumber: serial,
      year: '1966 or later',
      factory: 'USA',
      country: 'USA',
      notes: 'Serial number exceeds known pre-Baldwin ranges. May be Baldwin era or require additional research.'
    };
    return { success: true, info };
  }

  return {
    success: false,
    error: 'Unable to determine year from this serial number.'
  };
}

function getFactoryInfo(code: string): { factory: string; country: string } {
  switch (code) {
    case 'JT':
      return { factory: 'Terada Factory', country: 'Japan' };
    case 'JD':
      return { factory: 'Dyna Gakki Factory', country: 'Japan' };
    case 'JF':
      return { factory: 'Fuji-Gen Gakki Factory', country: 'Japan' };
    case 'CS':
      return { factory: 'Gretsch Custom Shop', country: 'USA' };
    case 'CY':
      return { factory: 'Yako Facility', country: 'China' };
    case 'KP':
      return { factory: 'Peerless Factory', country: 'South Korea' };
    case 'KS':
      return { factory: 'SPG/Samick Factory', country: 'South Korea' };
    default:
      return { factory: 'Unknown', country: 'Unknown' };
  }
}

function getMonthName(month: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] || '';
}
