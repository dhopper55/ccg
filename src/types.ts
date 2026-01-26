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
}

export type Brand = 'gibson' | 'epiphone' | 'fender' | 'taylor' | 'martin' | 'ibanez' | 'yamaha' | 'prs' | 'esp' | 'schecter' | 'gretsch' | 'jackson' | 'squier';

export interface Decoder {
  decode(serial: string): DecodeResult;
}
