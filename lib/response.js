'use strict';
const { inspect } = require('util');
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
			if (!message) throw new RangeError(`Invalid status code: ${value}`);
			this[mut] = { code: value, message, headers: {}, trailers: {}, body: undefined };
		} else {
			if (Array.isArray(value)) this[mut] = parseArray(value);
			else throw new TypeError(`Expected response to be a number or array: ${typeof value}`);
		}
		Object.freeze(this);
	}
	get code() { return this[mut].code; }
	get message() { return this[mut].message; }
	get headers() { return this[mut].headers; }
	get trailers() { return this[mut].trailers; }
	get body() { return this[mut].body; }
	set code(value) {
		if (typeof value !== 'number') throw new TypeError(`Expected status code to be a number: ${typeof value}`);
		if (!codes[value]) throw new RangeError(`Invalid status code: ${value}`);
		this[mut].code = value;
	}
	set message(value) {
		if (value != null && typeof value !== 'string') throw new TypeError(`Expected message to be a string: ${typeof value}`);
		this[mut].message = value || codes[this[mut].code];
	}
	set headers(value) {
		if (value == null) this[mut].headers = {};
		else {
			if (typeof value !== 'object') throw new TypeError(`Expected headers to be an object: ${typeof value}`);
			if (!isPlain(value)) throw new TypeError(`Expected headers to be a plain object: ${getName(value)}`);
			this[mut].headers = value;
		}
	}
	set trailers(value) {
		if (value == null) this[mut].trailers = {};
		else {
			if (typeof value !== 'object') throw new TypeError(`Expected trailers to be an object: ${typeof value}`);
			if (!isPlain(value)) throw new TypeError(`Expected trailers to be a plain object: ${getName(value)}`);
			this[mut].trailers = value;
		}
	}
	set body(value) {
		this[mut].body = value;
	}
	[inspect.custom]() {
		return Object.assign(new ResponseInspection, this[mut]);
	}
	static isResponse(value) {
		return value != null && hasOwnProperty.call(value, mut);
	}
}

const parseArray = ([code, message, headers, body]) => {
	let index = 3;
	let trailers;
	if (typeof code !== 'number') throw new TypeError(`Expected response[0] to be a number: ${typeof code}`);
	if (!codes[code]) throw new RangeError(`Invalid status code: ${code}`);
	if (typeof message === 'object' && message !== null) {
		index -= 1;
		body = headers;
		headers = message;
		message = codes[code];
	} else {
		if (message == null || message === '') message = codes[code];
		else if (typeof message !== 'string') throw new TypeError(`Expected response[1] to be a string, object, or array: ${typeof message}`);
	}
	if (Array.isArray(headers)) {
		index -= 1;
		body = headers;
		headers = {};
	} else {
		if (headers == null) headers = {};
		else {
			if (typeof headers !== 'object') throw new TypeError(`Expected response[${index - 1}] to be an object or array: ${typeof headers}`);
			if (!isPlain(headers)) throw new TypeError(`Expected response[${index - 1}] to be a ${index < 3 ? 'string, plain object,' : 'plain object'} or array: ${getName(headers)}`);
		}
	}
	if (body == null) {
		body = undefined;
		trailers = {};
	} else {
		if (!Array.isArray(body)) throw new TypeError(`Expected response[${index}] to be an array: ${typeof body}`);
		[body, trailers] = body;
		if (trailers == null) trailers = {};
		else {
			if (typeof trailers !== 'object') throw new TypeError(`Expected response[${index}][1] to be an object: ${typeof trailers}`);
			if (!isPlain(trailers)) throw new TypeError(`Expected response[${index}][1] to be a plain object: ${getName(trailers)}`);
		}
	}
	return { code, message, headers, trailers, body };
};

const isPlain = (obj) => {
	const proto = Object.getPrototypeOf(obj);
	return proto === Object.prototype || proto === null;
};
const getName = (obj) => {
	const proto = Object.getPrototypeOf(obj);
	if (proto === null) return 'Object';
	if (typeof proto.constructor !== 'function') return '(unknown class)';
	if (typeof proto.constructor.name !== 'string') return '(unknown class)';
	return proto.constructor.name || '(anonymous class)';
};

const codes = Object.assign(Object.create(null), ...
	Object.entries(require('http').STATUS_CODES)
		.filter(([key]) => +key >= 200)
		.map(([key, value]) => ({ [key]: value })));

const { hasOwnProperty } = Object.prototype;
const ResponseInspection = class Response {};
module.exports = Response;
