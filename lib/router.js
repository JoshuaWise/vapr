'use strict';
const { METHODS } = require('http');
const locate = require('./locate');
const Route = require('./route');
const methods = Symbol();
const noRoute = Symbol();
const normalize = Symbol();

/*
  A router for specializing between pathnames (and optionally url parameters).
  TODO: allow the user to set a custom noRoute handler.
 */

class Router {
  constructor({ respectCase = false, respectTrailingSlash = false } = {}) {
    this[methods] = Object.create(null);
    this[noRoute] = new Route(notFound);
    this[normalize] = respectCase ? respectTrailingSlash ? identity : noSlash : respectTrailingSlash ? noCase : noCaseNoSlash;
    for (const m of METHODS) this[methods][m] = Object.create(null);
    return Object.setPrototypeOf(makeHandler(this), this);
  }

  define(method, pathname, fn) {
    if (!METHODS.includes(method)) throw new TypeError(`Unknown http method: ${method}`);
    if (typeof pathname !== 'string') throw new TypeError('Expected pathname to be a string');
    if (typeof fn !== 'function') throw new TypeError('Expected route definition to be a function');
    if (invalidPathname.test(pathname)) throw new TypeError(`Invalid pathname: ${pathname}`);
    const map = this[methods][method];
    pathname = this[normalize](pathname);
    if (map[pathname] !== undefined) throw new TypeError(`Duplicate route: ${pathname}`);
    map[pathname] = new Route(fn);
    return this;
  }
}

/*
  Shorthand methods and other utilities.
 */

// TODO: maybe things like HEAD, OPTIONS, TRACE, or CONNECT should be handled differently
for (const m of ['GET', 'CONNECT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE']) {
  const fn = function (pathname, fn) { return this.define(m, pathname, fn) };
  const name = m.toLowerCase();
  Object.defineProperty(fn, 'name', Object.assign(Object.getOwnPropertyDescriptor(fn, 'name'), { value: name }));
  Object.defineProperty(Router.prototype, name, { value: fn, writable: true, enumerable: false, configurable: true });
}

const makeHandler = (router) => (req, res) => {
  const location = locate(req, res);
  if (location === undefined) return;
  const pathname = router[normalize](location.pathname);
  const route = router[methods][req.method][pathname] || router[noRoute];
  route.execute(req, res);
};

const identity = x => x;
const noCase = s => s.toLowerCase();
const noSlash = s => s.length > 1 ? s.slice(0, s.search(/.\/*$/) + 1) : s;
const noCaseNoSlash = s => noCase(noSlash(s));
const notFound = (req, res) => { res.writeHead(404); res.end(); };
const invalidPathname = /^(?!\/|\*$)|[?#@\s]/;

module.exports = Router;
