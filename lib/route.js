'use strict';
const Promise = require('wise-promise');
const Request = require('./request');
const response = require('./response');
const locate = require('./locate');
const shared = require('./shared');
const settings = Symbol();
const handler = Symbol();

class Route {
	constructor(...args) {
		if (!args.length) throw new TypeError('Expected a route implementation function');
		if (args.some(arg => typeof arg !== 'function')) throw new TypeError('Invalid arguments passed to Route constructor');
		this[settings] = args.reduce((o, a) => Object.assign(o, a[settings]), { ...defaultSettings });
		this[handler] = args[args.length - 1][handler] || args[args.length - 1];
		return Object.setPrototypeOf(makeHandler(this[settings], this[handler]), this);
	}
	unexpectedError(handler) {
		if (typeof handler !== 'function') throw new TypeError('Expected unexpectedError handler to be a function');
		// TODO: solidify API behavior (defining duplicates, etc)
		this[settings].onError = handler;
		return this;
	}
	// parse([mime, parser]) // TODO: for handling content-type in request.body()
	// before(handler) // TODO: for connect-style middleware, either modifying request.meta or responding/erroring early
	// after(handler) // TODO: for modifying a response object before sending it out
}

const makeHandler = (route, handler) => (req, res) => {
	const location = locate(req);
	if (!location) return void req.destroy();
	const request = new Request(req, location);
	const interpretResult = (value) => {
		if (Array.isArray(value)) {
			try {
				return respond(response(value), route);
			} catch (err) {
				value = err;
			}
		}
		if (!(value instanceof Error)) value = new TypeError('Expected route handler to return an array or error');
		(0, route.onError)(request, value);
		// TODO
	};
	try {
		Promise.resolve(handler(request)).then(interpretResult, interpretResult);
	} catch (err) {
		interpretResult(err);
	}
	// TODO
	// 		const { code, message, headers, body, trailers } = response(value);
	// 		// TODO: writeHead, conditionally write body, allow different body formats, validate/sanitize headers
	// 		res.writeHead(code, message, headers);
	// 		res.end();
};

const defaultSettings = { onError: req => req.respond(500) };
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
