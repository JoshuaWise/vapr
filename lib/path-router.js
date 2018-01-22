'use strict';
const { METHODS } = require('http');
const Router = require('./router');
const locate = require('./locate');
const shared = require('./shared');

/*
	A router for specializing between pathnames.
 */

class PathRouter extends Router {
	constructor({ respectCase = false, respectTrailingSlash = false } = {}) {
		const normalizer = respectTrailingSlash ? respectCase ? identity : noCase : respectCase ? noSlash : noCaseNoSlash;
		const getKeyCurry = getKey(normalizer);
		super(notFound, getKeyCurry, splitKey);
		normalizers.set(this, normalizer);
	}
	define(method, pathname, handler) {
		if (!METHODS.includes(method)) throw new TypeError(`Unknown http method: ${method}`);
		if (typeof pathname !== 'string') throw new TypeError('Expected pathname to be a string');
		if (typeof handler !== 'function') throw new TypeError('Expected route handler to be a function');
		if (!validRoute.test(pathname)) throw new TypeError(`Invalid pathname: ${pathname}`);
		pathname = normalizers.get(this)(pathname);
		if (!pathname.includes(':')) {
			if (this[shared.addStaticRoute](method + pathname, handler)) return this;
			throw new TypeError(`Duplicate route: ${pathname}`);
		} else {
			const keys = [method, ...pathname.slice(1).split('/').map(s => s.startsWith(':') ? undefined : s)];
			if (this[shared.addDynamicRoute](keys, handler)) return this;
			throw new TypeError(`Duplicate route: ${pathname}`);
		}
	}
	notFound(handler) {
		this[shared.setMissingRoute](handler);
		return this;
	}
}

const getKey = (normalizer) => (req) => {
	const key = locate(req).pathname;
	if (!key || key.charCodeAt(0) !== 47 && key !== '*') return '';
	return req.method + normalizer(key);
};

const splitKey = (key) => {
	if (!validPathKey.test(key)) return;
	return key.split('/');
};

const normalizers = new WeakMap;
const identity = x => x;
const noCase = s => s.toLowerCase();
const noSlash = s => s.length > 1 && s.charCodeAt(s.length - 1) === 47 ? s.slice(0, -1) : s;
const noCaseNoSlash = s => noCase(noSlash(s));

const notFound = (req, res) => { res.writeHead(404); res.end(); };
const validRoute = /^(?:(?:\/(?::[a-z_$][a-z_$0-9]*|(?:[a-z0-9_!$()*+,.-]|%[0-9a-f]{2})+))+\/?|[*/])$/i;
// TODO: if i register [undefined], a single slash "/" could match it,
// unless I require at least one non-empty path segment here.
// Either way, it doesn't solve the problem of empty string matching wilds
const validPathKey = /^[^/*]+(?:\/(?:[a-z0-9_!$()*+,.-]|%[0-9a-f]{2})+)+\/?$/i;
module.exports = PathRouter;
