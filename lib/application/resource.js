'use strict';
const MethodRouter = require('../routers/method-router');
const Route = require('../route');

/*
	This is a subclass of MethodRouter that accepts Route handlers (as accepted
	by the use() method) instead of raw http.Server handlers. Each of its
	methods have been modified to return the resulting Route object.
 */

class Resource extends MethodRouter {
	constructor(options) {
		if (options == null) options = undefined;
		else if (typeof options !== 'object') throw new TypeError('Expected options to be an object');
		super(options);
		savedOptions.set(this, options);
	}
	get(...handlers) { return addMethod(this, super.get, handlers); }
	post(...handlers) { return addMethod(this, super.post, handlers); }
	put(...handlers) { return addMethod(this, super.put, handlers); }
	patch(...handlers) { return addMethod(this, super.patch, handlers); }
	delete(...handlers) { return addMethod(this, super.delete, handlers); }
	head(...handlers) { return addMethod(this, super.head, handlers); }
	options(...handlers) { return addMethod(this, super.options, handlers); }
	trace(...handlers) { return addMethod(this, super.trace, handlers); }
	noSuchMethod(...handlers) { return addMethod(this, super.noSuchMethod, handlers); }
}

const addMethod = (self, fn, handlers) => {
	const route = new Route(savedOptions.get(self)).use(...handlers);
	fn.call(self, route);
	return route;
};

const savedOptions = new WeakMap;
module.exports = Resource;
