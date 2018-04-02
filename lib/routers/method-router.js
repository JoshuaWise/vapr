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

// TODO: maybe handle HEAD, TRACE, or OPTIONS differently
class MethodRouter extends Router {
	constructor() {
		super(methodNotAllowed, getStaticKey, getDynamicKeys);
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
		if (this[shared.setMissingRoute](handler)) return this;
		throw new TypeError('A noSuchMethod handler was already set on this router');
	}
}

const addMethod = (router, method, handler) => {
	if (typeof handler !== 'function') throw new TypeError(`Expected ${method} handler to be a function`);
	if (router[shared.addStaticRoute](method, handler)) return router;
	throw new TypeError(`Duplicate method: ${method}`);
};

const getStaticKey = req => req.method;
const getDynamicKeys = () => {};
const methodNotAllowed = (req, res) => { res.writeHead(405); res.end(); };
module.exports = MethodRouter;
