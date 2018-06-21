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
	
	If an unexpected error occurs during any of this, a 500 error response will
	generated in its place. In this case, you can access the original error
	object at response.error.
	
	Some errors in HTTP are considered unrecoverable. When an error like this
	occurs, the connection will be destroyed immediately, and the error will be
	reported to process.emitWarning, or whatever custom logger function is set
	via the logger() method.
 */

class Route {
	constructor({ logger } = {}) {
		if (logger == null) logger = undefined;
		else if (typeof logger !== 'function') throw new TypeError('Expected logger to be a function');
		this[shared.settings] = { logger, handlers: [], setLogger: false };
		return Object.setPrototypeOf(makeRoute(this[shared.settings]), this);
	}
	use(...handlers) {
		for (const handler of handlers) {
			if (Array.isArray(handler)) {
				this.use(...handler);
			} else {
				if (typeof handler !== 'function') throw new TypeError('Expected a handler function or array of such');
				this[shared.settings].handlers.push(handler);
			}
		}
		return this;
	}
	logger(logger) {
		const settings = this[shared.settings];
		if (typeof logger !== 'function') throw new TypeError('Expected a logger function');
		if (settings.setLogger) throw new TypeError('A logger function is already set on this route');
		settings.logger = logger;
		settings.setLogger = true;
		return this;
	}
}

const makeRoute = (settings) => (req, res) => {
	const { logger = process.emitWarning, handlers } = settings;
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
			dropResponse(response); // A new response is replacing the existing one
			response = newResponse(returned);
		}
		if (index === 0) done();
		else invoke(stack[--index], response, prev);
	};
	
	const done = () => {
		request[shared.discardBody]();
		if (request.aborted) {
			// An aborted request is not a server error, so don't log an error.
			dropResponse(response);
			req.destroy();
			return;
		}
		try {
			respond(req, res, response, logger);
		} catch (err) {
			dropResponse(response);
			req.destroy();
			process.nextTick(logger, err);
		}
	};
	
	invoke(handlers[0], request, function next(returned) {
		if (typeof returned === 'function') stack.push(returned);
		else if (returned != null) return unwind(returned); // A response was returned (or thrown)
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
	else Promise.resolve(returned).then(cb, cb);
};

const newResponse = (value) => {
	if (Response.isResponse(value)) return value;
	try { return new Response(value); }
	catch (err) { return new Response(err); }
};

const dropResponse = (response) => {
	if (River.isRiver(response.body)) response.body.drop();
};

const noop = () => {};
Object.setPrototypeOf(Route.prototype, Function.prototype);
module.exports = Route;
