'use strict';
const Promise = require('wise-promise');
const Request = require('./request');
const Response = require('./response');
const locate = require('./locate');
const shared = require('./shared');
const settings = Symbol();

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
		if (catcher != null && typeof catcher !== 'function') throw new TypeError('Expected route error handler to be a function');
		const parent = handler[settings] || Object.create(null);
		const before = [];
		const after = [];
		const beforeHandler = groupMiddleware(before)(parent.beforeHandler || handler);
		const afterHandler = (parent.afterHandler || build)(groupMiddleware(after));
		if (!catcher) catcher = parent.catcher || undefined;
		this[settings] = { before, after, beforeHandler, afterHandler, catcher };
		return Object.setPrototypeOf(makeHandler(beforeHandler, afterHandler(), catcher), this);
	}
	before(handler) {
		if (typeof handler !== 'function') throw new TypeError('Expected before() handler to be a function');
		this[settings].before.push(handler);
		return this;
	}
	after(handler) {
		if (typeof handler !== 'function') throw new TypeError('Expected after() handler to be a function');
		this[settings].after.push(handler);
		return this;
	}
	static get catch() {
		return defaultCatcher === passthrough ? undefined : defaultCatcher;
	}
	static set catch(catcher) {
		if (catcher != null && typeof catcher !== 'function') throw new TypeError('Expected default route error handler to be a function');
		defaultCatcher = catcher || passthrough;
	}
}

const makeHandler = (beforeHandler, afterHandler, catcher) => (req, res) => {
	const location = locate(req);
	if (!location) return void req.destroy();
	const request = new Request(req, location);
	let state = 0;
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
				process.nextTick(() => { throw response.error; });
				req.destroy();
			}
			return;
		}
		if (state === 0) {
			state = 1;
			invokeMiddleware(afterHandler, request, response, route);
			return;
		}
		if (request.aborted) {
			req.destroy();
			return;
		}
		request[shared.discardBody]();
		/*
			TODO:
			1) determine finalized headers
			2) res.writeHead(code, message, headers);
			3) determine if the body should be chunked (River or trailers)
			4) send body if it exists and if appropriate (see comments at bottom of page)
			5) if trailers exist, send them at the end of the body (object[name:promise])
			6) res.end();
			Valid body types:
			- null / undefined
			- string
			- buffer: Buffer.isBuffer(), ArrayBuffer.isView()
			- river<any synchronous>: River.isRiver()
			- promise<any synchronous>: Promise.isPromise()
			- arraybuffer: instanceof ArrayBuffer
			NOTE: make sure this can't throw
		 */
		const { code, message, headers, body, trailers } = response;
		res.writeHead(code, message, headers);
		res.end();
	});
};

const groupMiddleware = (middleware) => (parent) => (request, response) => {
	let index = 0;
	return (function next(returned) {
		if (returned != null && returned !== request) {
			if (response === undefined) return returned;
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
	if (sync) return cb(returned);
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
Object.setPrototypeOf(Route.prototype, Function.prototype);
let defaultCatcher = passthrough;
module.exports = Route;

/*
	TODO:
	responses to HEAD requests and responses with a 204 or 304 status code
	cannot include a body.
	
	responses cannot include the Transfer-Encoding header if the response status
	code is 1xx or 204.
	
	if the response Content-Length header is set, the response must be sent in a
	single chunk, and that chucnk's byte length must match Content-Length.
	(https://tools.ietf.org/html/rfc7230#section-3.3.3)
	
	TE: https://tools.ietf.org/html/rfc7230#section-4.3
	Via: https://tools.ietf.org/html/rfc7230#section-5.7.1
	Accept, Expect: https://tools.ietf.org/html/rfc7231
	If-: https://tools.ietf.org/html/rfc7232
	Range, If-Range: https://tools.ietf.org/html/rfc7233
	Caching: https://tools.ietf.org/html/rfc7234
	Authentication: https://tools.ietf.org/html/rfc7235
 */
