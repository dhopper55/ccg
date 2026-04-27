(function () {
  function parseXml(xmlText) {
    try {
      return new DOMParser().parseFromString(xmlText, 'text/xml');
    } catch (error) {
      return null;
    }
  }

  function textContent(doc, tagName) {
    if (!doc) return '';
    var node = doc.getElementsByTagName(tagName)[0];
    return node && node.textContent ? node.textContent : '';
  }

  function StarWebPrintTrader(args) {
    var options = args || {};
    this.url = options.url || '';
    this.checkedblock = options.checkedblock !== false;
    this.papertype = options.papertype || '';
    this.timeout = options.timeout || 90000;
    this.holdprint_timeout = options.holdprint_timeout || 10000;
    this.onReceive = null;
    this.onError = null;
  }

  StarWebPrintTrader.prototype.sendMessage = function (args) {
    var options = args || {};
    var url = options.url || this.url;
    var request = options.request;

    if (!url) {
      if (typeof this.onError === 'function') {
        this.onError({ status: 0, responseText: 'Missing Star webPRNT endpoint URL.' });
      }
      return;
    }

    var controller = new AbortController();
    var timeoutId = window.setTimeout(function () {
      controller.abort();
    }, this.timeout);

    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: request,
      signal: controller.signal,
    })
      .then(function (response) {
        return response.text().then(function (responseText) {
          window.clearTimeout(timeoutId);
          var doc = parseXml(responseText);
          var payload = {
            status: response.status,
            responseText: responseText,
            traderSuccess: textContent(doc, 'success') || (response.ok ? 'true' : 'false'),
            traderCode: textContent(doc, 'code'),
            traderStatus: textContent(doc, 'status'),
          };

          if (response.ok) {
            if (typeof this.onReceive === 'function') {
              this.onReceive(payload);
            }
            return;
          }

          if (typeof this.onError === 'function') {
            this.onError(payload);
          }
        }.bind(this));
      }.bind(this))
      .catch(function (error) {
        window.clearTimeout(timeoutId);
        if (typeof this.onError === 'function') {
          this.onError({
            status: 0,
            responseText: error instanceof Error ? error.message : String(error),
          });
        }
      }.bind(this));
  };

  window.StarWebPrintTrader = window.StarWebPrintTrader || StarWebPrintTrader;
})();
