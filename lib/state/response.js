'use strict';
const { inspect } = require('util');
const River = require('wise-river');
const Promise = require('wise-promise');
const Headers = require('./headers');
const Trailers = require('./trailers');
const { hint } = require('../shared');
const mut = Symbol();

/*
	The public interface for a soon-to-be outgoing response. Response objects
	can either be constructed from a status code number or an array.
	If an array is provided, its structure should be:
		[code, message?, headers?, [body, trailers?]?]
		or
		[[body, trailers?]]
	Any optional value can be omitted or replaced with null or undefined.
	Response objects can be mutated, but they utilize setter methods to validate
	any mutations. Therefore, Response objects are always guaranteed to be
	well-formed, even after being exposed to application logic.
 */

class Response {
	constructor(value) {
		if (typeof value === 'number') {
			const message = codes.get(value);
			if (!message) throw new RangeError(`Invalid response code: ${value}`);
			this.headers = new Headers;
			this.trailers = new Trailers;
			this[mut] = { code: value, message, body: undefined };
		} else {
			if (Array.isArray(value)) parseArray(this, value.length, value);
			else throw new TypeError(`Expected response to be a number or array ${hint(value)}`);
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
		if (self.message === codes.get(self.code)) self.message = codes.get(newCode);
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
	if (length === 1 && Array.isArray(code)) {
		[body, trailers] = code;
		code = 200;
		message = message200;
		headers = undefined;
	} else {
		let index = 4;
		code = normalizeCode(code);
		if (typeof message === 'object' && message !== null) {
			body = headers;
			headers = message;
			message = codes.get(code);
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
	}
	self.headers = new Headers(headers);
	self.trailers = new Trailers(trailers);
	self[mut] = { code, message, body: normalizeBody(body) };
};

const normalizeCode = (code) => {
	if (typeof code !== 'number') throw new TypeError(`Expected response code to be a number ${hint(code)}`);
	if (!codes.has(code)) throw new RangeError(`Invalid response code: ${code}`);
	return code;
};

const normalizeMessage = (message, code) => {
	if (typeof message === 'string') return message;
	if (message == null) return codes.get(code);
	throw new TypeError(`Expected response message to be a string ${hint(message)}`);
};

const normalizeBody = (body) => {
	if (body == null) return;
	if (Buffer.isBuffer(body)) return body;
	if (River.isRiver(body)) return body.catchLater();
	if (Promise.isPromise(body)) Promise.resolve(body).catchLater();
	throw new TypeError(`Expected response body to be a buffer, river, or null ${hint(body)}`);
};

const codes = new Map(Object.entries(require('http').STATUS_CODES)
	.map(([key, value]) => [+key, value])
	.filter(([key]) => key >= 200));

const { hasOwnProperty } = Object.prototype;
const ResponseInspection = class Response {};
const message200 = codes.get(200);
module.exports = Response;
