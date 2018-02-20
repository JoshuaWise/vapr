'use strict';
const Promise = require('wise-promise');
const Request = require('./request');
const response = require('./response');
const locate = require('./locate');
const settings = Symbol();

class Route {
	constructor(fn, catcher) {
		if (typeof fn !== 'function') throw new TypeError('Expected route handler to be a function');
		if (catcher != null && typeof catcher !== 'function') throw new TypeError('Expected route error handler to be a function');
		if (!catcher) catcher = fn[settings] ? fn[settings].catcher : defaultCatchHandler;
		const handler = fn[settings] ? fn[settings].handler : fn;
		this[settings] = { handler, catcher, before: [], after: [], inherits: fn[settings] };
		const before = flattenInheritance(this[settings], 'before', 'unshift');
		const after = flattenInheritance(this[settings], 'after', 'push');
		return Object.setPrototypeOf(makeHandler(before, after, handler, catcher), this);
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

const flattenInheritance = (settings, key, method) => {
	if (!settings) return [];
	const ret = flattenInheritance(settings.inherits, key, method);
	ret[method](settings[key]);
	return ret;
};

const makeHandler = (before, after, handler, catcher) => (req, res) => {
	const location = locate(req);
	if (!location) return void req.destroy();
	const request = new Request(req, location);
	let currentResponse;
	let failHard = false;
	let expectResponse = false;
	let middleware = before; // TODO: before is now an array of arrays
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
						middleware = after; // TODO: after is now an array of arrays
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
				fn = catcher;
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
