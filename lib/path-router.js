'use strict';
const { METHODS } = require('http');
const Router = require('./router');
const locate = require('./locate');
const decode = require('./decode');
const shared = require('./shared');
const normalizer = Symbol();

/*
	A router for specializing between http methods and pathnames.
	Options:
		"respectCase": if not true, the path is always lowercased.
		"respectTrailingSlash": if not true, trailing slashes are ignored.
	Examples:
		const router = new PathRouter({ respectTrailingSlash: true });
		router.define('GET', '/', fn);
		router.define('GET', '/homepage/header', fn);
		router.define('PUT', '/articles/:id/images/:name', fn);
		router.define('OPTIONS', '*', fn);
		router.notFound(fn); // This is used when no route is matched
 */

class PathRouter extends Router {
	constructor({ respectCase = false, respectTrailingSlash = false } = {}) {
		const normalize = respectTrailingSlash ? respectCase ? identity : noCase : respectCase ? noSlash : noCaseNoSlash;
		super(notFound, getStaticKey(normalize), getDynamicKeys);
		this[shared.instance][normalizer] = normalize;
	}
	define(method, pathname, handler) {
		method = method.toUpperCase();
		if (pathname === '*' && method !== 'OPTIONS') throw new TypeError('Only the OPTIONS method can use a "*" route');
		if (method === 'CONNECT') throw new TypeError('To handle CONNECT requests, use httpServer.on("connect", fn)');
		if (!METHODS.includes(method)) throw new TypeError(`Unknown http method: ${method}`);
		if (typeof pathname !== 'string') throw new TypeError('Expected pathname to be a string');
		if (typeof handler !== 'function') throw new TypeError('Expected route handler to be a function');
		if (!validRoute.test(pathname)) throw new TypeError(`Invalid pathname: ${pathname}`);
		const params = pathname.slice(1).split('/').map(s => s.startsWith(':') ? s.slice(1) : '');
		pathname = this[normalizer](decode(pathname).normalize('NFD'));
		if (!pathname) throw new TypeError('Pathname contains invalid encodings');
		if (params.every(p => !p)) {
			if (this[shared.addStaticRoute](method + pathname, handler)) return this;
			throw new TypeError(`Duplicate route: ${method} ${pathname}`);
		} else {
			const keys = [method, ...pathname.slice(1).split('/').map((s, i) => params[i] ? undefined : s)];
			if (this[shared.addDynamicRoute](keys, handler)) return this;
			throw new TypeError(`Duplicate route: ${method} ${pathname}`);
		}
	}
	notFound(handler) {
		if (typeof handler !== 'function') throw new TypeError('Expected notFound handler to be a function');
		if (this[shared.setMissingRoute](handler)) return this;
		throw new TypeError('A notFound handler was already set on this router');
	}
}

const getStaticKey = (normalize) => (req) => {
	const location = locate(req);
	if (!location) return '';
	const path = normalize(decode(location.path).normalize('NFD'));
	return path ? req.method + path : '';
};

const getDynamicKeys = (key) => {
	const index = key.indexOf('/');
	if (index === key.length - 1 || index === -1) return; // Reject "/" and "*"
	return key.split('/');
};

const identity = x => x;
const noCase = s => s.toLowerCase();
const noSlash = s => s.length > 1 && s.charCodeAt(s.length - 1) === 47 ? s.slice(0, -1) : s;
const noCaseNoSlash = s => noCase(noSlash(s));

const notFound = (req, res) => { res.writeHead(404); res.end(); };
const validRoute = /^(?=.{1,2048}$)(?:(?:\/(?!:)(?:[\w.~:@!$&'()*+,;=-]|%[\da-f]{2})+|\/:[a-z_$][a-z_$\d]*)+\/?|[/*])$/i;
module.exports = PathRouter;
