'use strict';
const { TLSSocket } = require('tls');
const { parse } = require('url');
const locate = require('./locate');
const hosts = Symbol();
const noHost = Symbol();

/*
  A router for specializing between hostnames (and optionally ports).
  TODO: make it aware of promise-style definition functions.
  TODO: allow a user to specify a custom noHost definition.
  TODO: allow a user to specify "*" for subdomains.
 */

class HostRouter {
  constructor() {
    this[hosts] = Object.create(null);
    this[noHost] = badGateway;
    return Object.setPrototypeOf(makeHandler(this), this);
  }
  host(domain, definition) {
    if (typeof domain !== 'string') throw new TypeError('Expected hostname to be a string');
    const { hostname, port, auth, hash, path, protocol } = parse(domain, false, true);
    if (!hostname || auth || hash || path || protocol) throw new TypeError('Invalid hostname');
    let host = this[hosts][hostname];
    if (host === undefined) host = this[hosts][hostname] = { ports: [], definitions: [], catchAll: undefined };
    if (typeof definition !== 'function') definition = null;
    if (port === null) {
      if (host.catchAll !== undefined) throw new TypeError(`Duplicate host: ${hostname}`);
      host.catchAll === definition;
    } else {
      const num = +port;
      if (host.ports.some(p => p === num)) throw new TypeError(`Duplicate host: ${hostname}:${port}`);
      host.ports.push(num);
      host.definitions.push(definition);
    }
    return this;
  }
}

const makeHandler = (router) => (req, res) => {
  const location = locate(req, res);
  if (location === undefined) return;
  const hostname = location.hostname || normalizeHostname(req.headers.host);
  const port = location.port === null ? req.socket instanceof TLSSocket ? 443 : 80 : +location.port;
  const definition = findDefinition(router[hosts][hostname], port) || router[noHost];
  definition(req, res);
};

const findDefinition = (host, port) => {
  if (host !== undefined) {
    const { ports } = host;
    for (let i = 0, len = ports.length; i < len; ++i) {
      if (ports[i] === port) return host.definitions[i];
    }
    return host.catchAll;
  }
};

const badGateway = (req, res) => { res.writeHead(502); res.end(); };
const normalizeHostname = s => s ? s.slice(0, s.indexOf(':') >>> 0).toLowerCase() : '';
