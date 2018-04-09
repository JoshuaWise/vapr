'use strict';
const { inspect } = require('util');
const River = require('wise-river');
const Promise = require('wise-promise');
const Headers = require('./headers');
const Trailers = require('./trailers');
const mut = Symbol();

/*
	The public interface for a soon-to-be outgoing response. Response objects
	can either be constructed from a status code number or an array.
	If an array is provided, its structure should be:
		[code, message?, headers?, [body, trailers?]?]
	Any optional value can be omitted or replaced with null or undefined.
	Response objects can be mutated, but they utilize setter methods to validate
	any mutations. Therefore, Response objects are always guaranteed to be
	well-formed, even after being exposed to application logic.
 */

class Response {
	constructor(value) {
		if (typeof value === 'number') {
			const message = codes[value];
			if (!message) throw new RangeError(`Invalid response code: ${value}`);
			this.headers = new Headers;
			this.trailers = new Trailers;
			this[mut] = { code: value, message, body: undefined };
		} else {
			if (Array.isArray(value)) parseArray(this, value.length, value);
			else throw new TypeError(`Expected response to be a number or array (got ${typeof value})`);
		}
		Object.freeze(this);
	}
	get code() {
		return this[mut].code;
	}
	get message() {
		return this[mut].message;
	}
	get body() {
		return this[mut].body;
	}
	set code(value) {
		const { [mut]: self } = this;
		const newCode = normalizeCode(value);
		if (self.message === codes[self.code]) self.message = codes[newCode];
		self.code = newCode;
	}
	set message(value) {
		this[mut].message = normalizeMessage(value, this[mut].code);
	}
	set body(value) {
		this[mut].body = normalizeBody(value);
	}
	[inspect.custom]() {
		const ret = new ResponseInspection;
		for (const key of ['code', 'message', 'headers', 'trailers', 'body']) ret[key] = this[key];
		return ret;
	}
	static isResponse(value) {
		return value != null && hasOwnProperty.call(value, mut);
	}
}

const parseArray = (self, length, [code, message, headers, body]) => {
	let trailers;
	let index = 4;
	code = normalizeCode(code);
	if (typeof message === 'object' && message !== null) {
		body = headers;
		headers = message;
		message = codes[code];
		index -= 1;
	} else {
		message = normalizeMessage(message, code);
	}
	if (Array.isArray(headers)) {
		[body, trailers] = headers;
		headers = undefined;
		index -= 1;
	} else if (Array.isArray(body)) {
		[body, trailers] = body;
	} else if (body != null) {
		throw new TypeError('Expected response body to be nested within another array');
	}
	if (length > index) {
		throw new TypeError(`Unexpected value at response array[${index}]`);
	}
	self.headers = new Headers(headers);
	self.trailers = new Trailers(trailers);
	self[mut] = { code, message, body: normalizeBody(body) };
};

const normalizeCode = (code) => {
	if (typeof code !== 'number') throw new TypeError('Expected response code to be a number');
	if (!codes[code]) throw new RangeError(`Invalid response code: ${code}`);
	return code;
};

const normalizeMessage = (message, code) => {
	if (typeof message === 'string') {
		if (!statusMessage.test(message)) throw new TypeError(`Invalid response message: ${message}`);
		return message;
	}
	if (message == null) return codes[code];
	throw new TypeError('Expected response message to be a string');
};

const normalizeBody = (body) => {
	if (body == null) return;
	if (Promise.isPromise(body)) {
		if (!River.isRiver(body)) body = Promise.resolve(body);
		body.catchLater();
	} else if (!Buffer.isBuffer(body)) {
		throw new TypeError('Expected response body to be a buffer, promise, river, or null');
	}
	return body;
};

const codes = Object.assign(Object.create(null), ...
	Object.entries(require('http').STATUS_CODES)
		.filter(([key]) => +key >= 200)
		.map(([key, value]) => ({ [key]: value })));

const { hasOwnProperty } = Object.prototype;
const ResponseInspection = class Response {};
const statusMessage = /^[\x20-\x7e\x09]*$/;
module.exports = Response;
