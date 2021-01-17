'use strict';
const Router = require('./router');
const Route = require('../route');
const locate = require('../locate');
const decode = require('../decode');
const shared = require('../shared');

/*
	A router for specializing between pathnames.
	Options:
		"respectTrailingSlash": if not true, trailing slashes are ignored.
	Examples:
		const router = new PathRouter({ respectTrailingSlash: true });
		router.route('/', fn);
		router.route('/homepage/header', fn);
		router.route('/articles/:id/images/:name', fn);
		router.route('*', fn);
		router.notFound(fn); // This is used when no route is matched
 */

class PathRouter extends Router {
	constructor({ respectTrailingSlash = false } = {}) {
		const normalizer = respectTrailingSlash ? identity : noSlash;
		super(notFound, getStaticKey(normalizer), getDynamicKeys);
		normalizers.set(this, normalizer);
	}
	route(pathname, handler) {
		if (typeof pathname !== 'string') throw new TypeError('Expected pathname to be a string');
		if (typeof handler !== 'function') throw new TypeError('Expected route handler to be a function');
		if (!validRoute.test(pathname)) throw new TypeError(`Invalid pathname: ${pathname}`);
		const params = pathname.slice(1).split('/').map(s => s.startsWith(':') ? s.slice(1) : '');
		pathname = normalizers.get(this)(decode(pathname).normalize());
		if (!pathname) throw new TypeError('Pathname contains invalid encodings');
		if (params.every(p => !p)) {
			if (this[shared.addStaticRoute](pathname, handler)) return this;
			throw new TypeError(`Duplicate route: ${pathname}`);
		} else {
			const keys = pathname.slice(1).split('/').map((s, i) => params[i] ? undefined : s);
			if (Route.isRoute(handler)) handler = wrapWithParams(handler, params.map((p, i) => ({ name: p, index: i + 1 })).filter(p => p.name));
			if (this[shared.addDynamicRoute](keys, handler)) return this;
			throw new TypeError(`Duplicate route: ${pathname}`);
		}
	}
	notFound(handler) {
		if (typeof handler !== 'function') throw new TypeError('Expected notFound handler to be a function');
		if (this[shared.setMissingRoute](handler)) return this;
		throw new TypeError('A notFound handler was already set on this router');
	}
}

const getStaticKey = (normalizer) => (req) => {
	const location = locate(req);
	if (!location) return '';
	return normalizer(decode(location.pathname).normalize());
};

const getDynamicKeys = (key) => {
	if (key.length === 1) return; // Reject "/" and "*"
	return key.slice(1).split('/');
};

const wrapWithParams = (handler, paramIndexes) => (req, res) => {
	const keys = locate(req).pathname.split('/');
	const params = {};
	for (const { name, index } of paramIndexes) params[name] = keys[index];
	shared.params = params;
	return handler(req, res);
};

const identity = x => x;
const noSlash = s => s.length > 1 && s.charCodeAt(s.length - 1) === 47 ? s.slice(0, -1) : s;

const notFound = (req, res) => { res.writeHead(404, headers); res.end(); };
const validRoute = /^(?=.{1,2048}$)(?:(?:\/(?!:)(?:[\w.~:@!$&'()*+,;=-]|%[\da-f]{2})+|\/:[a-z_$][a-z_$\d]*)+\/?|[/*])$/i;
const headers = { 'content-length': '0' };
const normalizers = new WeakMap;
module.exports = PathRouter;
