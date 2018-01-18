'use strict';
const locate = require('./locate');
const hosts = Symbol();
const subhosts = Symbol();
const noHost = Symbol();

/*
  A router for specializing between hostnames (and optionally ports).
  TODO: make it aware of promise-style route functions.
  TODO: allow the user to set a custom noHost handler.
 */

class HostRouter {
  constructor() {
    this[hosts] = Object.create(null);
    this[subhosts] = newLayer();
    this[noHost] = badGateway;
    return Object.setPrototypeOf(makeHandler(this), this);
  }
  host(domain, fn) {
    // First, check that the arguments are properly formatted.
    if (typeof domain !== 'string') throw new TypeError('Expected hostname to be a string');
    if (typeof fn !== 'function') throw new TypeError('Expected route definition to be a function');
    if (invalidDomain.test(domain)) throw new TypeError(`Invalid hostname: ${domain}`);
    const [hostname, port] = domain.split(':');
    // Then, expand the structure of our route maps.
    let host;
    if (!hostname.includes('*')) {
      host = this[hosts][hostname] || (this[hosts][hostname] = newHost());
    } else {
      let layer = this[subhosts];
      for (const part of hostname.split('.').reverse()) {
        if (part === '*') layer = layer.any || (layer.any = newLayer(layer));
        else layer = layer.inner[part] || (layer.inner[part] = newLayer(layer));
      }
      host = layer.host || (layer.host = newHost());
    }
    // And finally add the route function to the host object.
    if (port === undefined) {
      if (host.localPortFn !== undefined) throw new TypeError(`Duplicate host: ${hostname}`);
      host.localPortFn = fn;
    } else {
      const num = +port;
      if (num > 65535) throw new TypeError(`Invalid port number: ${port}`);
      if (host.ports.some(p => p === num)) throw new TypeError(`Duplicate host: ${hostname}:${port}`);
      host.ports.push(num);
      host.fns.push(fn);
    }
    return this;
  }
}

const makeHandler = (router) => (req, res) => {
  const location = locate(req, res);
  if (location === undefined) return;
  findHostFn(router, location, req)(req, res);
};

const findHostFn = (router, location, req) => {
  // First, parse the request for the hostname and port.
  const localPort = req.socket.localPort;
  let hostname = location.hostname;
  let port;
  if (hostname) {
    port = location.port === null ? localPort : +location.port;
  } else {
    hostname = req.headers.host;
    if (!hostname) return router[noHost];
    const index = hostname.indexOf(':');
    if (index === -1) {
      port = localPort;
    } else if (index !== 0) {
      port = +hostname.slice(index + 1);
      if (port >>> 0 !== port || port > 65535) return router[noHost];
      hostname = hostname.slice(0, index).toLowerCase();
    } else {
      return router[noHost];
    }
  }
  if (hostname.charCodeAt(0) === 46 || hostname.charCodeAt(hostname.length - 1) === 46) {
    hostname = hostname.replace(/^\.+|\.+$/g, '');
    if (!hostname) return router[noHost];
  }
  // Then, check if there's an exact or subhost match.
  return matchPort(router[hosts][hostname], port, localPort)
    || matchSubhost(router[subhosts], hostname, port, localPort)
    || router[noHost];
}

const matchSubhost = (layer, hostname, port, localPort) => {
  if (hostname.includes('..')) return;
  const parts = hostname.split('.');
  let i = parts.length;
  again: for (;;) {
    attempt: {
      while (--i >= 0) {
        const nextLayer = layer.inner[parts[i]] || layer.any;
        if (nextLayer) layer = nextLayer;
        else break attempt;
      }
      const fn = matchPort(layer.host, port, localPort);
      if (fn) return fn;
    }
    while (layer.outer) {
      while (layer.outer.any === layer) {
        layer = layer.outer;
        i += 1;
        if (!layer.outer) return;
      }
      layer = layer.outer;
      i += 1;
      if (layer.any) {
        layer = layer.any;
        continue again;
      }
    }
    return;
  }
};

const matchPort = (host, port, localPort) => {
  if (host) {
    const index = host.ports.indexOf(port);
    if (index !== -1) return host.fns[index];
    if (host.localPortFn && port === localPort) return host.localPortFn;
  }
};

const badGateway = (req, res) => { res.writeHead(502); res.end(); };
const newHost = () => ({ ports: [], fns: [], localPortFn: undefined });
const newLayer = outer => ({ inner: Object.create(null), outer, any: undefined, host: undefined });
const invalidDomain = /^$|^[.:]|\.[.:]|\.$|[?#@/\s]|[^.]\*|\*(?![.])|:(?!\d+$)/;
module.exports = HostRouter;
