'use strict';
const River = require('wise-river');
const Promise = require('wise-promise');

/*
	This is how we actually respond to a request, given a Response object.
	TODO: clean up logic (throw more errors?)
	TODO: solidify streaming logic
 */

module.exports = (req, res, response, reporter) => {
	const head = req.method === 'HEAD';
	const legacy = req.httpVersionMajor !== 1 || req.httpVersionMinor === 0;
	const headers = toObject(response.headers);
	const { code, message } = response;
	let { body, trailers } = response;
	
	// Ensure that a valid date header is sent.
	if (headers['date'] !== undefined) {
		const date = new Date(headers['date']);
		if (!Number.isNaN(+date)) headers['date'] = date.toGMTString();
		else throw new TypeError(`Invalid date header: ${headers['date']}`);
	}
	
	// Ensure that a valid connection header is sent.
	if (headers['connection'] !== undefined && headers['connection'] !== 'close') {
		const connection = headers['connection']
			.split(',')
			.map(normalizeOption)
			.filter(filterConnectionOption, legacy ? noOptions : headers)
			.join(',');
		if (connection) headers['connection'] = connection;
		else delete headers['connection'];
	}
	
	// These types of responses do not have bodies.
	if (code === 204 || code === 304 || (head && legacy)) {
		if (headers['trailer'] !== undefined) delete headers['trailer'];
		if (headers['transfer-encoding'] !== undefined) delete headers['transfer-encoding'];
		if (headers['content-length'] !== undefined) {
			// Depending on the status code, a content-length can be sent here.
			if (code === 204 || code === 304 || !digits.test(headers['content-length'])) delete headers['content-length'];
		}
		if (River.isRiver(body)) body.pump(noop)(); // Drop the unused response stream
		res.writeHead(code, message, headers);
		res.end();
		return;
	}
	
	// Ensure that a valid transfer-encoding header is sent.
	let transferEncoding = '';
	if (headers['transfer-encoding'] !== undefined) {
		const encodings = headers['transfer-encoding']
			.split(',')
			.map(normalizeOption)
			.filter(identity)
			.reverse();
		let index = encodings.findIndex(notChunked);
		if (index !== -1) {
			const adjustment = head ? 1 : 0;
			encodings.reverse().splice(adjustment - index, index - adjustment);
			transferEncoding = encodings.join(',');
		} else if (head && encodings.length) {
			transferEncoding = 'chunked';
		} else {
			delete headers['transfer-encoding'];
		}
	}
	
	// In HTTP/1.1, responses to HEAD requests can include the trailer header
	// and the transfer-encoding header for hinting purposes.
	if (head) {
		if (headers['trailer'] !== undefined) {
			const trailer = headers['trailer']
				.split(',')
				.map(normalizeOption)
				.filter(identity)
				.join(',');
			if (trailer) headers['trailer'] = trailer;
			else delete headers['trailer'];
		}
		if (headers['content-length'] !== undefined) {
			if (!digits.test(headers['content-length'])) delete headers['content-length'];
		}
		if (transferEncoding) {
			if (headers['content-length'] !== undefined) delete headers['transfer-encoding'];
			else headers['transfer-encoding'] = transferEncoding;
		}
		if (River.isRiver(body)) body.pump(noop)(); // Drop the unused response stream
		res.writeHead(code, message, headers);
		res.end();
		return;
	}
	
	// If the body is not a river, and there is no transfer-encoding header, and
	// there are no trailers, the body can be sent without the chunked encoding.
	if (!River.isRiver(body)) {
		if ((!trailers.size || legacy) && !transferEncoding) {
			if (headers['trailer'] !== undefined) delete headers['trailer'];
			headers['content-length'] = body ? '' + body.length : '0';
			res.writeHead(code, message, headers);
			res.end(body);
			return;
		}
		body = River.one(body);
	}
	
	// In HTTP/1.0, streamed responses can only be performed by closing the
	// connection at the end of the response body.
	if (legacy) {
		if (headers['content-length'] !== undefined) delete headers['content-length'];
		if (transferEncoding) headers['transfer-encoding'] = transferEncoding;
		headers['connection'] = 'close';
		res.writeHead(code, message, headers);
		stream(res, body, undefined, reporter);
		return;
	}
	
	// Here we use the HTTP/1.1 chunked encoding to perform a streamed response.
	if (headers['content-length'] !== undefined) delete headers['content-length'];
	if (trailers.size) {
		trailers = toObject(trailers);
		headers['trailer'] = Object.keys(trailers).join(',');
	} else {
		trailers = undefined;
		if (headers['trailer'] !== undefined) delete headers['trailer'];
	}
	headers['transfer-encoding'] = transferEncoding ? transferEncoding + ',chunked' : 'chunked';
	res.writeHead(code, message, headers);
	stream(res, body, trailers, reporter);
	return;
};

const stream = (res, body, trailers, reporter) => {
	(trailers ? body.then(() => Promise.props(trailers)) : body).then((trailers) => {
		try {
			// TODO: validate that all trailer values are strings
			if (trailers) res.addTrailers(trailers);
			res.end();
		} catch (err) {
			if (reporter) process.nextTick(reporter, err);
			res.destroy();
		}
	}, (err) => {
		if (reporter) process.nextTick(reporter, err);
		res.destroy();
	});
	const cancel = body.pump((chunk) => {
		if (Buffer.isBuffer(chunk)) res.write(chunk);
		else if (chunk != null) throw new TypeError('Expected response body to be made of buffers');
	});
	// res.on('close', () => {
	// 	cancel();
	// 	if (reporter) process.nextTick(reporter, new Error('The request was aborted'));
	// });;
};

const toObject = (map) => {
	const obj = new Empty;
	for (const [key, value] of map.entries()) obj[key] = value;
	return obj;
};

const filterConnectionOption = function (option) {
	return option && (option === 'close' || this[option] !== undefined);
};

const Empty = function Object() {}
Object.setPrototypeOf(Empty, Object.create(null));
const noOptions = new Empty;
const digits = /^\d+$/;
const normalizeOption = s => s.trim().toLowerCase();
const notChunked = s => s !== 'chunked';
const identity = x => x;
const noop = () => {};

/*
	Headers owned:
	- content-length (completely overwritten, unless HEAD in which case it ensures validity)
	- trailer (completely overwritten, unless HEAD in which case it ensures validity)
	- date (ensures validity)
	- connection (ensures validity)
	- transfer-encoding (ensures validity)
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
