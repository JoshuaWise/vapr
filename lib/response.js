'use strict';
const { inspect } = require('util');
const { hasOwnProperty } = Object.prototype;
const mut = Symbol();
const codes = Object.assign(Object.create(null), ...
	Object.entries(require('http').STATUS_CODES)
		.filter(([key]) => +key >= 200)
		.map(([key, value]) => ({ [key]: value })));

class Response {
	constructor(response) {
		if (typeof response === 'number') {
			const message = codes[response];
			if (!message) throw new RangeError(`Invalid status code: ${response}`);
			Object.defineProperty(this, mut, { value: { code: response, message, headers: {}, body: undefined, trailers: {} } });
		} else if (Array.isArray(response)) {
			Object.defineProperty(this, mut, { value: parseArray(response) });
		} else {
			throw new TypeError('Expected response to be a number or array');
		}
		Object.freeze(this);
	}
	static isResponse(value) { return value != null && hasOwnProperty.call(value, mut); }
	get code() { return this[mut].code; }
	get message() { return this[mut].message; }
	get headers() { return this[mut].headers; }
	get body() { return this[mut].body; }
	get trailers() { return this[mut].trailers; }
	[inspect.custom](_, options) { return inspect(this[mut], options); }
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
		this[mut].headers = value || {};
	}
	set body(value) {
		this[mut].body = value;
	}
	set trailers(value) {
		if (value != null && typeof value !== 'object') throw new TypeError(`Expected trailers to be an object: ${typeof value}`);
		this[mut].trailers = value || {};
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
		if (!headers) headers = {};
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
	if (!trailers) trailers = {};
	return { code, message, headers, body, trailers };
}

// TODO: move this to route.js
module.exports = (response) => {
	if (typeof response === 'number' || Array.isArray(response)) {
		try { return new Response(response); }
		catch (error) { return { error }; }
	}
	if (response instanceof Error) return { error: response };
	if (Response.isResponse(response)) return response;
	return { error: new TypeError('Expected route response to be a number, array, or error') };
};
