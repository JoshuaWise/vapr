'use strict';
const { STATUS_CODES } = require('http');
const shared = require('./shared');

class Response {
	constructor(code, body, headers) {
		if (typeof code !== 'number')  throw new TypeError('Expected status code to be a number');
		if (!STATUS_CODES.hasOwnProperty(code)) throw new RangeError(`Unrecognized status code: ${code}`);
		if (code < 200 || code > 399) throw new RangeError('Success codes must be within 200-399');
		if (headers != null && typeof headers !== 'object') throw new TypeError('Expected headers to be an object or null');
		this[shared.code] = code;
		this[shared.body] = body;
		this[shared.headers] = headers;
		return Object.freeze(Object.create(this));
	}
}

module.exports = Response;

/*
	TODO:
	responses to HEAD methods, or when the response status code is 1xx, 204, or
	304, do not include a body.
	
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
