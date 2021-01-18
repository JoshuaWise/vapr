'use strict';
const Router = require('./router');
const Route = require('../route');
const locate = require('../locate');
const shared = require('../shared');

/*
	A router for specializing between pathnames.
	Options:
		"noTrailingSlashRedirects": disables automatic redirects for trailing slashes.
	Examples:
		const router = new PathRouter({ noTrailingSlashRedirects: true });
		router.route('/', fn);
		router.route('/homepage/header', fn);
		router.route('/articles/:id/images/:name', fn);
		router.route('*', fn);
		router.notFound(fn); // This is used when no route is matched
 */

class PathRouter extends Router {
	constructor({ noTrailingSlashRedirects = false } = {}) {
		super(notFound, getStaticKey, getDynamicKeys);
		noTrailingSlashRedirects || usesRedirects.add(this);
	}
	route(pathname, handler, isRedirect = false) {
		if (typeof pathname !== 'string') throw new TypeError('Expected pathname to be a string');
		if (typeof handler !== 'function') throw new TypeError('Expected route handler to be a function');
		if (!validRoute.test(pathname)) throw new TypeError(`Invalid pathname: ${pathname}`);
		const staticKey = pathnameToKey(pathname);
		if (!staticKey) throw new TypeError('Pathname contains invalid encodings');
		const params = pathname.slice(1).split('/').map(s => s.startsWith(':') ? s.slice(1) : '');
		if (params.every(p => !p)) {
			if (!this[shared.addStaticRoute](staticKey, handler)) throw new TypeError(`Duplicate route: ${pathname}`);
		} else {
			const keys = staticKey.split('::').map((s, i) => params[i] ? undefined : s);
			if (Route.isRoute(handler)) handler = wrapWithParams(handler, params.map((p, i) => ({ name: p, index: i + 1 })).filter(p => p.name));
			if (!this[shared.addDynamicRoute](keys, handler)) throw new TypeError(`Duplicate route: ${pathname}`);
		}
		if (!isRedirect && usesRedirects.has(this) && pathname.length > 1 && !pathname.endsWith('//')) {
			if (pathname.endsWith('/')) {
				return this.route(pathname.slice(0, -1), redirectWithSlash, true);
			} else {
				return this.route(pathname + '/', redirectWithoutSlash, true);
			}
		} else {
			return this;
		}
	}
	notFound(handler) {
		if (typeof handler !== 'function') throw new TypeError('Expected notFound handler to be a function');
		if (this[shared.setMissingRoute](handler)) return this;
		throw new TypeError('A notFound handler was already set on this router');
	}
}

const redirectWithSlash = (req, res) => {
	let { url } = req;
	let indexOfQuery = url.indexOf('?');
	indexOfQuery = indexOfQuery < 0 ? url.length : indexOfQuery;
	url = url.slice(0, indexOfQuery) + '/' + url.slice(indexOfQuery);
	res.writeHead(308, { 'content-length': '0', 'location': url });
	res.end();
};

const redirectWithoutSlash = (req, res) => {
	let { url } = req;
	let indexOfQuery = url.indexOf('?');
	indexOfQuery = indexOfQuery < 0 ? url.length : indexOfQuery;
	url = url.slice(0, indexOfQuery - 1) + url.slice(indexOfQuery);
	res.writeHead(308, { 'content-length': '0', 'location': url });
	res.end();
};

const getStaticKey = (req, res) => {
	const location = locate(req, res);
	if (!location) return '';
	const key = pathnameToKey(location.pathname);
	if (!key) {
		res.writeHead(400, headers400);
		res.end();
	}
	return key;
};

const getDynamicKeys = (key) => {
	if (key.length === 1) return; // Reject "/" and "*"
	return key.split('::');
};

const wrapWithParams = (handler, paramIndexes) => (req, res) => {
	const keys = locate(req, res).pathname.split('/');
	const params = {};
	for (const { name, index } of paramIndexes) params[name] = keys[index];
	shared.params = params;
	return handler(req, res);
};

const pathnameToKey = (pathname) => {
	if (pathname.length === 1) return pathname;
	const parts = pathname.slice(1).split('/');
	for (let i = 0; i < parts.length; ++i) {
		const decodedSegment = safeDecode(parts[i]);
		if (decodedSegment === null) return '';
		parts[i] = Buffer.from(decodedSegment).toString('base64');
	}
	return parts.join('::'); // Separator must be minimum 2 characters
};

const safeDecode = (str) => {
	try {
		return decodeURIComponent(str);
	} catch (_) {
		return null;
	}
};

const notFound = (req, res) => { res.writeHead(404, headers404); res.end(); };
const validRoute = /^(?=.{1,2048}$)(?:(?:\/(?!:)(?:[\w.~:@!$&'()*+,;=-]|%[\da-f]{2})+|\/:[a-z_$][a-z_$\d]*)+\/?|[/*])$/i;
const headers404 = { 'content-length': '0' };
const headers400 = { 'content-length': '0', 'connection': 'close' };
const usesRedirects = new WeakSet();
module.exports = PathRouter;
