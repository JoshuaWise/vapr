'use strict';
const River = require('wise-river');
const Promise = require('wise-promise');

/*
	This is how we actually respond to a request, given a Response object.
 */

/*
	TODO: make sure this can't throw
	TODO: res.writeHead can throw if message or headers are invalid
	TODO: res.addTrailers can throw if the trailers are invalid
	TODO: remove any logic here that is already covered by nodejs in a predictable way
 */

module.exports = (req, res, { code, message, headers, body, trailers }) => {
	const legacy = req.httpVersionMajor !== 1 || req.httpVersionMinor === 0;
	headers = toObject(headers);
	trailers = legacy || trailers.size === 0 ? undefined : toObject(trailers);
	
	if (headers['date'] !== undefined) {
		delete headers['date'];
	}
	if (headers['connection'] !== undefined && headers['connection'] !== 'close') {
		delete headers['connection'];
	}
	
	if (code === 204 || code === 304) {
		if (headers['content-length'] !== undefined) delete headers['content-length'];
		if (headers['transfer-encoding'] !== undefined) delete headers['transfer-encoding'];
		if (headers['trailer'] !== undefined) delete headers['trailer'];
		if (River.isRiver(body)) body.pump(noop)(); // Drop the unused response stream
		respond(req, res, code, message, headers);
		return;
	}
	
	if (req.method === 'HEAD') {
		if (legacy) {
			if (headers['trailer'] !== undefined) delete headers['trailer'];
			if (headers['transfer-encoding'] !== undefined) delete headers['transfer-encoding'];
		} else if (headers['transfer-encoding'] !== undefined && headers['content-length'] !== undefined) {
			delete headers['transfer-encoding'];
		}
		if (River.isRiver(body)) body.pump(noop)(); // Drop the unused response stream
		respond(req, res, code, message, headers);
		return;
	}
	
	const te = normalizeTransferEncoding(headers['transfer-encoding']);
	if ((trailers || te) && !River.isRiver(body)) {
		body = River.one(body);
	}
	
	if (!legacy) {
		if (River.isRiver(body)) {
			if (headers['content-length'] !== undefined) delete headers['content-length'];
			if (trailers) headers['trailer'] = Object.keys(trailers).join(',');
			else if (headers['trailer'] !== undefined) delete headers['trailer'];
			headers['transfer-encoding'] = te ? te + ',chunked' : 'chunked';
			respond(req, res, code, message, headers, body, trailers); // always a river, may have trailers, has all headers
		} else {
			if (headers['trailer'] !== undefined) delete headers['trailer'];
			if (headers['transfer-encoding'] !== undefined) delete headers['transfer-encoding'];
			respond(req, res, code, message, headers, body); // never a river, needs content-length header
		}
		return;
	}
	
	if (headers['trailer'] !== undefined) {
		delete headers['trailer'];
	}
	
	if (River.isRiver(body)) {
		if (headers['content-length'] !== undefined) delete headers['content-length'];
		if (te) headers['transfer-encoding'] = te;
		else if (headers['transfer-encoding'] !== undefined) delete headers['transfer-encoding'];
		headers['connection'] = 'close';
		respond(req, res, code, message, headers, body); // always a river, has all headers
	} else {
		if (headers['transfer-encoding'] !== undefined) delete headers['transfer-encoding'];
		respond(req, res, code, message, headers, body); // never a river, needs content-length header
	}
	
	// res.writeHead(code, message, toObject(headers));
	// if (!chunked) {
	// 	res.end(body);
	// } else {
	// 	trailers = trailers.size ? toObject(trailers) : undefined;
	// 	if (River.isRiver(body)) handleRiver(res, body, trailers);
	// 	else handlePromise(res, Promise.resolve(body), trailers);
	// }
};

const normalizeTransferEncoding = (te) => {
	if (!te) return '';
	const encodings = te.split(',').map(s => s.trim()).filter(s => s).reverse();
	const index = encodings.findIndex(s => s !== 'chunked');
	if (index === -1) return '';
	encodings.reverse().splice(0 - index, index);
	return encodings.join(',');
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
