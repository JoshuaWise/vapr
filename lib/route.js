'use strict';
const Promise = require('wise-promise');
const Request = require('./request');
const locate = require('./locate');
const shared = require('./shared');
const instance = Symbol();

class Route {
	constructor(handler) {
		// TODO
		this[instance] = this; // Provides write access for the returned function
		return Object.setPrototypeOf(makeHandler(this, handler), this);
	}
}

const makeHandler = (route, handler) => (req, res) => {
	const location = locate(req);
	if (!location) return void req.destroy();
	toAsync(handler, new Request(req, location))
		.then(({ [shared.code]: code, [shared.body]: body, [shared.headers]: headers }) => {
			if (code === undefined) throw new TypeError('Route handlers must return req.response() objects');
			if (code === 204 || code === 304 || req.method === 'HEAD') body = undefined;
			// TODO
		})
		.catch((err) => {
			// TODO
		});
};

const toAsync = (fn, arg) => { try { return Promise.resolve(fn(arg)); } catch (err) { return Promise.reject(err); } };
Object.setPrototypeOf(Route.prototype, Function.prototype);
module.exports = Route;

/*
	TODO:
	responses cannot include the Transfer-Encoding header if the response status
	code is 1xx or 204.
	
	if the response Content-Length header is set, the response must be sent in a
	single chunk, and that chucnk's byte length must match Content-Length
	(https://tools.ietf.org/html/rfc7230#section-3.3.3)
	
	TE: https://tools.ietf.org/html/rfc7230#section-4.3
	Via: https://tools.ietf.org/html/rfc7230#section-5.7.1
	Accept, Expect: https://tools.ietf.org/html/rfc7231
	If-: https://tools.ietf.org/html/rfc7232
	Range, If-Range: https://tools.ietf.org/html/rfc7233
	Caching: https://tools.ietf.org/html/rfc7234
	Authentication: https://tools.ietf.org/html/rfc7235
 */
