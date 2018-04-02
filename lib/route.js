'use strict';
const Promise = require('wise-promise');
const Request = require('./request');
const Response = require('./response');
const respond = require('./respond');
const locate = require('./locate');
const shared = require('./shared');

/*
	Routes are server handlers designed to respond to requests, rather than
	route them (contrary to routers).
	
	Besides the primary route handler, a second function can be passed to the
	constructor to handle unexpected errors. When no error handler is given, the
	default bahavior is to throw an uncaught exception, crashing the process.
	This default can be overriden by setting a static Route.catch function.
	
	Each route can also have a number of before() and after() middleware hooks.
	If a response is provided in a before() middleware, execution skips directly
	to the after() middlewares. If a response is provided in an after()
	middleware, it replaces the previous response object. Responses must either
	be actual Response objects, or a valid constructor value for creating one.
	
	When designing APIs, a common pattern is to copy and slightly modify a route
	for the sake of publishing a new version of the API, while still maintaining
	the old version. In order to accomplish this without duplicating code, a new
	route can "inherit" an existing route by passing the existing route to the
	route constructor. The new route will use the same primary route handler,
	middleware, and error handler, as the parent route. However, when before()
	and after() middlewares are added to the new route, they will all execute
	before and after the parent's middleware, respectively. In other words, the
	child's middleware "wraps" around the parent. In addition, you can override
	the parent's error handler by passing a second function to the constructor.
	Routes can have an unlimited number of levels of inheritance.
 */

class Route {
	constructor(handler, catcher) {
		if (typeof handler !== 'function') throw new TypeError('Expected route handler to be a function');
		if (catcher != null && typeof catcher !== 'function') throw new TypeError('Expected error handler to be a function');
		const parent = handler[shared.settings] || Object.create(null);
		const before = [];
		const after = [];
		const beforeHandler = groupMiddleware(before)(parent.beforeHandler || handler);
		const afterHandler = (parent.afterHandler || build)(groupMiddleware(after));
		if (!catcher) catcher = parent.catcher || undefined;
		this[shared.settings] = { before, after, beforeHandler, afterHandler, catcher };
		return Object.setPrototypeOf(makeHandler(beforeHandler, afterHandler(), catcher), this);
	}
	before(handler) {
		if (Array.isArray(handler)) {
			for (const h of handler) this.before(h);
			return this;
		}
		if (typeof handler !== 'function') throw new TypeError('Expected a handler function or array of such');
		this[shared.settings].before.push(handler);
		return this;
	}
	after(handler) {
		if (Array.isArray(handler)) {
			for (const h of handler) this.after(h);
			return this;
		}
		if (typeof handler !== 'function') throw new TypeError('Expected a handler function or array of such');
		this[shared.settings].after.push(handler);
		return this;
	}
	use(plugin) {
		if (Array.isArray(plugin)) {
			for (const p of plugin) this.use(p);
			return this;
		}
		if (plugin == null) throw new TypeError('Expected a plugin object or an array of such');
		if (!hasOwnProperty.call(plugin, 'before')) throw new TypeError('Invalid plugin is missing "before" property');
		if (!hasOwnProperty.call(plugin, 'after')) throw new TypeError('Invalid plugin is missing "after" property');
		const { before, after } = plugin;
		if (before != null) this.before(before);
		if (after != null) this.after(after);
		return this;
	}
	static get catch() {
		return defaultCatcher === passthrough ? undefined : defaultCatcher;
	}
	static set catch(catcher) {
		if (catcher != null && typeof catcher !== 'function') throw new TypeError('Expected error handler to be a function');
		defaultCatcher = catcher || passthrough;
	}
}

const makeHandler = (beforeHandler, afterHandler, catcher) => (req, res) => {
	const location = locate(req);
	if (!location) return void req.destroy();
	const params = shared.params;
	shared.params = null;
	const request = new Request(req, location, params);
	let state = 0; // 0 = dont respond yet, 1 = ready to respond, 2 = error occurred
	invokeMiddleware(beforeHandler, request, undefined, function route(response) {
		if (state !== 1) {
			if (response == null) response = new TypeError('Expected route handler to return a response');
			response = castToResponse(response);
		}
		if (response.error) {
			if (state !== 2) {
				state = 2;
				invokeMiddleware(catcher || defaultCatcher, request, response.error, route);
			} else {
				process.nextTick(() => { throw response.error; }); // Fail hard -- uncaught error
				req.destroy();
			}
		} else if (state === 0) {
			state = 1;
			invokeMiddleware(afterHandler, request, response, route);
		} else if (request.aborted) {
			req.destroy();
		} else {
			request[shared.discardBody]();
			respond(req.method, res, response);
		}
	});
};

const groupMiddleware = (middleware) => (parent) => (request, response) => {
	let index = 0;
	return (function next(returned) {
		if (returned != null && returned !== request) {
			if (response === undefined) return returned; // A response was given before the primary route handler
			response = castToResponse(returned);
			if (response.error) return response;
		}
		if (index < middleware.length) return invokeMiddleware(middleware[index++], request, response, next);
		try { return parent(request, response); } catch (err) { return err; }
	}());
};

function invokeMiddleware(fn, a, b, cb) {
	let returned, sync;
	try {
		returned = fn(a, b);
		sync = !Promise.isPromise(returned);
	} catch (err) {
		return cb(err);
	}
	if (sync) return cb(returned); // Avoid an unnecessary event loop cycle
	return Promise.resolve(returned).then(cb, cb);
}

const castToResponse = (value) => {
	if (typeof value === 'number' || Array.isArray(value)) {
		try { return new Response(value); }
		catch (err) { value = err; }
	}
	if (value instanceof Error) return { error: value };
	if (Response.isResponse(value)) return value;
	return { error: new TypeError('Expected route response to be a number, array, or error') };
};

const passthrough = (a, b) => b;
const build = parent => child => child ? build(x => parent(child(x))) : parent(passthrough);
const { hasOwnProperty } = Object.prototype;
Object.setPrototypeOf(Route.prototype, Function.prototype);
let defaultCatcher = passthrough;
module.exports = Route;
