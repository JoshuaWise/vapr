'use strict';
const River = require('wise-river');
const Promise = require('wise-promise');

/*
	This is how we actually respond to a request, given a Response object.
 */

/*
	TODO:
	1) if 204, 304, or HEAD: drop the body and trailers
	2) determine if the body should be chunked (River or trailers)
			- maybe require a River body when using trailers
	3) if http version < 1.1:
			- set chunked to false
			- delete transfer-encoding
			- delete trailer
			- drop trailers
	4) if 204 or 304:
			- delete transfer-encoding
			- delete content-length
			- delete trailer
		else if HEAD:
			possibly add content-length, transfer-encoding, and/or trailer, based on discarded body
			if both transfer-encoding and content-length exist:
				- delete transfer-encoding
		else:
			while transfer-encoding ends with "chunked":
				- remove it from the list of encodings
			if the body is being chunked:
				- add "chunked" to the list of encodings in transfer-encoding
				- delete content-length
				- set trailer to the appropriate value, or delete trailer
			else if transfer-encoding is not empty:
				- set "connection: close" (https://tools.ietf.org/html/rfc7230#section-3.3.1)
				- delete content-length (https://tools.ietf.org/html/rfc7230#section-3.3.2)
				- delete trailer
			else:
				- delete transfer-encoding
				- delete trailer
				- set content-length to correct value (possibly 0, or an async value)
	5) if connection is not undefined or "close": delete connection
	6) delete date
	7) res.writeHead(code, message, headers);
	8) initiate body sending
		- body could be river, promise, buffer, or undefined
		- chunked non-river bodies can just be cast to rivers
		- non-chunked promise bodies should behave like non-chunked buffer/undefined bodies
	NOTE: make sure this can't throw
	NOTE: res.writeHead can throw if message or headers are invalid
	NOTE: res.addTrailers can throw if the trailers are invalid
	TODO: remove any logic here that is already covered by nodejs in a predictable way
 */

module.exports = (req, res, { code, message, headers, body, trailers }) => {
	const allowHints = req.method === 'HEAD';
	const noBodyHeaders = code === 204 || code === 304;
	const noBody = noBodyHeaders || allowHints;
	const legacy = req.httpVersionMajor !== 1 || req.httpVersionMinor === 0;
	const hasTrailers = trailers.size !== 0;
	const streaming = !noBody && (River.isRiver(body) || !legacy && hasTrailers && (body = River.one(body), true));
	const chunked = streaming && !legacy;
	
	headers = toObject(headers);
	trailers = toObject(trailers);
	
	if (noBody) {
		if (River.isRiver(body)) body.pump(noop)(); // Drop the unused response stream
		body = undefined;
	}
	
	if (allowHints && headers['content-length'] !== undefined && headers['transfer-encoding'] !== undefined) {
		delete headers['transfer-encoding'];
	} else if (headers['transfer-encoding'] !== undefined) {
		const encodings = headers['transfer-encoding'].split(',').map(s => s.trim()).filter(Boolean).reverse();
		const index = encodings.findIndex(s => s !== 'chunked');
		if (index === -1) {
			if (chunked) headers['transfer-encoding'] = 'chunked';
			else delete headers['transfer-encoding'];
		} else if (legacy) {
			// TODO: custom transfer-encoding given but request was not http/1.1
		} else {
			encodings.splice(0, index).reverse();
			if (chunked) encodings.push('chunked');
			else if (!noBody) headers['connection'] = 'close';
			headers['transfer-encoding'] = encodings.join(',');
		}
	} else if (chunked) {
		headers['transfer-encoding'] = 'chunked';
	}
	
	if (chunked) {
		if (hasTrailers) headers['trailer'] = Array.from(trailers.keys()).join(',');
		else delete headers['trailer'];
	} else if (legacy || !allowHints) {
		delete headers['trailer'];
	}
	
	if (headers['connection'] !== undefined && headers['connection'] !== 'close') {
		delete headers['connection'];
	}
	
	delete headers['data'];




	// res.writeHead(code, message, toObject(headers));
	// if (!chunked) {
	// 	res.end(body);
	// } else {
	// 	trailers = trailers.size ? toObject(trailers) : undefined;
	// 	if (River.isRiver(body)) handleRiver(res, body, trailers);
	// 	else handlePromise(res, Promise.resolve(body), trailers);
	// }
};

const toObject = (map) => {
	const obj = {};
	for (const [key, value] of map.entries()) obj[key] = value;
	return obj;
};

const noop = () => {};

/*
	Headers owned:
	- transfer-encoding (considered, but ensures validity unless HEAD)
	- content-length (completely overwritten, unless HEAD)
	- trailer (completely overwritten, unless HEAD)
	- date (completely overwritten)
	- connection (considered, but ensures validity)
 */

/*
	TODO:
	TE: https://tools.ietf.org/html/rfc7230#section-4.3
	Via: https://tools.ietf.org/html/rfc7230#section-5.7.1
	
	Server: https://tools.ietf.org/html/rfc7230#section-2.1
	Content-Encoding, Content-Type, Content-Language, Content-Location: https://tools.ietf.org/html/rfc7231#section-3.1
	Accept, Expect: https://tools.ietf.org/html/rfc7231
	If-: https://tools.ietf.org/html/rfc7232
	Range, If-Range: https://tools.ietf.org/html/rfc7233
	Caching: https://tools.ietf.org/html/rfc7234
	Authentication: https://tools.ietf.org/html/rfc7235
 */
