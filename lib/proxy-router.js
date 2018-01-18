'use strict';
const { parse } = require('url');
const locate = require('./locate');
const hosts = Symbol();
const noProxy = Symbol();

class ProxyRouter {
  constructor() {
    this[hosts] = Object.create(null);
    this[noProxy] = badGateway;
    return Object.setPrototypeOf(makeHandler(this), this);
  }
  host(domain, handler) {
    if (typeof domain !== 'string') throw new TypeError('Expected hostname to be a string');
    let { hostname, port, auth, hash, path, protocol } = parse(domain, false, true);
    const list = this[hosts][hostname];
    port = port === null ? -1 : +port;
    if (typeof handler !== 'function') handler = null;
    if (!hostname || auth || hash || path || protocol) throw new TypeError('Invalid hostname');
    if (findHost(list, port) !== undefined) throw new TypeError(`Duplicate host: ${hostname}${port === -1 ? '' : ':' + port}`);
    if (list === undefined) list = this[hosts][hostname] = { ports: [], handlers: [] };
    list.ports.push(port);
    list.handlers.push(handler);
    return this;
  }
}

const makeHandler = (proxy) => (req, res) => {
  const location = locate(req, res);
  if (location === undefined) return;
  const hostname = location.hostname || normalizeHostname(req.headers.host);
  const port = location.port === null ? -1 : +location.port;
  const handler = findHost(proxy[hosts][hostname], port) || proxy[noProxy];
  handler(req, res);
};

const findHost = (list, port) => {
  if (list !== undefined) {
    const { ports } = list;
    for (let i = 0, len = ports.length; i < len; ++i) {
      if (ports[i] === port) return list.handlers[i];
    }
  }
};

const badGateway = (req, res) => { res.writeHead(502); res.end(); };
const normalizeHostname = s => s ? s.slice(0, s.indexOf(':') >>> 0).toLowerCase() : '';
