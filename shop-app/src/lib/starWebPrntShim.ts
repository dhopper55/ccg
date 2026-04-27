type BuilderArgs = Record<string, unknown>;

declare global {
  interface Window {
    StarWebPrintBuilder?: new () => {
      createInitializationElement: (args?: BuilderArgs) => string;
      createAlignmentElement: (args?: BuilderArgs) => string;
      createBitImageElement: (args: {
        context: CanvasRenderingContext2D;
        x: number;
        y: number;
        width: number;
        height: number;
      }) => string;
      createPeripheralElement: (args?: BuilderArgs) => string;
      createFeedElement: (args?: BuilderArgs) => string;
      createCutPaperElement: (args?: BuilderArgs) => string;
      createTextElement: (args?: BuilderArgs) => string;
    };
    StarWebPrintTrader?: new (args?: {
      url?: string;
      checkedblock?: boolean;
      papertype?: string;
      timeout?: number;
      holdprint_timeout?: number;
    }) => {
      onReceive?: (response: { status?: number; responseText?: string; traderStatus?: string }) => void;
      onError?: (response: { status?: number; responseText?: string }) => void;
      sendMessage: (args: { request: string; url?: string }) => void;
    };
  }
}

const escapeXml = (value: unknown) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const attr = (name: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return '';
  return ` ${name}='${escapeXml(value)}'`;
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return window.btoa(binary);
};

const canvasRegionToRaster = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const imageData = context.getImageData(x, y, width, height).data;
  const rowBytes = Math.ceil(width / 8);
  const bytes = new Uint8Array(rowBytes * height);

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const pixelIndex = (row * width + col) * 4;
      const red = imageData[pixelIndex];
      const green = imageData[pixelIndex + 1];
      const blue = imageData[pixelIndex + 2];
      const alpha = imageData[pixelIndex + 3];
      const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
      const isBlack = alpha > 0 && luminance < 200;

      if (isBlack) {
        const byteIndex = row * rowBytes + (col >> 3);
        bytes[byteIndex] |= 0x80 >> (col & 7);
      }
    }
  }

  return bytesToBase64(bytes);
};

class StarWebPrintBuilderShim {
  createInitializationElement(args: BuilderArgs = {}) {
    return (
      '<initialization' +
      attr('reset', args.reset === true ? 'true' : 'false') +
      attr('print', args.print === true ? 'true' : 'false') +
      '/>'
    );
  }

  createAlignmentElement(args: BuilderArgs = {}) {
    return `<alignment${attr('position', args.position || 'left')}/>`;
  }

  createBitImageElement(args: {
    context: CanvasRenderingContext2D;
    x: number;
    y: number;
    width: number;
    height: number;
  }) {
    const rasterData = canvasRegionToRaster(args.context, args.x, args.y, args.width, args.height);
    return `<bitimage${attr('width', args.width)}${attr('height', args.height)}>${rasterData}</bitimage>`;
  }

  createPeripheralElement(args: BuilderArgs = {}) {
    return (
      '<peripheral' +
      attr('channel', args.channel == null ? 1 : args.channel) +
      attr('on', args.on == null ? 200 : args.on) +
      attr('off', args.off == null ? 200 : args.off) +
      '/>'
    );
  }

  createFeedElement(args: BuilderArgs = {}) {
    return '<feed' + attr('line', args.line == null ? 0 : args.line) + attr('unit', args.unit == null ? 0 : args.unit) + '/>';
  }

  createCutPaperElement(args: BuilderArgs = {}) {
    return '<cutpaper' + attr('feed', args.feed === false ? 'false' : 'true') + attr('type', args.type || 'full') + '/>';
  }

  createTextElement(args: BuilderArgs = {}) {
    return (
      '<text' +
      attr('codepage', args.codepage) +
      attr('international', args.international) +
      attr('characterspace', args.characterspace) +
      attr('emphasis', args.emphasis) +
      attr('invert', args.invert) +
      attr('linespace', args.linespace) +
      attr('width', args.width) +
      attr('height', args.height) +
      attr('font', args.font) +
      attr('underline', args.underline) +
      attr('base_text_magnification', args.base_text_magnification) +
      attr('binary', args.binary) +
      '>' +
      escapeXml(args.data == null ? '' : args.data) +
      '</text>'
    );
  }
}

class StarWebPrintTraderShim {
  url: string;
  checkedblock: boolean;
  papertype: string;
  timeout: number;
  holdprint_timeout: number;
  onReceive?: (response: { status?: number; responseText?: string; traderStatus?: string }) => void;
  onError?: (response: { status?: number; responseText?: string }) => void;

  constructor(args: {
    url?: string;
    checkedblock?: boolean;
    papertype?: string;
    timeout?: number;
    holdprint_timeout?: number;
  } = {}) {
    this.url = args.url || '';
    this.checkedblock = args.checkedblock !== false;
    this.papertype = args.papertype || '';
    this.timeout = args.timeout || 90000;
    this.holdprint_timeout = args.holdprint_timeout || 10000;
  }

  sendMessage(args: { request: string; url?: string }) {
    const url = args.url || this.url;
    if (!url) {
      this.onError?.({ status: 0, responseText: 'Missing Star webPRNT endpoint URL.' });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), this.timeout);

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: args.request,
      signal: controller.signal,
    })
      .then(async (response) => {
        const responseText = await response.text();
        window.clearTimeout(timeoutId);

        if (response.ok) {
          this.onReceive?.({ status: response.status, responseText });
          return;
        }

        this.onError?.({ status: response.status, responseText });
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeoutId);
        this.onError?.({
          status: 0,
          responseText: error instanceof Error ? error.message : String(error),
        });
      });
  }
}

export const ensureStarWebPrntGlobals = () => {
  if (typeof window === 'undefined') return;
  if (!window.StarWebPrintBuilder) {
    window.StarWebPrintBuilder = StarWebPrintBuilderShim;
  }
  if (!window.StarWebPrintTrader) {
    window.StarWebPrintTrader = StarWebPrintTraderShim;
  }
};
