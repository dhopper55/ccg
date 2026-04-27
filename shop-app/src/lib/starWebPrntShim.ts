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
  onTimeout?: () => void;
  _json?: string;
  _url?: string;

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

    let requestRoot = '<root';
    if (this.checkedblock === false) {
      requestRoot += ' checkedblock="false"';
    }
    if (this.papertype) {
      requestRoot += ` papertype="${this.papertype}"`;
    }
    if (this.holdprint_timeout !== undefined) {
      requestRoot += ` holdprint_timeout="${this.holdprint_timeout}"`;
    }
    requestRoot += `>${args.request}</root>`;

    const body =
      '<StarWebPrint xmlns="http://www.star-m.jp" xmlns:i="http://www.w3.org/2001/XMLSchema-instance"><Request>' +
      this.encodeEscapeSequence(requestRoot) +
      '</Request></StarWebPrint>';

    const lowerUrl = url.toLowerCase();
    const userAgent = navigator.userAgent || '';
    const hasMessageHandlerSupport =
      /webPRNTSupportMessageHandler/.test(userAgent) &&
      /^https?:\/\/(localhost|127\.0\.0\.1):8001\//.test(lowerUrl) &&
      typeof window.webkit !== 'undefined' &&
      Boolean(window.webkit?.messageHandlers?.sendMessageHandler);

    if (hasMessageHandlerSupport) {
      this._json = JSON.stringify({ url, body });
      this._url = url;
      this.callMessageHandler();
      return;
    }

    const xhr = new XMLHttpRequest();
    let requestUrl = url;
    if (
      /iPad;|iPhone;|iPod touch;|Android/i.test(userAgent) &&
      !/WebPRNTSupportHTTPS/.test(userAgent) &&
      (lowerUrl.startsWith('https://localhost') || lowerUrl.startsWith('https://127.0.0.1'))
    ) {
      requestUrl = `http://${url.substring(8)}`;
    }

    try {
      xhr.open('POST', requestUrl, true);
    } catch (error) {
      this.onError?.({
        status: 10002,
        responseText: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    try {
      xhr.timeout = this.timeout;
    } catch {}

    xhr.setRequestHeader('Content-Type', 'text/xml; charset=UTF-8');

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      try {
        if (xhr.status === 200) {
          const responseNodes = xhr.responseXML?.getElementsByTagName('Response');
          if (responseNodes && responseNodes.length > 0) {
            const text = responseNodes[0].childNodes[0]?.nodeValue || '';
            this.onReceive?.({
              traderSuccess: text.slice(text.indexOf('<success>') + 9, text.indexOf('</success>')),
              traderCode: text.slice(text.indexOf('<code>') + 6, text.indexOf('</code>')),
              traderStatus: text.slice(text.indexOf('<status>') + 8, text.indexOf('</status>')),
              status: xhr.status,
              responseText: xhr.responseText,
            });
            return;
          }
        }
        this.onError?.({ status: xhr.status, responseText: xhr.responseText });
      } catch {
        this.onError?.({ status: 0, responseText: 'Connection timeout occurred.' });
      }
    };

    try {
      xhr.ontimeout = () => {
        this.onTimeout?.();
      };
    } catch {}

    try {
      xhr.send(body);
    } catch (error) {
      this.onError?.({
        status: 10003,
        responseText: error instanceof Error ? error.message : String(error),
      });
    }
  }

  encodeEscapeSequence(value: string) {
    return /[<>&]/.test(value)
      ? value.replace(/[<>&]/g, (char) => {
          switch (char) {
            case '<':
              return '&lt;';
            case '>':
              return '&gt;';
            default:
              return '&amp;';
          }
        })
      : value;
  }

  callMessageHandler() {
    if (!this._url || !this._json) return;
    const callbacks = getStarWebPrntHandlerCallbacks();
    if (callbacks[this._url] == null) {
      callbacks[this._url] = this;
      window.webkit?.messageHandlers?.sendMessageHandler?.postMessage(this._json);
      return;
    }
    window.setTimeout(() => this.callMessageHandler(), 500);
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
  if (typeof window._onFinish !== 'function') {
    window._onFinish = (payload: { url: string; htmlCode: number; response: string }) => {
      const callbacks = getStarWebPrntHandlerCallbacks();
      const trader = callbacks[payload.url];
      callbacks[payload.url] = null;
      if (!trader) return;
      if (payload.htmlCode === 200) {
        const responseText = payload.response;
        trader.onReceive?.({
          traderSuccess: responseText.slice(
            responseText.indexOf('&lt;success&gt;') + 15,
            responseText.indexOf('&lt;/success&gt;'),
          ),
          traderCode: responseText.slice(
            responseText.indexOf('&lt;code&gt;') + 12,
            responseText.indexOf('&lt;/code&gt;'),
          ),
          traderStatus: responseText.slice(
            responseText.indexOf('&lt;status&gt;') + 14,
            responseText.indexOf('&lt;/status&gt;'),
          ),
          status: payload.htmlCode,
          responseText,
        });
        return;
      }
      trader.onError?.({ status: payload.htmlCode, responseText: payload.response });
    };
  }
};

declare global {
  interface Window {
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

const getStarWebPrntHandlerCallbacks = () => {
  const state = window as Window & {
    __STAR_WEBPRNT_HANDLER_CALLBACKS__?: Record<string, StarWebPrintTraderShim | null>;
  };
  if (!state.__STAR_WEBPRNT_HANDLER_CALLBACKS__) {
    state.__STAR_WEBPRNT_HANDLER_CALLBACKS__ = {};
  }
  return state.__STAR_WEBPRNT_HANDLER_CALLBACKS__;
};
