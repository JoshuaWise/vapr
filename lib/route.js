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
	
	If an unexpected error occurs during any of this, the route will stop
	executing and by default a 500 error will be triggered. However, a custom
	error handler can be set via the catch() method, which may return any valid
	response. This handler receives the Request object and the associated Error.
	
	Some errors in HTTP are considered unrecoverable. When an error like this
	occurs, the connection will be destroyed immediately, and the error will be
	reported to the assigned reporter function, if any. A reporter function can
	be assigned via the report() method. This error handler differs from the
	previous in that it cannot return a response (the error is unrecoverable).
	This is just used for logging, if desired.
 */

class Route {
	constructor() {
		const handlers = [];
		this[shared.settings] = { catcher: internalServerError, reporter: undefined, handlers };
		return Object.setPrototypeOf(makeRoute(handlers, this[shared.settings]), this);
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
	catch(catcher) {
		const settings = this[shared.settings];
		if (typeof catcher !== 'function') throw new TypeError('Expected a catcher function');
		if (settings.catcher !== internalServerError) throw new TypeError('A catcher function is already set on this route');
		settings.catcher = catcher;
		return this;
	}
	report(reporter) {
		const settings = this[shared.settings];
		if (typeof reporter !== 'function') throw new TypeError('Expected a reporter function');
		if (settings.reporter !== undefined) throw new TypeError('A reporter function is already set on this route');
		settings.reporter = reporter;
		return this;
	}
}

const makeRoute = (handlers, settings) => (req, res) => {
	const location = locate(req);
	if (!location || !handlers.length) return void req.destroy();
	const params = shared.params;
	shared.params = null;
	executeRoute(req, res, settings, handlers, new Request(req, location, params));
};

const executeRoute = (req, res, settings, handlers, request) => {
	let afters = [];
	let catchable = true;
	then(invokeBefores(afters, request, handlers), function continueRoute(response) {
		if (request.aborted) {
			catchable = false;
			if (!response.error) {
				dropResponse(response);
				response = { error: new Error('The request was aborted') };
			}
		}
		if (response.error) {
			if (catchable) {
				afters = [];
				catchable = false;
				then(invokeCatcher(request, response.error, settings.catcher), continueRoute);
			} else {
				if (settings.reporter) process.nextTick(settings.reporter, response.error);
				req.destroy();
			}
		} else if (afters.length) {
			const xAfters = afters;
			afters = [];
			then(invokeAfters(request, response, xAfters), continueRoute);
		} else {
			try { respond(req, res, response, settings.reporter); }
			catch (error) { continueRoute({ error }); }
		}
	});
};

const invokeBefores = (afters, request, handlers) => {
	let index = 1;
	return invoke(handlers[0], request, function next(returned) {
		if (typeof returned === 'function') afters.push(returned);
		else if (returned != null) return castToResponse(returned);
		if (request.aborted) return { error: new Error('The request was aborted') };
		if (index === handlers.length) return { error: new TypeError(`Route handler did not return a response (got ${returned})`) };
		return invoke(handlers[index++], request, next);
	});
};

const invokeAfters = (request, response, afters) => {
	let index = afters.length - 1;
	return invoke(afters[index], response, function next(returned) {
		if (returned != null) {
			dropResponse(response);
			response = castToResponse(returned);
			if (response.error) return response;
		}
		if (index === 0 || request.aborted) return response;
		return invoke(afters[--index], response, next);
	});
};

const invokeCatcher = (request, err, catcher) => {
	return invoke(request => catcher(request, err), request, (returned) => {
		if (returned != null) return castToResponse(returned);
		return { error: new TypeError(`Route handler did not return a response (got ${returned})`) };
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
const internalServerError = () => 500;
Object.setPrototypeOf(Route.prototype, Function.prototype);
module.exports = Route;
