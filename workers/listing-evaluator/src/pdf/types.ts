export type InventoryLabelPdfRow = {
  ccgNumber: string;
  title: string;
  imageUrl: string;
};

export type PdfImageAsset = {
  width: number;
  height: number;
  colorSpace: '/DeviceGray' | '/DeviceRGB' | '/DeviceCMYK';
  bitsPerComponent: number;
  filter: '/DCTDecode' | '/FlateDecode';
  data: Uint8Array;
  decodeParms?: string;
};

export type PdfPageDefinition = {
  pageObjectNumber: number;
  contentObjectNumber: number;
  images: Array<{ name: string; objectNumber: number; asset: PdfImageAsset }>;
  rows: InventoryLabelPdfRow[];
};
