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
		const headers = { allow: '', 'content-length': '0' };
		super(methodNotAllowed(headers), getStaticKey, getDynamicKeys);
		savedHeaders.set(this, headers);
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
		savedHeaders.delete(this);
		return this;
	}
}

const addMethod = (self, method, handler) => {
	if (typeof handler !== 'function') throw new TypeError(`Expected ${method} handler to be a function`);
	if (!self[shared.addStaticRoute](method, handler)) throw new TypeError(`Duplicate method: ${method}`);
	if (savedHeaders.has(self)) {
		const headers = savedHeaders.get(self);
		const methods = (headers.allow ? headers.allow.split(',') : []).concat(method).sort();
		headers.allow = Buffer.from(methods.join(',')).toString(); // Serialize string in V8
	}
	return self;
};

const getStaticKey = req => req.method;
const getDynamicKeys = () => {};
const methodNotAllowed = (headers) => (req, res) => { res.writeHead(405, headers); res.end(); };
const savedHeaders = new WeakMap;
module.exports = MethodRouter;
