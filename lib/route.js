'use strict';
const Promise = require('wise-promise');
const Request = require('./request');
const Response = require('./response');
const locate = require('./locate');
const settings = Symbol();

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
		// TODO: writeHead, conditionally write body, allow different body formats, validate/sanitize headers
		// TODO: make sure this can't throw
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
