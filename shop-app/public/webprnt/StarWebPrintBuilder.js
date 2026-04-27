(function () {
  function escapeXml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function attr(name, value) {
    if (value === undefined || value === null || value === '') return '';
    return ' ' + name + "='" + escapeXml(value) + "'";
  }

  function bytesToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function canvasRegionToRaster(context, x, y, width, height) {
    var imageData = context.getImageData(x, y, width, height).data;
    var rowBytes = Math.ceil(width / 8);
    var bytes = new Uint8Array(rowBytes * height);

    for (var row = 0; row < height; row += 1) {
      for (var col = 0; col < width; col += 1) {
        var pixelIndex = (row * width + col) * 4;
        var red = imageData[pixelIndex];
        var green = imageData[pixelIndex + 1];
        var blue = imageData[pixelIndex + 2];
        var alpha = imageData[pixelIndex + 3];
        var luminance = red * 0.299 + green * 0.587 + blue * 0.114;
        var isBlack = alpha > 0 && luminance < 200;

        if (isBlack) {
          var byteIndex = row * rowBytes + (col >> 3);
          bytes[byteIndex] |= 0x80 >> (col & 7);
        }
      }
    }

    return bytesToBase64(bytes);
  }

  function StarWebPrintBuilder() {}

  StarWebPrintBuilder.prototype.createAlignmentElement = function (args) {
    var options = args || {};
    return '<alignment' + attr('position', options.position || 'left') + '/>';
  };

  StarWebPrintBuilder.prototype.createBitImageElement = function (args) {
    var options = args || {};
    var context = options.context;
    var x = options.x == null ? 0 : options.x;
    var y = options.y == null ? 0 : options.y;
    var width = options.width == null ? 0 : options.width;
    var height = options.height == null ? 0 : options.height;
    var rasterData = canvasRegionToRaster(context, x, y, width, height);

    return (
      '<bitimage' +
      attr('width', width) +
      attr('height', height) +
      '>' +
      rasterData +
      '</bitimage>'
    );
  };

  StarWebPrintBuilder.prototype.createInitializationElement = function (args) {
    var options = args || {};
    return (
      '<initialization' +
      attr('reset', options.reset === true ? 'true' : 'false') +
      attr('print', options.print === true ? 'true' : 'false') +
      '/>'
    );
  };

  StarWebPrintBuilder.prototype.createPeripheralElement = function (args) {
    var options = args || {};
    return (
      '<peripheral' +
      attr('channel', options.channel == null ? 1 : options.channel) +
      attr('on', options.on == null ? 200 : options.on) +
      attr('off', options.off == null ? 200 : options.off) +
      '/>'
    );
  };

  StarWebPrintBuilder.prototype.createFeedElement = function (args) {
    var options = args || {};
    return (
      '<feed' +
      attr('line', options.line == null ? 0 : options.line) +
      attr('unit', options.unit == null ? 0 : options.unit) +
      '/>'
    );
  };

  StarWebPrintBuilder.prototype.createCutPaperElement = function (args) {
    var options = args || {};
    return (
      '<cutpaper' +
      attr('feed', options.feed === false ? 'false' : 'true') +
      attr('type', options.type || 'full') +
      '/>'
    );
  };

  StarWebPrintBuilder.prototype.createTextElement = function (args) {
    var options = args || {};
    return (
      '<text' +
      attr('codepage', options.codepage) +
      attr('international', options.international) +
      attr('characterspace', options.characterspace) +
      attr('emphasis', options.emphasis) +
      attr('invert', options.invert) +
      attr('linespace', options.linespace) +
      attr('width', options.width) +
      attr('height', options.height) +
      attr('font', options.font) +
      attr('underline', options.underline) +
      attr('base_text_magnification', options.base_text_magnification) +
      attr('binary', options.binary) +
      '>' +
      escapeXml(options.data == null ? '' : options.data) +
      '</text>'
    );
  };

  window.StarWebPrintBuilder = window.StarWebPrintBuilder || StarWebPrintBuilder;
})();
