import dayjs from 'dayjs';
import ts, { transpile } from 'typescript';

export const parseRoutePath = (path: string) => path.split('/').pop() || '/';

export const formatOrderNumber = (orderNumber: string) => {
  const match = orderNumber.trim().match(/^(CCG)-\d{14}-([A-Z0-9]+)$/i);
  return match ? `${match[1].toUpperCase()}-${match[2].toUpperCase()}` : orderNumber;
};

export const getItemFromStore = (
  key: string,
  defaultValue?: string | boolean,
  store = localStorage,
) => {
  try {
    return store.getItem(key) === null ? defaultValue : JSON.parse(store.getItem(key) as string);
  } catch {
    return store.getItem(key) || defaultValue;
  }
};

export const setItemToStore = (key: string, payload: string, store = localStorage) =>
  store.setItem(key, payload);

export const removeItemFromStore = (key: string, store = localStorage) => store.removeItem(key);

export const getDates = (
  startDate: Date,
  endDate: Date,
  interval: number = 1000 * 60 * 60 * 24,
): Date[] => {
  const duration = +endDate - +startDate;
  const steps = duration / interval;

  return Array.from({ length: steps + 1 }, (v, i) => new Date(startDate.valueOf() + interval * i));
};

export const getPastDates = (duration: 'week' | 'month' | 'year' | number): Date[] => {
  let days;

  switch (duration) {
    case 'week':
      days = 7;
      break;
    case 'month':
      days = 30;
      break;
    case 'year':
      days = 365;
      break;

    default:
      days = duration;
  }

  const date = new Date();
  const endDate = date;
  const startDate = new Date(new Date().setDate(date.getDate() - (days - 1)));

  return getDates(startDate, endDate);
};

export const getPreviousMonths = (length: number = 12) => {
  return Array.from({ length }, (_, i) =>
    dayjs()
      .subtract(i + 1, 'month')
      .format('MMMM'),
  ).reverse();
};

export const currencyFormat = (
  amount: number,
  locale: Intl.LocalesArgument = 'en-US',
  options: Intl.NumberFormatOptions = {},
) => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'usd',
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
};

export const getCurrencySymbol = (currency: string, locale: Intl.LocalesArgument = 'en-US') => {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
  })
    .formatToParts(0)
    .find((x) => x.type === 'currency');

  return parts ? parts.value : '$';
};

export const getNumbersInRange = (startAt: number, endAt: number) => {
  return [...Array(endAt + 1 - startAt).keys()].map((i) => i + startAt);
};

export const numberFormat = (
  number: number,
  locale: Intl.LocalesArgument = 'en-US',
  options: Intl.NumberFormatOptions = {
    notation: 'standard',
  },
) =>
  new Intl.NumberFormat(locale, {
    ...options,
  }).format(number);

/* Get Random Number */
export const getRandomNumber = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min) + min);
};

export const calculatePercentageIncrement = (current: number, previous: number) => {
  if (previous === 0) return 0;

  return Math.round(((current - previous) / previous) * 100);
};
export const getPercentage = (value: number, total: number) => {
  return Math.round((value / total) * 100);
};

export const getPercentageStr = (value: number, total: number = 100) => {
  return `${getPercentage(value, total)}%`;
};

export const hexToRgb = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return [r, g, b];
};

export const rgbaColor = (color = '#fff', alpha = 0.5) => `rgba(${hexToRgb(color)}, ${alpha})`;

export const capitalize = (string: string) =>
  (string.charAt(0).toUpperCase() + string.slice(1)).replace(/-/g, ' ');

export const getFileNameFromUrl = (fileName: string) => {
  return fileName.split('/').pop()?.split('.')[0] || 'unknown';
};

export const getFileExtensionFromUrl = (fileName: string, separator = '.') =>
  fileName.split(separator).pop() || 'unknown';

export const transformTSCode = (
  snippet: string,
  target: ts.ScriptTarget = ts.ScriptTarget.ES2015,
) =>
  transpile(snippet, {
    jsx: ts.JsxEmit.React,
    target,
  });

export const convertSpacesToTabs = (str: string) => {
  return str
    .split('\n')
    .map((line) => {
      return line.replace(/^ +/g, (match) => '\t'.repeat(match.length / 2));
    })
    .join('\n');
};

export const kebabCase = (string: string) =>
  string
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

export const kebabToSentenceCase = (str: string) => {
  return str
    .toLowerCase()
    .split('-')
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
};

export const kebabToTitleCase = (str: string) => {
  return str
    .toLowerCase()
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const toSentenceCase = (str: string) => {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
};

export const toTitleCase = (str: string) => {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const getFileExtension = (fileName: string, separator = '.') =>
  fileName.split(separator).pop() || 'unknown';

export const isImageFile = (file: File) => {
  const imageMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/bmp',
    'image/webp',
    'image/avif',
  ];

  return imageMimeTypes.includes(file.type);
};

const isPreviewableMediaFile = (file: File) => {
  if (!file?.type) return false;
  return isImageFile(file) || file.type.startsWith('video/') || file.type.startsWith('audio/');
};

export const convertFileToAttachment = (file: File) => ({
  name: file.name,
  size: `${(file.size / 1024).toFixed(2)} KB`,
  format: getFileExtension(file.name),
  preview: isPreviewableMediaFile(file) ? URL.createObjectURL(file) : undefined,
});
export const maskCardNumber = (cardNumber: string): string =>
  cardNumber
    .split(' ')
    .map((group, index, array) => (index === array.length - 1 ? group : '****'))
    .join(' ');

export const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(num % 1_000_000_000 < 10 ? 0 : 1) + 'B';
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(num % 1_000_000 < 10 ? 0 : 1) + 'M';
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(num % 1_000 < 10 ? 0 : 1) + 'K';
  } else {
    return num.toString();
  }
};

export const getFileIcon = (fileFormat: string): string => {
  switch (fileFormat) {
    case 'zip':
    case 'rar':
      return 'material-symbols:folder-zip-outline-rounded';
    case 'bat':
      return 'material-symbols:code-blocks-outline-rounded';
    case 'txt':
      return 'material-symbols:text-snippet-outline-rounded';
    case 'csv':
      return 'material-symbols:csv-outline-rounded';
    case 'wav':
    case 'mp3':
    case 'ogg':
    case 'm4a':
      return 'material-symbols:audio-file-outline-rounded';
    case 'mp4':
    case 'mkv':
    case 'avi':
      return 'material-symbols:video-file-outline-rounded';
    case 'pdf':
      return 'material-symbols:picture-as-pdf-outline-rounded';
    case 'jpg':
    case 'png':
    case 'jpeg':
      return 'material-symbols:imagesmode-outline-rounded';
    default:
      return 'material-symbols:lab-profile-outline-rounded';
  }
};

export const generateUniqueId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomChars = Math.random().toString(36).substring(2, 10).toUpperCase();

  return `${timestamp}${randomChars}`;
};

export const secondsToHms = (d: number) => {
  d = Math.max(0, Math.floor(d)); // Ensure non-negative integer

  const h = Math.floor(d / 3600);
  const m = Math.floor((d % 3600) / 60);
  const s = d % 60;

  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const secondsToMs = (seconds: number) => {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

type ByteUnit = 'b' | 'kb' | 'mb' | 'gb' | 'tb';

interface ConvertSizeOptions {
  from: ByteUnit;
  to: ByteUnit;
  reversible?: boolean;
}

export const convertSize = (
  size: number,
  options: ConvertSizeOptions = { from: 'kb', to: 'gb', reversible: false },
): number => {
  const units: ByteUnit[] = ['b', 'kb', 'mb', 'gb', 'tb'];
  let { from, to } = options;
  const { reversible } = options;

  if (!reversible) {
    [from, to] = [to, from];
  }

  const fromIndex = units.indexOf(from.toLowerCase() as ByteUnit);
  const toIndex = units.indexOf(to.toLowerCase() as ByteUnit);

  if (fromIndex === -1 || toIndex === -1) {
    throw new Error(`Invalid units. Supported units are: ${units.join(', ')}`);
  }

  const factor = Math.pow(1024, toIndex - fromIndex);

  return size * factor;
};

export const hexToRgbChannel = (hexColor: string): string => {
  const [r, g, b] = hexToRgb(hexColor);
  return `${r} ${g} ${b}`;
};

type ColorPalette = Record<string, string | undefined>;

type PaletteWithChannels<T extends ColorPalette> = T & {
  [K in keyof T as `${string & K}Channel`]: string;
} & {
  [K in keyof T as K extends number ? `${K}Channel` : never]: string;
};

export const generatePaletteChannel = <T extends ColorPalette>(
  palette: T,
): PaletteWithChannels<T> => {
  const channels: Record<string, string | undefined> = {};

  Object.entries(palette).forEach(([colorName, colorValue]) => {
    if (colorValue) {
      channels[`${colorName}Channel`] = hexToRgbChannel(colorValue);
    }
  });

  return { ...palette, ...channels } as PaletteWithChannels<T>;
};

export const cssVarRgba = (color: string, alpha: number) => {
  return `rgba(${color} / ${alpha})`;
};

export const generatePrimaryShades = (hex: string): Record<string, string> => {
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  const toHsl = (hexStr: string) => {
    const h = hexStr.replace('#', '');
    const expanded =
      h.length === 3
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h;
    const bigint = parseInt(expanded, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    const r1 = r / 255;
    const g1 = g / 255;
    const b1 = b / 255;
    const max = Math.max(r1, g1, b1);
    const min = Math.min(r1, g1, b1);
    let hOut = 0;
    let s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r1: {
          hOut = (g1 - b1) / d + (g1 < b1 ? 6 : 0);
          break;
        }
        case g1: {
          hOut = (b1 - r1) / d + 2;
          break;
        }
        default: {
          hOut = (r1 - g1) / d + 4;
        }
      }
      hOut /= 6;
    }
    return { h: hOut * 360, s: s * 100, l: l * 100 };
  };
  const toHex = (h: number, s: number, l: number) => {
    const s1 = s / 100;
    const l1 = l / 100;
    const c = (1 - Math.abs(2 * l1 - 1)) * s1;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l1 - c / 2;
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;
    if (0 <= h && h < 60) {
      r1 = c;
      g1 = x;
      b1 = 0;
    } else if (60 <= h && h < 120) {
      r1 = x;
      g1 = c;
      b1 = 0;
    } else if (120 <= h && h < 180) {
      r1 = 0;
      g1 = c;
      b1 = x;
    } else if (180 <= h && h < 240) {
      r1 = 0;
      g1 = x;
      b1 = c;
    } else if (240 <= h && h < 300) {
      r1 = x;
      g1 = 0;
      b1 = c;
    } else {
      r1 = c;
      g1 = 0;
      b1 = x;
    }
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);
    const to2 = (n: number) => n.toString(16).padStart(2, '0');
    return `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
  };
  const base = toHsl(hex);
  const tones: Array<{ k: string; lDelta: number }> = [
    { k: '50', lDelta: +36 },
    { k: '100', lDelta: +28 },
    { k: '200', lDelta: +20 },
    { k: '300', lDelta: +12 },
    { k: '400', lDelta: +6 },
    { k: '500', lDelta: 0 },
    { k: '600', lDelta: -6 },
    { k: '700', lDelta: -12 },
    { k: '800', lDelta: -18 },
    { k: '900', lDelta: -24 },
    { k: '950', lDelta: -30 },
  ];
  const map: Record<string, string> = {};
  tones.forEach(({ k, lDelta }) => {
    const l = clamp(base.l + lDelta, 6, 94);
    map[k] = toHex(base.h, base.s, l);
  });
  return map;
};

export const getRangeLabel = (value: number) => {
  if (value < 50) return '0-50';
  if (value < 100) return '50-100';
  if (value < 250) return '100-250';
  if (value < 500) return '250-500';

  return '500+';
};
