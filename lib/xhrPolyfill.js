"use strict";

// Manifest V3 service workers have no XMLHttpRequest (it's a Window-only API).
// This polyfill implements the small subset of the API used by
// translationService.js and textToSpeech.js (open/send/setRequestHeader,
// responseType "json"/"blob"/"" and the onload/onerror/onabort/ontimeout
// handlers) on top of fetch(), so those files can run unmodified.
if (typeof XMLHttpRequest === "undefined") {
  self.XMLHttpRequest = class XMLHttpRequest {
    constructor() {
      this.responseType = "";
      this.response = null;
      this.responseText = "";
      this.status = 0;
      this.onload = null;
      this.onerror = null;
      this.onabort = null;
      this.ontimeout = null;
      this._method = "GET";
      this._url = null;
      this._headers = {};
      this._responseHeaders = null;
    }
    open(method, url) {
      this._method = method;
      this._url = url;
    }
    setRequestHeader(name, value) {
      this._headers[name] = value;
    }
    getResponseHeader(name) {
      return this._responseHeaders ? this._responseHeaders.get(name) : null;
    }
    abort() {
      if (this.onabort) this.onabort(new Event("abort"));
    }
    async send(body) {
      try {
        const response = await fetch(this._url, {
          method: this._method,
          headers: this._headers,
          body: body === undefined ? null : body
        });
        this.status = response.status;
        this._responseHeaders = response.headers;
        if (this.responseType === "json") {
          try {
            this.response = await response.json();
          } catch (e) {
            this.response = null;
          }
        } else if (this.responseType === "blob") {
          this.response = await response.blob();
        } else if (this.responseType === "arraybuffer") {
          this.response = await response.arrayBuffer();
        } else {
          this.responseText = await response.text();
          this.response = this.responseText;
        }
        if (this.onload) this.onload(new Event("load"));
      } catch (e) {
        console.error(e);
        if (this.onerror) this.onerror(e);
      }
    }
  };
}
