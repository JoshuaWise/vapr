'use strict';
const { METHODS } = require('http');
const Route = require('./route');
const methods = Object.assign(Object.create(null), ...METHODS.map(m => ({ [m]: Symbol() })));
const getPathname = Symbol();
const notFound = Symbol();

class Router {
  constructor({ respectCase = false, respectTrailingSlash = false } = {}) {
    for (const m of METHODS) this[methods[m]] = Object.create(null);
    this[notFound] = defaultNotFound;
    this[getPathname] = respectCase ? respectTrailingSlash ? trimParams : trimParamsAndSlash : respectTrailingSlash ? trimParamsAndCase : trimParamsAndCaseAndSlash;
    return Object.setPrototypeOf(makeHandler(this), this);
  }

  define(method, pathname, definition) {
    const symbol = methods[String(method).toUpperCase()];
    if (typeof symbol !== 'symbol') throw new TypeError(`Unknown http method "${method}"`);
    if (typeof pathname !== 'string') throw new TypeError('Expected pathname to be a string');
    if (typeof definition !== 'function') throw new TypeError('Expected route definition to be a function');
    // TODO
    // this[symbol][this[getPathname](pathname)] = new Route(definition);
    return this;
  }
}

/*
  Shorthand methods and other utilities.
 */

for (const m of ['GET', 'CONNECT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE']) {
  const fn = function (pathname, definition) { return this.define(m, pathname, definition) };
  const name = m.toLowerCase();
  Object.defineProperty(fn, 'name', Object.assign(Object.getOwnPropertyDescriptor(fn, 'name'), { value: name }));
  Object.defineProperty(Router.prototype, name, { value: fn, writable: true, enumerable: false, configurable: true });
}

const makeHandler = (router) => (req, res) => {
  const pathname = router[getPathname](req.url);
  const route = router[methods[req.method]][pathname] || router[notFound];
  // NOTE: If we re-use pathname, it could be forced lowercase, but queryparams/hash might not be (pending)
  route.execute(req, res, pathname);
};

const trimParams = s => s.replace(/[?#].*/, '');
const trimParamsAndCase = s => trimParams(s).toLowerCase();
const trimParamsAndSlash = s => trimParams(s).replace(/\/+$/, '');
const trimParamsAndCaseAndSlash = s => trimParamsAndSlash(s).toLowerCase();
const defaultNotFound = new Route((req, res) => { res.writeHead(404); res.end(); });

module.exports = Router;
