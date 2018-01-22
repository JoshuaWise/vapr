'use strict';
const { METHODS } = require('http');
const Router = require('./router');
const locate = require('./locate');
const shared = require('./shared');

/*
	A router for specializing between pathnames.
 */

class PathRouter extends Router {
	constructor(options) {
		super(notFound, getKey(options), splitKey);
	}
	define(method, pathname, handler) {
		if (!METHODS.includes(method)) throw new TypeError(`Unknown http method: ${method}`);
		if (typeof pathname !== 'string') throw new TypeError('Expected pathname to be a string');
		if (typeof handler !== 'function') throw new TypeError('Expected route handler to be a function');
		if (!validRoute.test(pathname)) throw new TypeError(`Invalid pathname: ${pathname}`);
		// TODO: handle constructor options
		if (!pathname.includes(':')) {
			if (this[shared.addStaticRoute](method + pathname, handler)) return this;
			throw new TypeError(`Duplicate route: ${pathname}`);
		} else {
			// TODO: dynamic routes
			// const keys = pathname.slice(1).split('/').map(s => s.startsWith(':') ? undefined : s);
			// if (this[shared.addDynamicRoute](keys, handler)) return this;
			// throw new TypeError(`Duplicate route: ${pathname}`);
		}
	}
}

const getKey = ({ slash = false, cases = false } = {}) => (req) => {
	const location = locate(req);
	// TODO
};

// const identity = x => x;
// const noCase = s => s.toLowerCase();
// const noSlash = s => s.length > 1 ? s.slice(0, s.search(/.\/*$/) + 1) : s;
// const noCaseNoSlash = s => noCase(noSlash(s));
const notFound = (req, res) => { res.writeHead(404); res.end(); };
const validRoute = /^(?:(?:\/(?::[a-z_$][a-z_$0-9]*|(?:[a-z0-9_!$()*+,.-]|%[0-9a-f]{2})+))+\/?|[*/])$/i;
const validPathname = /^(?:(?:\/(?:[a-z0-9_!$()*+,.-]|%[0-9a-f]{2})+)+\/?|[*/])$/i;
module.exports = PathRouter;
