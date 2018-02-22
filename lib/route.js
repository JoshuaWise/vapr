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
		if (!catcher) catcher = handler[settings] ? handler[settings].catcher : defaultCatcher;
		const before = [];
		const after = [];
		const beforeHandler = makeBeforeHandler(before, handler[settings] ? handler[settings].beforeHandler : handler);
		const afterHandlers = [makeAfterHandler(after)];
		if (handler[settings]) afterHandlers.unshift(...handler[settings].afterHandlers);
		this[settings] = { before, after, beforeHandler, afterHandlers, catcher };
		return Object.setPrototypeOf(makeHandler(beforeHandler, afterHandlers, catcher), this);
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
}

const makeHandler = (beforeHandler, afterHandlers, catcher) => (req, res) => {
	const location = locate(req);
	if (!location) return void req.destroy();
	const request = new Request(req, location);
	let state = 0;
	invoke1(beforeHandler, request, function route(response) {
		if (state !== 1) {
			if (response == null) response = new TypeError('Expected route handler to return a response');
			response = new Response(response);
		}
		if (response.error) {
			if (state < 2) {
				state = 2;
				invoke2(catcher, request, response.error, route);
			} else {
				process.nextTick(() => { throw response.error; });
				req.destroy();
			}
			return;
		}
		if (state === 0) {
			state = 1;
			invoke4(afterHandlers[0], request, response, afterHandlers, 1, route);
			return;
		}
		// TODO: writeHead, conditionally write body, allow different body formats, validate/sanitize headers
		// TODO: make sure this can't throw
		const { code, message, headers, body, trailers } = response;
		res.writeHead(code, message, headers);
		res.end();
	});
};

const makeBeforeHandler = (middleware, child) => (request) => {
	let index = 0;
	return (function next(returned) {
		if (returned != null) return returned;
		if (index < middleware.length) return invoke1(middleware[index++], request, next);
		return invoke1(child, request);
	}());
};

const makeAfterHandler = (middleware) => (request, response, parents, parentIndex) => {
	let index = 0;
	return (function next(returned) {
		if (returned != null) {
			response = new Response(returned);
			if (response.error) return response;
		}
		if (index < middleware.length) return invoke2(middleware[index++], request, response, next);
		if (parentIndex < parents.length) return invoke4(parents[parentIndex], request, response, parents, parentIndex + 1);
		return response;
	}());
};

const code = (function invokeMiddleware(fn, __, cb) {
	let returned, sync;
	try {
		returned = fn(__);
		sync = !Promise.isPromise(returned);
	} catch (err) {
		return cb ? cb(err) : err;
	}
	if (sync) return cb ? cb(returned) : returned;
	return cb ? Promise.resolve(returned).then(cb, cb) : Promise.resolve(returned);
}).toString();
const invoke1 = new Function(`return ${code.replace(/__/g, 'x')}`)(Promise);
const invoke2 = new Function(`return ${code.replace(/__/g, 'x1, x2')}`)(Promise);
const invoke4 = new Function(`return ${code.replace(/__/g, 'x1, x2, x3, x4')}`)(Promise);

const defaultCatcher = () => 500;
Object.setPrototypeOf(Route.prototype, Function.prototype);
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
