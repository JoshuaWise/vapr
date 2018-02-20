'use strict';
const Promise = require('wise-promise');
const Request = require('./request');
const response = require('./response');
const locate = require('./locate');
const settings = Symbol();
const handler = Symbol();

class Route {
	constructor(fn) {
		if (typeof fn !== 'function') throw new TypeError('Expected route handler to be a function');
		this[handler] = fn[handler] || fn;
		this[settings] = { before: [], after: [], catch: undefined, inherits: fn[settings] };
		return Object.setPrototypeOf(makeHandler(this[handler], this[settings]), this);
	}
	unexpectedError(handler) {
		if (typeof handler !== 'function') throw new TypeError('Expected unexpectedError() handler to be a function');
		if (this[settings].catch) throw new TypeError('An unexpectedError() handler was already set on this route');
		this[settings].catch = handler;
		return this;
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

const makeHandler = (handler, settings) => (req, res) => {
	const location = locate(req);
	if (!location) return void req.destroy();
	const request = new Request(req, location);
	let currentResponse;
	let failHard = false;
	let expectResponse = false;
	let middleware = settings.before;
	let index = 0;
	(function trampoline(prev) {
		let fn;
		delegation: {
			pipeline: {
				if (prev == null) {
					if (expectResponse) {
						currentResponse = new TypeError('Expected route handler to return a response');
						break pipeline;
					}
				} else {
					if (!currentResponse) {
						middleware = settings.after;
						index *= 0;
						expectResponse = false;
					}
					currentResponse = response(prev);
					if (currentResponse.error) {
						currentResponse = currentResponse.error;
						break pipeline;
					}
				}
				if (index < middleware.length) {
					fn = middleware[index];
					index += 1;
				} else if (!currentResponse) {
					fn = handler;
					expectResponse = true;
				} else {
					const { code, message, headers, body, trailers } = currentResponse;
					// TODO: writeHead, conditionally write body, allow different body formats, validate/sanitize headers
					// TODO: make sure this can't throw
					res.writeHead(code, message, headers);
					res.end();
					return;
				}
				break delegation;
			}
			if (failHard) {
				const error = currentResponse;
				process.nextTick(() => { throw error; });
				req.destroy();
				return;
			} else {
				failHard = true;
				expectResponse = true;
				index = NaN;
				fn = settings.catch;
			}
		}
		let result;
		let isPromise;
		try {
			result = fn(request, currentResponse);
			isPromise = Promise.isPromise(result);
		} catch (err) {
			result = err;
			isPromise = false;
		}
		if (!isPromise) trampoline(result);
		else Promise.resolve(result).then(trampoline, trampoline);
	}(undefined));
};

const defaultCatchHandler = () => 500;
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
