'use strict';
const MethodRouter = require('../routers/method-router');
const Route = require('../route');

class ApplicationResource extends MethodRouter {
	constructor(options) {
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
module.exports = ApplicationResource;
