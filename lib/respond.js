'use strict';
const River = require('wise-river');

/*
	This is how we actually respond to a request, given a Response object.
 */

/*
	TODO: make sure this can't throw
	TODO: res.writeHead can throw if message or headers are invalid
	TODO: res.addTrailers can throw if the trailers are invalid
	TODO: remove any logic here that is already covered by nodejs in a predictable way
 */

module.exports = (req, res, { code, message, headers, body, trailers }, reporter) => {
	const legacy = req.httpVersionMajor !== 1 || req.httpVersionMinor === 0;
	headers = toObject(headers);
	trailers = legacy || trailers.size === 0 ? undefined : toObject(trailers);
	
	if (headers['date'] !== undefined) {
		normalizeDate(headers);
	}
	if (headers['connection'] !== undefined && headers['connection'] !== 'close') {
		normalizeConnection(headers, legacy);
	}
	
	if (code === 204 || code === 304) {
		if (headers['content-length'] !== undefined) delete headers['content-length'];
		if (headers['transfer-encoding'] !== undefined) delete headers['transfer-encoding'];
		if (headers['trailer'] !== undefined) delete headers['trailer'];
		if (River.isRiver(body)) body.pump(noop)(); // Drop the unused response stream
		respondSync(res, code, message, headers);
		return;
	}
	
	// TODO: because this happens before te is normalized, it is not an accurate 1-to-1 with GET methods
	// TODO: we could also normalize content-length here too
	if (req.method === 'HEAD') {
		if (legacy) {
			if (headers['trailer'] !== undefined) delete headers['trailer'];
			if (headers['transfer-encoding'] !== undefined) delete headers['transfer-encoding'];
		} else if (headers['transfer-encoding'] !== undefined && headers['content-length'] !== undefined) {
			delete headers['transfer-encoding'];
		}
		if (River.isRiver(body)) body.pump(noop)(); // Drop the unused response stream
		respondSync(res, code, message, headers);
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
			respondAsync(res, code, message, headers, body, trailers);
		} else {
			if (headers['trailer'] !== undefined) delete headers['trailer'];
			if (headers['transfer-encoding'] !== undefined) delete headers['transfer-encoding'];
			headers['content-length'] = body ? '' + body.length : '0';
			respondSync(res, code, message, headers, body);
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
		respondAsync(res, code, message, headers, body);
	} else {
		if (headers['transfer-encoding'] !== undefined) delete headers['transfer-encoding'];
		headers['content-length'] = body ? '' + body.length : '0';
		respondSync(res, code, message, headers, body);
	}
};

// TODO: handle errors
const respondSync = (res, code, message, headers, body) => {
	res.writeHead(code, message, headers);
	res.end(body);
};

// TODO: handle errors
const respondAsync = (res, code, message, headers, body, trailers) => {
	res.writeHead(code, message, headers);
	body.pump((chunk) => {
		if (Buffer.isBuffer(chunk)) res.write(chunk);
		else if (chunk != null) throw new TypeError('Expected response river body to emit only buffers');
	});
	if (trailers) {
		body.then(() => Promise.props(trailers)).then((trailers) => {
			for (const value of Object.values(trailers)) {
				if (typeof value !== 'string') throw new TypeError('Expected response trailer value to be a string');
			}
			res.addTrailers(trailers);
			res.end();
		});
	} else {
		body.then(() => res.end());
	}
};

const normalizeTransferEncoding = (te) => {
	if (!te) return '';
	const encodings = te
		.split(',')
		.map(s => s.trim().toLowerCase())
		.filter(s => s)
		.reverse();
	const index = encodings.findIndex(s => s !== 'chunked');
	if (index === -1) return '';
	encodings.reverse().splice(0 - index, index);
	return encodings.join(',');
};

const normalizeDate = (headers) => {
	const date = new Date(headers['date']);
	if (!Number.isNaN(+date)) headers['date'] = date.toGMTString();
	else delete headers['date'];
};

const normalizeConnection = (headers, legacy) => {
	const allowedOptions = legacy ? new Empty : headers;
	const connection = headers['connection']
		.split(',')
		.map(s => s.trim().toLowerCase())
		.filter(s => s && (s === 'close' || allowedOptions[s] !== undefined))
		.join(',');
	if (connection) headers['connection'] = connection;
	else delete headers['connection'];
};

const toObject = (map) => {
	const obj = new Empty;
	for (const [key, value] of map.entries()) obj[key] = value;
	return obj;
};

const noop = () => {};
const Empty = function Object() {}
Object.setPrototypeOf(Empty, Object.create(null));

/*
	Headers owned:
	- transfer-encoding (considered, but ensures validity unless HEAD)
	- content-length (completely overwritten, unless HEAD)
	- trailer (completely overwritten, unless HEAD)
	- date (considered, but ensures validity)
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
