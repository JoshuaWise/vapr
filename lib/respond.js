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
	3) if http version < 1.1:
		if the body is being chunked or if transfer-encoding is truthy:
			- reject the request
		else:
			- delete transfer-encoding
			- delete trailer
	4) if 204 or 304:
			- delete transfer-encoding
			- delete content-length
			- delete trailer
		else if HEAD:
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
	if (code === 204 || code === 304 || req.method === 'HEAD') {
		if (River.isRiver(body)) body.pump(noop)(); // Drop the unused response stream
		body = undefined;
		trailers.clear();
	}
	const chunked = River.isRiver(body) || trailers.size !== 0;
	
	
	
	
	
	// if (code === 204 || code === 304 || req.method === 'HEAD') {
	// 	// TODO: should we cancel the response river (if one exists) here?
	// 	body = undefined;
	// }
	// const chunked = trailers.size !== 0 || River.isRiver(body); // TODO: include version logic
	// {
	// 	const connection = mapGet.call(headers, 'connection');
	// 	if (connection !== undefined && connection !== 'close') {
	// 		mapDelete.call(headers, 'connection');
	// 	}
	// 	if (chunked) {
	// 		const te = mapGet.call(headers, 'transfer-encoding');
	// 		mapSet.call(headers, 'transfer-encoding', te ? te + ',chunked' : 'chunked');
	// 		mapDelete.call(headers, 'content-length');
	// 	} else {
	// 		// TODO: don't always include this header (depends on situation)
	// 		mapSet.call(headers, 'content-length', body ? '' + body.length : '0');
	// 	}
	// 	if (trailers.size) {
	// 		mapSet.call(headers, 'trailer', Array.from(trailers.keys()).join(','));
	// 	} else {
	// 		mapDelete.call(headers, 'trailer');
	// 	}
	// 	mapDelete.call(headers, 'date');
	// }
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
const { get: mapGet, set: mapSet, delete: mapDelete } = Map.prototype;

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
