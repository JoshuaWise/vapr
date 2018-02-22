'use strict';
const Promise = require('wise-promise');
const Request = require('./request');
const Response = require('./response');
const locate = require('./locate');
const settings = Symbol();

class Route {
	constructor(handler, catcher) {
		// TODO: fix and cleanup
		if (typeof handler !== 'function') throw new TypeError('Expected route handler to be a function');
		if (catcher != null && typeof catcher !== 'function') throw new TypeError('Expected route error handler to be a function');
		if (!catcher) catcher = handler[settings] ? handler[settings].catcher : defaultCatcher;
		const childBeforeHandler = handler[settings].beforeHandler;
		const childAfterHandler = handler[settings].afterHandler;
		const before = [];
		const after = [];
		const child = makeChild(before, after, handler, catcher);
		this[settings] = { before, after, child, catcher };
		return Object.setPrototypeOf(makeHandler(child), this);
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

const makeHandler = (beforeHandler, afterHandler, catcher) => (req, res) => {
	const location = locate(req);
	if (!location) return void req.destroy();
	const request = new Request(req, location);

	// TODO
	// const given = await beforeHandler(request);
	// if (given == null) return new Response(new TypeError('Expected route handler to return a response'));
	// const response = new Response(given);
	// if (response.error) return response;
	// return await afterHandler(request, response);



	// TODO
	// if (response.error) {
	// 	process.nextTick(() => { throw response.error; });
	// 	req.destroy();
	// 	return;
	// }
	// // TODO: writeHead, conditionally write body, allow different body formats, validate/sanitize headers
	// // TODO: make sure this can't throw
	// const { code, message, headers, body, trailers } = response;
	// res.writeHead(code, message, headers);
	// res.end();
};

const makeBeforeHandler = (middleware, handler) => (request) => {
	let index = 0;
	return (function next(returned) {
		let fn, sync;
		if (returned != null) return returned;
		if (index < middleware.length) {
			fn = middleware[index];
			index += 1;
		} else {
			fn = handler;
			next = identity;
		}
		try {
			returned = fn(request);
			sync = !Promise.isPromise(returned);
		} catch (err) {
			return next(err);
		}
		if (sync) return next(returned);
		return Promise.resolve(returned).then(next, next); // TODO: .then() is overhead when next === identity
	}());
};

const makeAfterHandler = (middleware, child) => (request, response) => {
	// TODO
	// if (child) {
	// 	response = await child(request, response);
	// 	if (response.error) return response;
	// }
	let index = 0;
	return (function next(returned) {
		let fn, sync;
		if (returned != null) {
			response = new Response(returned);
			if (response.error) return response;
		}
		if (index < middleware.length) {
			fn = middleware[index];
			index += 1;
		} else {
			return response;
		}
		try {
			returned = fn(request, response);
			sync = !Promise.isPromise(returned);
		} catch (err) {
			return next(err);
		}
		if (sync) return next(returned);
		return Promise.resolve(returned).then(next, next);
	}());
};

const identity = x => x;
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
