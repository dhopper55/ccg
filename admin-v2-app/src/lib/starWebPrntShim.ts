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
    StarWebPrintTrader?: new (args?: { url?: string; timeout?: number }) => {
      onReceive?: (response: { status?: number; responseText?: string }) => void;
      onError?: (response: { status?: number; responseText?: string }) => void;
      sendMessage: (args: { request: string }) => void;
    };
    __STAR_WEBPRNT_URL__?: string;
    _onFinish?: (payload: { url: string; htmlCode: number; response: string }) => void;
    webkit?: {
      messageHandlers?: {
        sendMessageHandler?: {
          postMessage: (payload: string) => void;
        };
      };
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
      if (alpha > 0 && luminance < 200) {
        const byteIndex = row * rowBytes + (col >> 3);
        bytes[byteIndex] |= 0x80 >> (col & 7);
      }
    }
  }

  return bytesToBase64(bytes);
};

class StarWebPrintBuilderShim {
  createInitializationElement(args: BuilderArgs = {}) {
    return `<initialization${attr('reset', args.reset === true ? 'true' : 'false')}${attr('print', args.print === true ? 'true' : 'false')}/>`;
  }

  createAlignmentElement(args: BuilderArgs = {}) {
    return `<alignment${attr('position', args.position || 'left')}/>`;
  }

  createBitImageElement(args: { context: CanvasRenderingContext2D; x: number; y: number; width: number; height: number }) {
    return `<bitimage${attr('width', args.width)}${attr('height', args.height)}>${canvasRegionToRaster(args.context, args.x, args.y, args.width, args.height)}</bitimage>`;
  }

  createPeripheralElement(args: BuilderArgs = {}) {
    return `<peripheral${attr('channel', args.channel ?? 1)}${attr('on', args.on ?? 200)}${attr('off', args.off ?? 200)}/>`;
  }

  createFeedElement(args: BuilderArgs = {}) {
    return `<feed${attr('line', args.line ?? 0)}${attr('unit', args.unit ?? 0)}/>`;
  }

  createCutPaperElement(args: BuilderArgs = {}) {
    return `<cutpaper${attr('feed', args.feed === false ? 'false' : 'true')}${attr('type', args.type || 'full')}/>`;
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
      '>' +
      escapeXml(args.data ?? '') +
      '</text>'
    );
  }
}

class StarWebPrintTraderShim {
  url: string;
  timeout: number;
  onReceive?: (response: { status?: number; responseText?: string }) => void;
  onError?: (response: { status?: number; responseText?: string }) => void;
  private requestJson?: string;

  constructor(args: { url?: string; timeout?: number } = {}) {
    this.url = args.url || '';
    this.timeout = args.timeout || 90000;
  }

  sendMessage(args: { request: string }) {
    if (!this.url) {
      this.onError?.({ status: 0, responseText: 'Missing Star webPRNT endpoint URL.' });
      return;
    }
    const root = `<root>${args.request}</root>`;
    const body =
      '<StarWebPrint xmlns="http://www.star-m.jp" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><Request>' +
      root.replace(/[<>&]/g, (char) => (char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&amp;')) +
      '</Request></StarWebPrint>';

    if (window.webkit?.messageHandlers?.sendMessageHandler) {
      this.requestJson = JSON.stringify({ url: this.url, body });
      getCallbacks()[this.url] = this;
      window.webkit.messageHandlers.sendMessageHandler.postMessage(this.requestJson);
      return;
    }

    const xhr = new XMLHttpRequest();
    const url = this.url.startsWith('https://localhost') ? `http://${this.url.substring(8)}` : this.url;
    xhr.open('POST', url, true);
    xhr.timeout = this.timeout;
    xhr.setRequestHeader('Content-Type', 'text/xml; charset=UTF-8');
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status === 200) this.onReceive?.({ status: xhr.status, responseText: xhr.responseText });
      else this.onError?.({ status: xhr.status, responseText: xhr.responseText });
    };
    xhr.send(body);
  }
}

const getCallbacks = () => {
  const state = window as Window & {
    __STAR_WEBPRNT_HANDLER_CALLBACKS__?: Record<string, StarWebPrintTraderShim | null>;
  };
  state.__STAR_WEBPRNT_HANDLER_CALLBACKS__ ||= {};
  return state.__STAR_WEBPRNT_HANDLER_CALLBACKS__;
};

export const ensureStarWebPrntGlobals = () => {
  if (typeof window === 'undefined') return;
  window.StarWebPrintBuilder ||= StarWebPrintBuilderShim;
  window.StarWebPrintTrader ||= StarWebPrintTraderShim;
  window._onFinish ||= (payload: { url: string; htmlCode: number; response: string }) => {
    const trader = getCallbacks()[payload.url];
    getCallbacks()[payload.url] = null;
    if (!trader) return;
    if (payload.htmlCode === 200) trader.onReceive?.({ status: payload.htmlCode, responseText: payload.response });
    else trader.onError?.({ status: payload.htmlCode, responseText: payload.response });
  };
};
