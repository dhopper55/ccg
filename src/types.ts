export interface GuitarInfo {
  brand: string;
  serialNumber: string;
  year?: string;
  month?: string;
  day?: string;
  factory?: string;
  country?: string;
  model?: string;
  notes?: string;
}

export interface DecodeResult {
  success: boolean;
  info?: GuitarInfo;
  error?: string;
  patternKey?: string;
  patternLabel?: string;
  needsAdditionalContext?: boolean;
  additionalContext?: {
    title: string;
    summary: string;
    highlights: string[];
    caveats: string[];
    verificationTips: string[];
  } | null;
  additionalContextRichText?: string;
}

export type Brand = 'gibson' | 'epiphone' | 'fender' | 'taylor' | 'martin' | 'ibanez' | 'yamaha' | 'prs' | 'esp' | 'schecter' | 'gretsch' | 'jackson' | 'squier' | 'cort' | 'takamine' | 'washburn' | 'dean' | 'ernieball' | 'guild' | 'alvarez' | 'godin' | 'ovation' | 'charvel' | 'rickenbacker' | 'kramer' | 'bcrich';

export interface Decoder {
  decode(serial: string): DecodeResult;
}
