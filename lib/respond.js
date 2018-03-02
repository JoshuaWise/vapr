'use strict';

/*
	This is how we actually respond to a request, given a Response object.
 */

/*
	TODO:
	1) determine finalized headers
	2) res.writeHead(code, message, headers);
	3) determine if the body should be chunked (River or trailers)
	4) send body if it exists and if appropriate (see comments at bottom of page)
	5) if trailers exist, send them at the end of the body (object[name:promise])
	6) res.end();
	Valid body types:
	- null / undefined
	- string
	- buffer: Buffer.isBuffer(), ArrayBuffer.isView()
	- river<any synchronous>: River.isRiver()
	- promise<any synchronous>: Promise.isPromise()
	- arraybuffer: instanceof ArrayBuffer
	NOTE: make sure this can't throw
 */

module.exports = (res, { code, message, headers, body, trailers }) => {
	res.writeHead(code, message, headers);
	res.end();
};

/*
	TODO:
	responses to HEAD requests and responses with a 204 or 304 status code
	cannot include a body.
	
	responses cannot include the Transfer-Encoding header if the response status
	code is 1xx or 204.
	
	if the response Content-Length header is set, the response must be sent in a
	single chunk, and that chunk's byte length must match Content-Length.
	(https://tools.ietf.org/html/rfc7230#section-3.3.3)
	
	Content-Encoding: https://tools.ietf.org/html/rfc7231#section-3.1
	Content-Transfer-Encoding: https://tools.ietf.org/html/rfc2045#section-6
	Transfer-Encoding: https://tools.ietf.org/html/rfc7230#section-3.3.1
	Trailer: https://tools.ietf.org/html/rfc7230#section-4.4
	TE: https://tools.ietf.org/html/rfc7230#section-4.3
	Via: https://tools.ietf.org/html/rfc7230#section-5.7.1
	
	Date, Server: https://tools.ietf.org/html/rfc7230#section-2.1
	Accept, Expect: https://tools.ietf.org/html/rfc7231
	If-: https://tools.ietf.org/html/rfc7232
	Range, If-Range: https://tools.ietf.org/html/rfc7233
	Caching: https://tools.ietf.org/html/rfc7234
	Authentication: https://tools.ietf.org/html/rfc7235
 */
