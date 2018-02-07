'use strict';
const { STATUS_CODES } = require('http');
const shared = require('./shared');

class Response {
	constructor(code, body, headers) {
		if (typeof code !== 'number') throw new TypeError('Expected status code to be a number');
		if (!STATUS_CODES.hasOwnProperty(code)) throw new RangeError(`Unrecognized status code: ${code}`);
		if (code < 200) throw new RangeError('Expected status code to be greater or equal to 200');
		if (headers != null && typeof headers !== 'object') throw new TypeError('Expected headers to be an object or null');
		this[shared.body] = body;
		this[shared.headers] = headers;
		this[shared.error] = null;
		const pub = Object.create(this);
		pub.code = code;
		pub.message = STATUS_CODES[code];
		return Object.freeze(pub);
	}
	static isResponse(value) {
		return value != null && typeof value === 'object'
			&& shared.body in value
			&& Number.isInteger(value.code)
			&& typeof value.message === 'string';
	}
	get error() {
		return this[shared.error];
	}
}

module.exports = Response;
