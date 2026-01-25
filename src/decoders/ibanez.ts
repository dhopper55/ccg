import { DecodeResult, GuitarInfo } from '../types.js';

export function decodeIbanez(serial: string): DecodeResult {
  const cleaned = serial.trim().toUpperCase();
  const normalized = cleaned.replace(/[\s-]/g, '');

  // Try each format in order of specificity

  // Japan: F + 7 digits (1997-present, FujiGen)
  if (/^F\d{7}$/.test(normalized)) {
    return decodeFujiGenModern(normalized);
  }

  // Japan: F/H/I + 6 digits (1987-1996)
  if (/^[FHI]\d{6}$/.test(normalized)) {
    return decodeJapan1987to1996(normalized);
  }

  // Japan: Letter (A-L) + 6 digits (1975-1988, month-year format)
  if (/^[A-L]\d{6}$/.test(normalized)) {
    return decodeJapan1975to1988(normalized);
  }

  // Japan: Sugi/J-Custom - Letter + 5 digits (2005-present)
  if (/^[A-L]\d{5}$/.test(normalized)) {
    return decodeSugi(normalized);
  }

  // Japan: IGDC format - IG + 6 digits (2016-2017)
  if (/^IG\d{6}$/.test(normalized)) {
    return decodeIGDC(normalized);
  }

  // Japan: H + 6 digits (1994-1998)
  if (/^H\d{6}$/.test(normalized)) {
    return decodeH1994to1998(normalized);
  }

  // Japan/Korea hybrid: FC + 7 digits
  if (/^FC\d{7}$/.test(normalized)) {
    return decodeFCHybrid(normalized);
  }

  // Korea: C/S/A/Y/P + 9 digits (2000-2008)
  if (/^[CSAYP]\d{9}$/.test(normalized)) {
    return decodeKorea2000to2008(normalized);
  }

  // Korea: C/S/A/Y/P + 8 digits (1995-1999)
  if (/^[CSAYP]\d{8}$/.test(normalized)) {
    return decodeKorea1995to1999(normalized);
  }

  // Korea: C/Y/A/P + 6 digits (1987-1995)
  if (/^[CYAP]\d{6}$/.test(normalized)) {
    return decodeKorea1987to1995(normalized);
  }

  // Korea: E + 7 digits (Sung-Eum factory)
  if (/^E\d{7}$/.test(normalized)) {
    return decodeSungEum(normalized);
  }

  // Korea: W + 6 digits (World factory, 1999-2008)
  if (/^W\d{6}$/.test(normalized)) {
    return decodeWorld(normalized);
  }

  // Korea: S + 7 digits (Samick, 1990-1995)
  if (/^S\d{7}$/.test(normalized)) {
    return decodeSamick(normalized);
  }

  // Korea: SQ + digits (Saehan acoustics)
  if (/^SQ\d+$/.test(normalized)) {
    return decodeSaehan(normalized);
  }

  // Korea: KR + 9 digits (2004-2006)
  if (/^KR\d{9}$/.test(normalized)) {
    return decodeKR(normalized);
  }

  // Korea: CP + digits (2003-2008)
  if (/^CP\d+$/.test(normalized)) {
    return decodeCP(normalized);
  }

  // Indonesia: I/K/J + 9 digits (2001-present)
  if (/^[IKJ]\d{9}$/.test(normalized)) {
    return decodeIndonesia2001(normalized);
  }

  // Indonesia: I + 7 digits (1997-2000)
  if (/^I\d{7}$/.test(normalized)) {
    return decodeIndonesia1997to2000(normalized);
  }

  // Indonesia: PR + 9 digits (2004-2007)
  if (/^PR\d{9}$/.test(normalized)) {
    return decodePR(normalized);
  }

  // Indonesia: PW + 8 digits (2019-present, PT Woonan)
  if (/^PW\d{8}$/.test(normalized)) {
    return decodePW(normalized);
  }

  // Indonesia Premium: 6 chars with letter at end (2010-2015)
  if (/^[A-L]\d{4}[A-F]$/.test(normalized)) {
    return decodeIndonesiaPremium(normalized);
  }

  // China: J + 9 digits (2004-2012)
  if (/^J\d{9}$/.test(normalized)) {
    return decodeChinaJ(normalized);
  }

  // China: S + 8 digits (2002-present)
  if (/^S\d{8}$/.test(normalized)) {
    return decodeChinaS(normalized);
  }

  // China: GS + 9 digits (2007-present, GIO series)
  if (/^GS\d{9}$/.test(normalized)) {
    return decodeChinaGS(normalized);
  }

  // China: Z + 6 characters (Yeou Chern, 1999-2006)
  if (/^Z[0-9XYZ]\d{5}$/.test(normalized)) {
    return decodeYeouChern(normalized);
  }

  // China: A + 8 digits (2005-present)
  if (/^A\d{8}$/.test(normalized)) {
    return decodeChinaA(normalized);
  }

  // China: 4L + 9 digits
  if (/^4L\d{9}$/.test(normalized)) {
    return decodeChina4L(normalized);
  }

  // Japan: 5-digit J-Custom (2001-2004)
  if (/^\d{5}$/.test(normalized)) {
    return decodeJCustom5Digit(normalized);
  }

  return {
    success: false,
    error: 'Unrecognized Ibanez serial number format. Ibanez has used many different serial number systems across factories in Japan, Korea, Indonesia, and China. Common formats include: F + 7 digits (Japan), letter + 6-9 digits (various factories), or factory prefix + digits.'
  };
}

// Japan FujiGen 1997-present: F + 7 digits
function decodeFujiGenModern(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10);
  const productionNum = parseInt(serial.substring(3), 10);

  // Determine full year (97-99 = 1997-1999, 00+ = 2000+)
  const fullYear = year >= 97 ? 1900 + year : 2000 + year;

  // Calculate approximate month from production number
  // Post-2004: 3000 units/month, Pre-2004: 5000 units/month
  const unitsPerMonth = fullYear >= 2005 ? 3000 : 5000;
  const monthNum = Math.floor(productionNum / unitsPerMonth) + 1;
  const month = monthNum <= 12 ? getMonthName(monthNum) : undefined;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: fullYear.toString(),
    month,
    factory: 'FujiGen Gakki, Nagano',
    country: 'Japan',
    notes: `Production number: ${productionNum}. FujiGen is Ibanez's premium Japanese factory, known for high-quality Prestige and J-Custom models.`
  };

  return { success: true, info };
}

// Japan 1987-1996: F/H/I + 6 digits
function decodeJapan1987to1996(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const yearDigit = parseInt(serial[1], 10);
  const productionNum = parseInt(serial.substring(2), 10);

  // Year digit: 7=1987 through 6=1996
  let year: number;
  if (yearDigit >= 7) {
    year = 1980 + yearDigit;
  } else {
    year = 1990 + yearDigit;
  }

  let factory: string;
  switch (factoryCode) {
    case 'F':
      factory = 'FujiGen Gakki, Nagano';
      break;
    case 'H':
      factory = 'Terada Musical Instrument Co., Nagoya';
      break;
    case 'I':
      factory = 'Iida Gakki, Nagoya';
      break;
    default:
      factory = 'Unknown Japanese Factory';
  }

  // Calculate month (FujiGen used ~3600/month increments)
  const monthNum = Math.floor(productionNum / 3600) + 1;
  const month = monthNum <= 12 ? getMonthName(monthNum) : undefined;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory,
    country: 'Japan',
    notes: `Production number: ${productionNum}. Factory code "${factoryCode}" indicates ${factory}.`
  };

  return { success: true, info };
}

// Japan 1975-1988: Month letter + 6 digits
function decodeJapan1975to1988(serial: string): DecodeResult {
  const monthLetter = serial[0];
  const yearDigits = serial.substring(1, 3);
  const productionNum = serial.substring(3);

  const monthNum = monthLetter.charCodeAt(0) - 64; // A=1, B=2, etc.
  const month = getMonthName(monthNum);

  // Parse year - could be 75-88
  let year = parseInt(yearDigits, 10);
  if (year >= 75 && year <= 99) {
    year = 1900 + year;
  } else if (year >= 0 && year <= 88) {
    year = 1900 + year;
  }

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: 'FujiGen Gakki, Nagano (most likely)',
    country: 'Japan',
    notes: `Production number: ${productionNum}. This format was used from 1975-1988 for Japanese-made guitars.`
  };

  return { success: true, info };
}

// Japan Sugi/J-Custom: Letter + 5 digits (2005-present)
function decodeSugi(serial: string): DecodeResult {
  const monthLetter = serial[0];
  const yearDigits = serial.substring(1, 3);
  const modelCode = serial[3];
  const sequenceNum = serial.substring(4);

  const monthNum = monthLetter.charCodeAt(0) - 64;
  const month = getMonthName(monthNum);
  const year = 2000 + parseInt(yearDigits, 10);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: 'Sugi Musical Instruments Ltd.',
    country: 'Japan',
    notes: `Model code: ${modelCode}, Sequence: ${sequenceNum}. Sugi manufactures high-end J-Custom models for Ibanez.`
  };

  return { success: true, info };
}

// Japan IGDC: IG + 6 digits (2016-2017)
function decodeIGDC(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Ibanez Guitar Development Center (IGDC)',
    country: 'Japan',
    notes: `Sequence: ${sequence}. IGDC serial numbers are typically hand-written on the back of the headstock.`
  };

  return { success: true, info };
}

// Japan H format 1994-1998
function decodeH1994to1998(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10);
  const sequence = serial.substring(3);

  const fullYear = year >= 94 ? 1900 + year : 2000 + year;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: fullYear.toString(),
    factory: 'Japan (manufacturer unclear)',
    country: 'Japan',
    notes: `Sequence: ${sequence}. This H-prefix format was used 1994-1998, possibly for historic reissue models.`
  };

  return { success: true, info };
}

// Japan/Korea hybrid: FC + 7 digits
function decodeFCHybrid(serial: string): DecodeResult {
  const yearDigit = serial[2];
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  // Year digit in mid-90s
  let year = parseInt(yearDigit, 10);
  year = year >= 5 ? 1990 + year : 2000 + year;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'FujiGen (Japan) / Cort (Korea) - Hybrid Production',
    country: 'Japan/Korea',
    notes: `Sequence: ${sequence}. FC prefix indicates hybrid production: necks from FujiGen Japan, bodies from Cort Korea.`
  };

  return { success: true, info };
}

// Korea 2000-2008: Letter + 9 digits
function decodeKorea2000to2008(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const factory = getKoreanFactory(factoryCode);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory,
    country: 'South Korea',
    notes: `Sequence: ${sequence}. Factory code "${factoryCode}" indicates ${factory}.`
  };

  return { success: true, info };
}

// Korea 1995-1999: Letter + 8 digits
function decodeKorea1995to1999(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  // Single digit year: 5-9 = 1995-1999
  const year = 1990 + yearDigit;
  const factory = getKoreanFactory(factoryCode);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory,
    country: 'South Korea',
    notes: `Sequence: ${sequence}. Factory code "${factoryCode}" indicates ${factory}.`
  };

  return { success: true, info };
}

// Korea 1987-1995: Letter + 6 digits
function decodeKorea1987to1995(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const yearDigit = parseInt(serial[1], 10);
  const sequence = serial.substring(2);

  // Year digit: 7-9 = 1987-1989, 0-5 = 1990-1995
  let year: number;
  if (yearDigit >= 7) {
    year = 1980 + yearDigit;
  } else {
    year = 1990 + yearDigit;
  }

  const factory = getKoreanFactory(factoryCode);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    factory,
    country: 'South Korea',
    notes: `Sequence: ${sequence}. Factory code "${factoryCode}" indicates ${factory}.`
  };

  return { success: true, info };
}

// Korea Sung-Eum: E + 7 digits
function decodeSungEum(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  const year = yearDigit >= 7 ? 1980 + yearDigit : 1990 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Sung-Eum Music Co., Yangju',
    country: 'South Korea',
    notes: `Sequence: ${sequence}. E prefix indicates Sung-Eum factory production.`
  };

  return { success: true, info };
}

// Korea World: W + 6 digits (1999-2008)
function decodeWorld(serial: string): DecodeResult {
  const monthCode = serial[1];
  const yearDigit = parseInt(serial[2], 10);
  const sequence = serial.substring(3);

  // Month: 1-9 for Jan-Sep, X=Oct, Y=Nov, Z=Dec
  let month: number;
  if (monthCode >= '1' && monthCode <= '9') {
    month = parseInt(monthCode, 10);
  } else if (monthCode === 'X') {
    month = 10;
  } else if (monthCode === 'Y') {
    month = 11;
  } else if (monthCode === 'Z') {
    month = 12;
  } else {
    month = 0;
  }

  // Year digit: 9=1999, 0-8 = 2000-2008
  const year = yearDigit === 9 ? 1999 : 2000 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: month > 0 ? getMonthName(month) : undefined,
    factory: 'World Musical Instruments Co.',
    country: 'South Korea',
    notes: `Sequence: ${sequence}. W prefix indicates World factory production.`
  };

  return { success: true, info };
}

// Korea Samick: S + 7 digits (1990-1995)
function decodeSamick(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  // Year: 0-5 = 1990-1995
  const year = 1990 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Samick Musical Instruments, Incheon',
    country: 'South Korea',
    notes: `Sequence: ${sequence}. S prefix indicates Samick factory production.`
  };

  return { success: true, info };
}

// Korea Saehan: SQ + digits
function decodeSaehan(serial: string): DecodeResult {
  const remaining = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: '2000s',
    factory: 'Saehan Guitar Technology',
    country: 'South Korea',
    notes: `SQ prefix indicates Saehan factory, typically used for acoustic models.`
  };

  return { success: true, info };
}

// Korea KR format: KR + 9 digits (2004-2006)
function decodeKR(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'South Korea (factory unspecified)',
    country: 'South Korea',
    notes: `Sequence: ${sequence}. KR prefix was used 2004-2006.`
  };

  return { success: true, info };
}

// Korea CP format: CP + digits (2003-2008)
function decodeCP(serial: string): DecodeResult {
  const remaining = serial.substring(2);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: '2003-2008',
    factory: 'South Korea (possibly Cort partnership)',
    country: 'South Korea',
    notes: `CP prefix was used 2003-2008. Exact manufacturer unclear.`
  };

  return { success: true, info };
}

// Indonesia 2001-present: I/K/J + 9 digits
function decodeIndonesia2001(serial: string): DecodeResult {
  const factoryCode = serial[0];
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = parseInt(serial.substring(5), 10);

  let factory: string;
  switch (factoryCode) {
    case 'I':
      factory = 'Cort Indonesia (Cor-Tek)';
      break;
    case 'K':
      factory = 'Kwo Hsiao Co., Ltd.';
      break;
    case 'J':
      factory = 'Sejung';
      break;
    default:
      factory = 'Indonesia (factory unspecified)';
  }

  // Production number ranges: 00001-49999 for acoustics, 50000-99999 for electrics/basses
  let instrumentType = '';
  if (sequence < 50000) {
    instrumentType = ' This sequence range (< 50000) typically indicates acoustic guitars.';
  } else {
    instrumentType = ' This sequence range (50000+) typically indicates electric guitars or basses.';
  }

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory,
    country: 'Indonesia',
    notes: `Sequence: ${sequence}.${instrumentType}`
  };

  return { success: true, info };
}

// Indonesia 1997-2000: I + 7 digits
function decodeIndonesia1997to2000(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[1], 10);
  const month = parseInt(serial.substring(2, 4), 10);
  const sequence = serial.substring(4);

  // Year: 7-9 = 1997-1999, 0 = 2000
  const year = yearDigit >= 7 ? 1990 + yearDigit : 2000 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Cort Indonesia (Cor-Tek)',
    country: 'Indonesia',
    notes: `Sequence: ${sequence}. Early Indonesian production began in 1997.`
  };

  return { success: true, info };
}

// Indonesia PR format: PR + 9 digits (2004-2007)
function decodePR(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Indonesia (manufacturer unclear)',
    country: 'Indonesia',
    notes: `Sequence: ${sequence}. PR prefix was used 2004-2007.`
  };

  return { success: true, info };
}

// Indonesia PW format: PW + 8 digits (2019-present)
function decodePW(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'P.T. Woonan Music, Ngoro (East Java)',
    country: 'Indonesia',
    notes: `Sequence: ${sequence}. PW prefix indicates PT Woonan factory (2019-present).`
  };

  return { success: true, info };
}

// Indonesia Premium: Letter + 4 digits + Letter (2010-2015)
function decodeIndonesiaPremium(serial: string): DecodeResult {
  const monthLetter = serial[0];
  const sequence = serial.substring(1, 5);
  const yearLetter = serial[5];

  const monthNum = monthLetter.charCodeAt(0) - 64;
  const month = getMonthName(monthNum);

  // Year letter: A=2010, B=2011, C=2012, D=2013, E=2014, F=2015
  const yearOffset = yearLetter.charCodeAt(0) - 65;
  const year = 2010 + yearOffset;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: 'Indonesia Premium Factory',
    country: 'Indonesia',
    notes: `Sequence: ${sequence}. This format was used for Indonesian Premium series guitars 2010-2015.`
  };

  return { success: true, info };
}

// China J format: J + 9 digits (2004-2012)
function decodeChinaJ(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'Sejung Musical Instrument Manufacturing, Qingdao (likely)',
    country: 'China',
    notes: `Sequence: ${sequence}. J prefix with 9 digits was used 2004-2012.`
  };

  return { success: true, info };
}

// China S format: S + 8 digits (2002-present)
function decodeChinaS(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China (manufacturer unclear)',
    country: 'China',
    notes: `Sequence: ${sequence}. S + 8 digits format used since 2002.`
  };

  return { success: true, info };
}

// China GS format: GS + 9 digits (2007-present, GIO series)
function decodeChinaGS(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China',
    country: 'China',
    model: 'GIO Series (likely)',
    notes: `Sequence: ${sequence}. GS prefix typically indicates GIO series budget models.`
  };

  return { success: true, info };
}

// China Yeou Chern: Z + letter/digit + 5 digits (1999-2006)
function decodeYeouChern(serial: string): DecodeResult {
  const monthCode = serial[1];
  const yearDigit = parseInt(serial[2], 10);
  const sequence = serial.substring(3);

  // Month: 1-9 for Jan-Sep, X=Oct, Y=Nov, Z=Dec
  let month: number;
  if (monthCode >= '1' && monthCode <= '9') {
    month = parseInt(monthCode, 10);
  } else if (monthCode === 'X') {
    month = 10;
  } else if (monthCode === 'Y') {
    month = 11;
  } else if (monthCode === 'Z') {
    month = 12;
  } else {
    month = 0;
  }

  // Year: 9=1999, 0-6 = 2000-2006
  const year = yearDigit === 9 ? 1999 : 2000 + yearDigit;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: month > 0 ? getMonthName(month) : undefined,
    factory: 'Yeou Chern Enterprises, Guangdong',
    country: 'China',
    notes: `Sequence: ${sequence}. Z prefix indicates Yeou Chern factory (1999-2006).`
  };

  return { success: true, info };
}

// China A format: A + 8 digits (2005-present)
function decodeChinaA(serial: string): DecodeResult {
  const year = parseInt(serial.substring(1, 3), 10) + 2000;
  const month = parseInt(serial.substring(3, 5), 10);
  const sequence = serial.substring(5);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China',
    country: 'China',
    notes: `Sequence: ${sequence}. A + 8 digits format used since 2005.`
  };

  return { success: true, info };
}

// China 4L format: 4L + 9 digits
function decodeChina4L(serial: string): DecodeResult {
  const year = parseInt(serial.substring(2, 4), 10) + 2000;
  const month = parseInt(serial.substring(4, 6), 10);
  const sequence = serial.substring(6);

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month: getMonthName(month),
    factory: 'China',
    country: 'China',
    notes: `Sequence: ${sequence}. 4L prefix format.`
  };

  return { success: true, info };
}

// Japan J-Custom 5-digit: YMXXX (2001-2004)
function decodeJCustom5Digit(serial: string): DecodeResult {
  const yearDigit = parseInt(serial[0], 10);
  const monthDigit = parseInt(serial[1], 10);
  const sequence = serial.substring(2);

  // Year: 1-4 = 2001-2004
  const year = 2000 + yearDigit;

  // Month: 1-9 for Jan-Sep, but also 0 could be Oct
  const month = monthDigit > 0 && monthDigit <= 12 ? getMonthName(monthDigit) : undefined;

  const info: GuitarInfo = {
    brand: 'Ibanez',
    serialNumber: serial,
    year: year.toString(),
    month,
    factory: 'FujiGen Gakki, Nagano',
    country: 'Japan',
    model: 'J-Custom (likely)',
    notes: `Sequence: ${sequence}. 5-digit format was used for J-Custom models 2001-2004.`
  };

  return { success: true, info };
}

// Helper functions
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return month >= 1 && month <= 12 ? months[month - 1] : 'Unknown';
}

function getKoreanFactory(code: string): string {
  switch (code) {
    case 'C':
      return 'Cort Guitars, Incheon/Daejeon';
    case 'S':
      return 'Saehan Guitar Technology';
    case 'A':
      return 'Saein Musical Instrument Co., Incheon';
    case 'Y':
      return 'Yoojin Industrial Co.';
    case 'P':
      return 'Peerless Korea Co., Pusan';
    default:
      return 'South Korea (factory unspecified)';
  }
}
