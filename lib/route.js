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
	method. In addition, a 500 error response is generated in its place.
	
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
	let index = 0;
	let response;
	const stack = [];
	
	const newResponse = (value) => {
		if (typeof value === 'number' || Array.isArray(value)) {
			try { return new Response(value); }
			catch (err) { value = err; }
		}
		if (Response.isResponse(value)) return value;
		if (!(value instanceof Error)) value = new TypeError(`Expected route response to be a number or array ${shared.hint(value)}`);
		return (process.nextTick(logger, value), new Response(500));
	};
	
	const unwind = (returned) => {
		response = newResponse(returned);
		if (stack.length) {
			index = stack.length - 1;
			invoke(stack[index], response, prev);
		} else {
			done();
		}
	};
	
	const prev = (returned) => {
		if (returned != null) {
			dropResponse(response);
			response = newResponse(returned);
		}
		if (index === 0) done();
		else invoke(stack[--index], response, prev);
	};
	
	const done = () => {
		request[shared.discardBody]();
		if (request.aborted) {
			dropResponse(response);
			req.destroy();
			return;
		}
		try {
			respond(req, res, response, logger);
		} catch (err1) {
			process.nextTick(logger, err1);
			try {
				respond(req, res, new Response(500), logger);
			} catch (err2) {
				dropResponse(response);
				req.destroy();
				if (err1 && err2 && err1.message !== err2.message) process.nextTick(logger, err2);
			}
		}
	};
	
	invoke(handlers[0], request, function next(returned) {
		if (typeof returned === 'function') stack.push(returned);
		else if (returned != null) return unwind(returned);
		if (++index === handlers.length) return unwind(new TypeError(`Route handler did not return a response (got ${returned})`));
		invoke(handlers[index], request, next);
	});
};

const invoke = (fn, arg, cb) => {
	let returned, sync;
	try {
		returned = fn(arg);
		sync = !Promise.isPromise(returned);
	} catch (thrown) {
		return cb(thrown);
	}
	if (sync) cb(returned); // Avoid an unnecessary event loop cycle
	Promise.resolve(returned).then(cb, cb);
};

const dropResponse = (response) => {
	if (River.isRiver(response.body)) response.body.pump(noop)();
};

const noop = () => {};
Object.setPrototypeOf(Route.prototype, Function.prototype);
module.exports = Route;
