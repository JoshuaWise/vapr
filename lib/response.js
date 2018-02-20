'use strict';
const codes = Object.assign(Object.create(null), ...
	Object.entries(require('http').STATUS_CODES)
		.filter(([key]) => +key >= 200)
		.map(([key, value]) => ({ [key]: value })));

module.exports = (response) => {
	if (typeof response === 'number') {
		const message = codes[response];
		if (message) return Object.seal({ code: response, message, headers: {}, body: undefined, trailers: {} });
		return { error: new RangeError(`Invalid status code: ${response}`) };
	}
	if (Array.isArray(response)) return parseArray(response);
	if (response instanceof Error) return { error: response };
	return { error: new TypeError('Expected route response to be a number, array, or error') };
};

const parseArray = ([code, message, headers, body]) => {
	let index = 3;
	let defaultMessage;
	let trailers;
	if (typeof code !== 'number') {
		return { error: new TypeError(`Expected response[0] to be a number: ${typeof code}`) };
	}
	if (!(defaultMessage = codes[code])) {
		return { error: new RangeError(`Invalid status code: ${code}`) };
	}
	if (message != null && typeof message !== 'string') {
		if (typeof message !== 'object') {
			return { error: new TypeError(`Expected response[1] to be a string, object, or array: ${typeof message}`) };
		}
		index = 2;
		body = headers;
		headers = message;
		message = undefined;
	} else if (headers != null && typeof headers !== 'object') {
		return { error: new TypeError(`Expected response[2] to be an object or array: ${typeof headers}`) };
	}
	if (Array.isArray(headers)) {
		index -= 1;
		body = headers;
		headers = undefined;
	} else if (body != null && !Array.isArray(body)) {
		return { error: new TypeError(`Expected response[${index}] to be an array: ${typeof body}`) };
	}
	if (body) {
		[body, trailers] = body;
		if (trailers != null && typeof trailers !== 'object') {
			return { error: new TypeError(`Expected response[${index}][1] to be an object: ${typeof trailers}`) };
		}
	}
	if (!message) message = defaultMessage;
	if (!headers) headers = {};
	if (!trailers) trailers = {};
	return Object.seal({ code, message, headers, body, trailers });
};
