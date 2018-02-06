'use strict';
const Promise = require('wise-promise');
const River = require('wise-river');
const instance = Symbol();
const type = Symbol();
const body = Symbol();

class Request {
	constructor(req, location) {
		this[instance] = this;
		this[type] = '';
		this[body] = new River((resolve, reject, write) => {
			req.on('data', write);
			req.on('end', resolve);
			req.on('aborted', () => reject(new Error('The request was aborted')));
		});
		const trailers = new Promise((resolve, reject) => {
			req.on('end', () => resolve(Object.freeze(req.trailers)));
			req.on('aborted', () => reject(new Error('The request was aborted')));
		});
		const pub = Object.create(this);
		pub.method = req.method;
		pub.target = Object.freeze(location);
		pub.headers = Object.freeze(req.headers);
		pub.trailers = trailers.catchLater();
		pub.meta = {};
		return Object.freeze(pub);
	}
	stream() {
		if (this[type]) throw new TypeError('The request body was already consumed');
		const stream = this[body];
		this[instance][body] = null;
		this[instance][type] = 'stream';
		return stream;
	}
	raw() {
		if (this[type] === 'raw') return this[body];
		if (this[type]) throw new TypeError('The request body was already consumed');
		this[type] = 'raw';
		return this[body] = this[body].all().then(Buffer.concat);
	}
	json() {
		if (this[type] === 'json') return this[body];
		if (this[type]) throw new TypeError('The request body was already consumed');
		this[type] = 'json';
		return this[body] = this[body].all().then(toJSON);
	}
	respond(statusCode, headers, body) {
		
	}
}

const toJSON = chunks => JSON.parse(Buffer.concat(chunks).toString());
module.exports = Request;

/*
	NOTES:
	responses to HEAD methods, or when the response status code is 1xx, 204, or
	304, do not include a body.
	responses cannot include the Transfer-Encoding header if the response status
	code is 1xx or 204.
	if the response Content-Length header is set, the response must be sent in a
	single chunk, and that chucnk's byte length must match Content-Length.
	
 */
