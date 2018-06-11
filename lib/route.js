'use strict';
const River = require('wise-river');
const Promise = require('wise-promise');
const Request = require('./state/request');
const Response = require('./state/response');
const respond = require('./respond');
const locate = require('./locate');
const shared = require('./shared');

/*
	Routes are server handlers designed to respond to requests, rather than
	route them (contrary to routers).
	
	Routes are defined by assigning one or more handler functions via the use()
	method. Each handler function is executed in order, each receives the
	Request object, and each may be either synchronous or asynchronous. Each
	handler can potentially respond to the request by returning a Response
	object, or a valid constructor value for creating one.
	
	When a handler function returns/throws a response, the rest are skipped and
	control flows backward through the handlers that were previously invoked.
	Had any previously invoked handlers returned a function, such functions will
	now be invoked in their reverse order. Each of these functions will receive
	the Response object, and each may be either synchronous or asynchronous.
	Should any of these functions return a new response, it will replace the
	existing Response object.
	
	If an unexpected error occurs during any of this, it will be reported to
	console.error, or whatever custom logger function is set via the logger()
	method. Besides that, it acts as if a 500 error response was generated.
	
	Some errors in HTTP are considered unrecoverable. When an error like this
	occurs, the connection will be destroyed immediately, and the error will be
	reported to the assigned logger function (or console.error).
 */

class Route {
	constructor() {
		this[shared.settings] = { logger: undefined, handlers: [] };
		return Object.setPrototypeOf(makeRoute(this[shared.settings]), this);
	}
	use(handler) {
		if (arguments.length > 1) throw new TypeError('To pass multiple handlers at once, use an array');
		if (Array.isArray(handler)) {
			for (const h of handler) this.use(h);
			return this;
		}
		if (typeof handler !== 'function') throw new TypeError('Expected a handler function or array of such');
		this[shared.settings].handlers.push(handler);
		return this;
	}
	logger(logger) {
		const settings = this[shared.settings];
		if (typeof logger !== 'function') throw new TypeError('Expected a logger function');
		if (settings.logger) throw new TypeError('A logger function is already set on this route');
		settings.logger = logger;
		return this;
	}
}

const makeRoute = (settings) => (req, res) => {
	const { logger = console.error, handlers } = settings;
	const location = locate(req);
	if (!location || !handlers.length) return void req.destroy();
	const params = shared.params;
	shared.params = null;
	executeRoute(req, res, logger, handlers, new Request(req, location, params));
};

const executeRoute = (req, res, logger, handlers, request) => {
	const afters = [];
	then(invokeBefores(afters, request, handlers), function continueRoute(response) {
		if (request.aborted) {
			process.nextTick(logger, response.error || new Error('The request was aborted'));
			dropResponse(response);
			req.destroy();
		} else if (response.error) {
			process.nextTick(logger, response.error);
			continueRoute(new Response(500));
		} else if (afters.length) {
			then(invokeAfters(request, response, afters), continueRoute);
		} else {
			// TODO: figure out what should happen if an unexpected error occurs inside respond()
			try { respond(req, res, response, logger); }
			catch (error) { continueRoute({ error }); }
		}
	});
};

const invokeBefores = (afters, request, handlers) => {
	let index = 0;
	return invoke(handlers[0], request, function next(returned) {
		if (typeof returned === 'function') afters.push(returned);
		else if (returned != null) return castToResponse(returned);
		if (request.aborted) return { error: new Error('The request was aborted') };
		if (handlers.length === ++index) return { error: new TypeError(`Route handler did not return a response (got ${returned})`) };
		return invoke(handlers[index], request, next);
	});
};

const invokeAfters = (request, response, afters) => {
	return invoke(afters.pop(), response, function next(returned) {
		if (returned != null) {
			dropResponse(response);
			response = castToResponse(returned);
			if (response.error) return response;
		}
		if (afters.length === 0 || request.aborted) return response;
		return invoke(afters.pop(), response, next);
	});
};

const invoke = (fn, arg, cb) => {
	let returned, sync;
	try {
		returned = fn(arg);
		sync = !Promise.isPromise(returned);
	} catch (err) {
		return cb(err);
	}
	if (sync) return cb(returned); // Avoid an unnecessary event loop cycle
	return Promise.resolve(returned).then(cb, cb);
};

// TODO: this could be optimized by passing callbacks to the invokeX functions
const then = (value, cb) => {
	if (!Promise.isPromise(value)) cb(value);
	else value.then(cb);
};

const castToResponse = (value) => {
	if (typeof value === 'number' || Array.isArray(value)) {
		try { return new Response(value); }
		catch (err) { value = err; }
	}
	if (value instanceof Error) return { error: value };
	if (Response.isResponse(value)) return value;
	return { error: new TypeError(`Expected route response to be a number or array ${shared.hint(value)}`) };
};

const dropResponse = (response) => {
	if (River.isRiver(response.body)) response.body.pump(noop)();
};

const noop = () => {};
Object.setPrototypeOf(Route.prototype, Function.prototype);
module.exports = Route;
