'use strict';
const codes = Object.assign(Object.create(null), ...
	Object.entries(require('http').STATUS_CODES)
		.filter(([key]) => +key >= 200)
		.map(([key, value]) => ({ [key]: value })));

module.exports = ([code, message, headers, body]) => {
	let index = 3;
	let defaultMessage;
	let trailers;
	if (typeof code !== 'number') throw new TypeError(`Expected response[0] to be a number: ${typeof code}`);
	if (!(defaultMessage = codes[code])) throw new RangeError(`Invalid status code: ${code}`);
	if (message != null && typeof message !== 'string') {
		if (typeof message !== 'object') throw new TypeError(`Expected response[1] to be a string, object, or array: ${typeof message}`);
		index = 2;
		body = headers;
		headers = message;
		message = undefined;
	} else if (headers != null && typeof headers !== 'object') {
		throw new TypeError(`Expected response[2] to be an object or array: ${typeof headers}`);
	}
	if (Array.isArray(headers)) {
		index -= 1;
		body = headers;
		headers = undefined;
	} else if (body != null && !Array.isArray(body)) {
		throw new TypeError(`Expected response[${index}] to be an array: ${typeof body}`);
	}
	if (body) {
		[body, trailers] = body;
		if (trailers != null && typeof trailers !== 'object') throw new TypeError(`Expected response[${index}][1] to be an object: ${typeof trailers}`);
	}
	if (!message) message = defaultMessage;
	return { code, message, headers, body, trailers };
};
