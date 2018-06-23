'use strict';
const Router = require('./router');
const shared = require('../shared');

/*
	A router for specializing between http methods.
	Examples:
		const router = new MethodRouter();
		router.get(fn);
		router.post(fn);
		router.noSuchMethod(fn);
 */

class MethodRouter extends Router {
	constructor() {
		const header = { allow: '' };
		super(methodNotAllowed(header), getStaticKey, getDynamicKeys);
		headers.set(this, header);
	}
	get(handler) { return addMethod(this, 'GET', handler); }
	post(handler) { return addMethod(this, 'POST', handler); }
	put(handler) { return addMethod(this, 'PUT', handler); }
	patch(handler) { return addMethod(this, 'PATCH', handler); }
	delete(handler) { return addMethod(this, 'DELETE', handler); }
	head(handler) { return addMethod(this, 'HEAD', handler); }
	options(handler) { return addMethod(this, 'OPTIONS', handler); }
	trace(handler) { return addMethod(this, 'TRACE', handler); }
	noSuchMethod(handler) {
		if (typeof handler !== 'function') throw new TypeError('Expected noSuchMethod handler to be a function');
		if (!this[shared.setMissingRoute](handler)) throw new TypeError('A noSuchMethod handler was already set on this router');
		headers.delete(this);
		return this;
	}
}

const addMethod = (router, method, handler) => {
	if (typeof handler !== 'function') throw new TypeError(`Expected ${method} handler to be a function`);
	if (!router[shared.addStaticRoute](method, handler)) throw new TypeError(`Duplicate method: ${method}`);
	if (headers.has(router)) {
		const header = headers.get(router);
		header.allow = (header.allow ? header.allow.split(',') : []).concat(method).sort().join(',');
	}
	return router;
};

const getStaticKey = req => req.method;
const getDynamicKeys = () => {};
const methodNotAllowed = (header) => (req, res) => { res.writeHead(405, header); res.end(); };
const headers = new WeakMap;
module.exports = MethodRouter;
