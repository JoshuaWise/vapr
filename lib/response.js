'use strict';
const { inspect } = require('util');
const mut = Symbol();

class Response {
	constructor(value) {
		if (typeof value === 'number') {
			const message = codes[value];
			if (!message) throw new RangeError(`Invalid status code: ${value}`);
			this[mut] = { code: value, message, headers: {}, trailers: {}, body: undefined };
		} else if (Array.isArray(value)) {
			this[mut] = parseArray(value);
		} else {
			throw new TypeError('Expected response to be a number or array');
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
		if (value != null && typeof value !== 'object') throw new TypeError(`Expected headers to be an object: ${typeof value}`);
		this[mut].headers = toPlain(value);
	}
	set trailers(value) {
		if (value != null && typeof value !== 'object') throw new TypeError(`Expected trailers to be an object: ${typeof value}`);
		this[mut].trailers = toPlain(value);
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
	let defaultMessage;
	let trailers;
	if (typeof code !== 'number') {
		throw new TypeError(`Expected response[0] to be a number: ${typeof code}`);
	}
	if (!(defaultMessage = codes[code])) {
		throw new RangeError(`Invalid status code: ${code}`);
	}
	if (message != null && typeof message !== 'string') {
		if (typeof message !== 'object') {
			throw new TypeError(`Expected response[1] to be a string, object, or array: ${typeof message}`);
		}
		index = 2;
		body = headers;
		headers = message;
		message = defaultMessage;
	} else {
		if (!message) message = defaultMessage;
		if (headers != null && typeof headers !== 'object') {
			throw new TypeError(`Expected response[2] to be an object or array: ${typeof headers}`);
		}
	}
	if (Array.isArray(headers)) {
		index -= 1;
		body = headers;
		headers = {};
	} else {
		headers = toPlain(headers);
		if (body != null && !Array.isArray(body)) {
			throw new TypeError(`Expected response[${index}] to be an array: ${typeof body}`);
		}
	}
	if (body) {
		[body, trailers] = body;
		if (trailers != null && typeof trailers !== 'object') {
			throw new TypeError(`Expected response[${index}][1] to be an object: ${typeof trailers}`);
		}
	}
	trailers = toPlain(trailers);
	return { code, message, headers, trailers, body };
}

const toPlain = (obj) => {
	if (obj == null) return {};
	const proto = Object.getPrototypeOf(obj);
	if (proto === Object.prototype || proto === null) return obj;
	throw new TypeError('Expected headers/trailers to be a plain object');
};

const codes = Object.assign(Object.create(null), ...
	Object.entries(require('http').STATUS_CODES)
		.filter(([key]) => +key >= 200)
		.map(([key, value]) => ({ [key]: value })));

const { hasOwnProperty } = Object.prototype;
const ResponseInspection = class Response {};
module.exports = Response;
