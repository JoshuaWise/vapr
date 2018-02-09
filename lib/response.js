'use strict';
const { STATUS_CODES } = require('http');
const shared = require('./shared');
const { hasOwnProperty } = Object.prototype;

class Response {
	constructor(code, body, headers) {
		if (typeof code !== 'number') throw new TypeError('Expected status code to be a number');
		if (!hasOwnProperty.call(STATUS_CODES, code)) throw new RangeError(`Unrecognized status code: ${code}`);
		if (code < 200) throw new RangeError('Expected status code to be greater or equal to 200');
		if (headers != null && typeof headers !== 'object') throw new TypeError('Expected headers to be an object or null');
		Object.defineProperty(this, shared.body, { value: body });
		Object.defineProperty(this, shared.headers, { value: headers });
		this.code = code;
		this.message = STATUS_CODES[code];
		Object.freeze(this);
	}
	static isResponse(value) {
		return value != null && hasOwnProperty.call(value, shared.body);
	}
}

module.exports = Response;
