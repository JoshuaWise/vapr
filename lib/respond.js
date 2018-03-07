'use strict';
const River = require('wise-river');
// const Promise = require('wise-promise');

/*
	This is how we actually respond to a request, given a Response object.
 */

/*
	TODO:
	1) determine if the body should be chunked (River or trailers)
	2) determine finalized headers
	3) res.writeHead(code, message, headers);
	4) send body if it exists and if appropriate (see comments at bottom of page)
	5) if trailers exist, send them at the end of the body (object[name:promise])
	6) res.end();
	Valid body types:
	- null / undefined - content-length or nothing, depending on situation
	- buffer: Buffer.isBuffer() - content-length or nothing, depending on the situation and buffer.length === 0
	- river<buffer|null|undefined>: River.isRiver() - chunked
	- promise<buffer|null|undefined>: Promise.isPromise() - chunked, same as River.one()
	NOTE: make sure this can't throw
 */

module.exports = (res, { code, message, headers, body, trailers }, isHead) => {
	headers = Object.assign(new Empty, headers);
	if (code === 204 || code === 304 || isHead) {
		if (River.isRiver(body)) body.pump(() => {})();
		if (headers['transfer-encoding']) removeChunked(headers); // TODO: normalize header case
		headers['content-length'] = undefined; // TODO: normalize header case
		body = undefined;
		trailers = {};
	} else if (body == null || Buffer.isBuffer(body)) {
		if (isEmpty(trailers)) {
			headers['content-length'] = body ? '' + body.length : '0'; // TODO: normalize header case
			if (headers['transfer-encoding']) removeChunked(headers); // TODO: normalize header case
		} else {
			headers['content-length'] = undefined; // TODO: normalize header case
			addChunked(headers);
		}
	} else {
		// promise/river chunked
	}
	res.writeHead(code, message, headers);
	res.end();
};

const Empty = function Object() {};
Object.setPrototypeOf(Empty.prototype, null);

/*
	TODO:
	responses to HEAD requests and responses with a 204 or 304 status code
	cannot include a body.
	
	responses cannot include the Transfer-Encoding header if the response status
	code is 204.
	
	if the response Content-Length header is set, the response must be sent in a
	single chunk, and that chunk's byte length must match Content-Length.
	(https://tools.ietf.org/html/rfc7230#section-3.3.3)
	
	Transfer-Encoding: https://tools.ietf.org/html/rfc7230#section-3.3.1
	Trailer: https://tools.ietf.org/html/rfc7230#section-4.4
	TE: https://tools.ietf.org/html/rfc7230#section-4.3
	Via: https://tools.ietf.org/html/rfc7230#section-5.7.1
	
	Server: https://tools.ietf.org/html/rfc7230#section-2.1
	Date: https://tools.ietf.org/html/rfc7231#section-7.1
	Content-Encoding, Content-Type, Content-Language, Content-Location: https://tools.ietf.org/html/rfc7231#section-3.1
	Accept, Expect: https://tools.ietf.org/html/rfc7231
	If-: https://tools.ietf.org/html/rfc7232
	Range, If-Range: https://tools.ietf.org/html/rfc7233
	Caching: https://tools.ietf.org/html/rfc7234
	Authentication: https://tools.ietf.org/html/rfc7235
 */
