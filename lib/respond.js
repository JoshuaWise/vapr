'use strict';
const River = require('wise-river');
const Promise = require('wise-promise');
const { hint } = require('./shared');

/*
	This is how we actually respond to a request, given a Response object.
 */

module.exports = (req, res, response, logger) => {
	const head = req.method === 'HEAD';
	const legacy = req.httpVersionMajor !== 1 || req.httpVersionMinor === 0;
	const headers = toObject(response.headers);
	const { code, message } = response;
	let { body, trailers } = response;
	
	// Ensure that only valid headers are sent.
	const hTrailer = headers['trailer'];
	const hTransferEncoding = headers['transfer-encoding'];
	const hContentLength = headers['content-length'];
	if (headers['date'] !== undefined && !dateHeader.test(headers['date'])) {
		throw new TypeError(`Invalid date header: ${headers['date']}`);
	}
	if (headers['connection'] !== undefined && !tokenHeader.test(headers['connection'])) {
		throw new TypeError(`Invalid connection header: ${headers['connection']}`);
	}
	if (hTrailer !== undefined && !tokenHeader.test(hTrailer)) {
		throw new TypeError(`Invalid trailer header: ${hTrailer}`);
	}
	if (hTransferEncoding !== undefined && !transferEncodingHeader.test(hTransferEncoding)) {
		throw new TypeError(`Invalid transfer-encoding header: ${hTransferEncoding}`);
	}
	if (hContentLength !== undefined && !contentLengthHeader.test(hContentLength)) {
		throw new TypeError(`Invalid content-length header: ${hContentLength}`);
	}
	
	// Ensure the response body is a valid type.
	if (body != null && !Buffer.isBuffer(body) && !River.isRiver(body)) {
		throw new TypeError(`Expected response body to be a buffer, river, or null ${hint(body)}`);
	}
	
	// A bug exists in Node.js whereupon invoking res.writeHead with a status
	// code of 204 or 304, and in a way that causes it to throw, any future
	// attempts at responding to the same request will be unable to include a
	// response body. We can fix the behavior by overriding the _hasBody field on
	// the http.ServerResponse object to have the correct value. However, if we
	// encounter a version of Node.js where that field does not exist, we cannot
	// predict the behavior and so it should be considered unsupported.
	if (typeof res._hasBody !== 'boolean') {
		throw new TypeError('Unsupported Node.js version detected');
	}
	res._hasBody = !(head || code === 204 || code === 304);
	
	// These types of responses do not have bodies.
	if (!res._hasBody) {
		if (code === 204) {
			if (hTrailer !== undefined) delete headers['trailer'];
			if (hTransferEncoding !== undefined) delete headers['transfer-encoding'];
			if (hContentLength !== undefined) delete headers['content-length'];
		} else if (legacy) {
			if (hTrailer !== undefined) delete headers['trailer'];
			if (hTransferEncoding !== undefined) delete headers['transfer-encoding'];
		} else if (hTransferEncoding !== undefined && hContentLength !== undefined) {
			delete headers['transfer-encoding'];
		}
		if (River.isRiver(body)) body.drop(); // Drop the unused response stream
		res.writeHead(code, message, headers);
		res.end();
		return;
	}
	
	// If the body is not a river, and there is no transfer-encoding header, and
	// there are no trailers, the body can be sent without the chunked encoding.
	if (!River.isRiver(body)) {
		if ((!trailers.size || legacy) && hTransferEncoding === undefined) {
			if (hTrailer !== undefined) delete headers['trailer'];
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
		if (hTrailer !== undefined) delete headers['trailer'];
		if (hContentLength !== undefined) delete headers['content-length'];
		headers['connection'] = 'close';
		res.writeHead(code, message, headers);
		stream(res, body, undefined, logger);
		return;
	}
	
	// Here we use the HTTP/1.1 chunked encoding to perform a streamed response.
	if (hContentLength !== undefined) delete headers['content-length'];
	if (trailers.size) {
		trailers = toObject(trailers);
		headers['trailer'] = Object.keys(trailers).join(',');
	} else {
		trailers = undefined;
		if (hTrailer !== undefined) delete headers['trailer'];
	}
	headers['transfer-encoding'] = hTransferEncoding === undefined ? 'chunked' : hTransferEncoding + ',chunked';
	res.writeHead(code, message, headers);
	stream(res, body, trailers, logger);
};

const stream = (res, body, trailers, logger) => {
	let dead = false;
	const fail = (err) => {
		if (dead) return;
		dead = true;
		process.nextTick(logger, err); // If the stream errors out, log the error
		res.destroy();
	};
	(trailers ? Promise.all([Promise.props(trailers), body]) : body).then((more) => {
		try {
			if (more) res.addTrailers(validateTrailers(more[0]));
			res.end();
		} catch (err) {
			fail(err);
		}
	}, fail);
	const cancel = body.pump((chunk) => {
		if (Buffer.isBuffer(chunk)) res.write(chunk);
		else if (chunk != null) throw new TypeError(`Expected response body to be made of buffers ${hint(chunk)}`);
	});
	res.on('close', () => {
		if (dead) return;
		dead = true;
		cancel(); // If the request is aborted while streaming, just cancel the stream
		res.destroy();
	});
};

const toObject = (map) => {
	const obj = {};
	for (const [key, value] of map.entries()) obj[key] = value;
	return obj;
};

const validateTrailers = (trailers) => {
	for (const value of Object.values(trailers)) {
		if (typeof value !== 'string') throw new TypeError(`Expected trailer promise to resolve to a string ${hint(value)}`);
	}
	return trailers;
};

const dateHeader = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d\d (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d\d\d\d \d\d:\d\d:\d\d GMT$/;
const tokenHeader = /^[-!#$%&'*+.^_`|~a-z\d]+(?:[ \t]*,[ \t]*[-!#$%&'*+.^_`|~a-z\d]+)*$/i;
const transferEncodingHeader = /^[-!#$%&'*+.^_`|~a-z\d]+(?:[ \t]*;[ \t]*[-!#$%&'*+.^_`|~a-z\d]+=(?:[-!#$%&'*+.^_`|~a-z\d]+|"(?:[ \t\x21\x23-\x5b\x5d-\x7e\x80-\xff]|\\[ \t\x21-\x7e\x80-\xff])*"))*(?:[ \t]*,[ \t]*[-!#$%&'*+.^_`|~a-z\d]+(?:[ \t]*;[ \t]*[-!#$%&'*+.^_`|~a-z\d]+=(?:[-!#$%&'*+.^_`|~a-z\d]+|"(?:[ \t\x21\x23-\x5b\x5d-\x7e\x80-\xff]|\\[ \t\x21-\x7e\x80-\xff])*"))*)*$/i;
const contentLengthHeader = /^\d+$/;
const noop = () => {};
