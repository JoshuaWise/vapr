'use strict';
const Promise = require('wise-promise');
const Response = require('./response');
const Request = require('./request');
const locate = require('./locate');
// const shared = require('./shared');
const hidden = Symbol();

class Route {
	constructor(handler) {
		this[hidden] = { onError: internalServerError };
		return Object.setPrototypeOf(makeHandler(this[hidden], handler), this);
	}
	onError(handler) {
		if (typeof handler !== 'function') throw new TypeError('Expected onError handler to be a function');
		this[hidden].onError = handler;
		return this;
	}
}

const makeHandler = (route, handler) => (req, res) => {
	const location = locate(req);
	if (!location) return void req.destroy();
	const respond = (value) => {
		// TODO
		if (Response.isResponse(value)) {
			
		}
		if (!(value instanceof Error)) value = new TypeError('Route handlers must return Response objects');
		return void toAsync(route.onError, value).then(respond, respond);
	};
	toAsync(handler, new Request(req, location)).then(respond, respond);
};

const toAsync = (fn, arg) => { try { return Promise.resolve(fn(arg)); } catch (err) { return Promise.reject(err); } };
const internalServerError = req => req.respond(500);
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
