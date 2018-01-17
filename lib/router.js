'use strict';
const { METHODS } = require('http');
const methods = Object.assign(Object.create(null), ...METHODS.map(m => ({ [m]: Symbol() })));
const notFound = Symbol();

const trimParams = s => s.replace(/[?#].*/, '');
const trimParamsAndCase = s => trimParams(s).toLowerCase();
const trimParamsAndSlash = s => trimParams(s).replace(/\/+$/, '');
const trimParamsAndCaseAndSlash = s => trimParamsAndSlash(s).toLowerCase();
const defaultNotFound = (req, res) => { res.writeHead(404); res.end(); };

const makeHandler = (router, getPathname) => (req, res) => {
  const pathname = getPathname(req.url);
  const route = router[methods[req.method]][pathname] || router[notFound];
  // NOTE: If we re-use pathname, it could be forced lowercase, but queryparams/hash might not be (pending)
  route.execute(req, res, pathname);
};

class Router {
  constructor({ respectCase = false, respectTrailingSlash = false } = {}) {
    const getPathname = respectCase ? respectTrailingSlash ? trimParams : trimParamsAndSlash : respectTrailingSlash ? trimParamsAndCase : trimParamsAndCaseAndSlash;
    for (const key in methods) this[methods[key]] = Object.create(null);
    this[notFound] = defaultNotFound;
    return Object.setPrototypeOf(makeHandler(this, getPathname), this);
  }
}

module.exports = Router;
