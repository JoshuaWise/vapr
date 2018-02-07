'use strict';
const { STATUS_CODES } = require('http');
const Promise = require('wise-promise');
const River = require('wise-river');
const shared = require('./shared');
const instance = Symbol();
const stream = Symbol();
const body = Symbol();
const noBody = {};

class Request {
	constructor(req, location) {
		this[instance] = this;
		this[body] = noBody;
		this[stream] = new River((resolve, reject, write) => {
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
		if (!this[stream]) return River.reject(new TypeError('The request body was already consumed'));
		const data = this[stream];
		this[instance][stream] = null;
		return data;
	}
	body() {
		if (this[body] !== noBody) return this[body];
		if (!this[stream]) return Promise.reject(new TypeError('The request body was already consumed'));
		const data = this[stream].all().then(Buffer.concat); // TODO: support plugin content types
		this[instance][stream] = null;
		this[instance][body] = data;
		return data;
	}
	set(...args) {
		if (args.length === 2) {
			this.meta[args[0]] = args[1];
			return this;
		}
		if (args.length < 2) {
			throw new TypeError('Expected at least two arguments');
		}
		const len = args.length - 2;
		let index = 0;
		let obj = this.meta;
		do {
			obj = obj[args[index]];
			if (obj == null || typeof obj !== 'object') {
				throw new TypeError(`Non-existent object path: meta.${args.slice(0, -2).map(String).join('.')}`);
			}
		} while (index < len)
		obj[args[index]] = args[index + 1];
		return this;
	}
	respond(code, body, headers) {
		return new Response(code, body, headers);
	}
}

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

module.exports = Request;

/*
	TODO:
	responses to HEAD methods, or when the response status code is 1xx, 204, or
	304, do not include a body.
	responses cannot include the Transfer-Encoding header if the response status
	code is 1xx or 204.
	if the response Content-Length header is set, the response must be sent in a
	single chunk, and that chucnk's byte length must match Content-Length.
 */
