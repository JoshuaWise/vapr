'use strict';

/*
	Headers are just like regular Map objects except all key-value pairs must be
	valid header strings. Also, the constructor accepts an object literal for
	initialization, instead of an array of arrays.
	TODO: clean up this class, normalize error messages
	TODO: check that new Response(*) reacts correctly in all situations
 */

class Headers extends Map {
	constructor(headers) {
		Object.freeze(super());
		if (headers == null) return;
		if (typeof headers !== 'object') throw new TypeError(`Expected ${getName(this)}s to be an object: ${typeof headers}`);
		if (!isPlain(headers)) throw new TypeError(`Expected ${getName(this)}s to be a plain object: ${getClass(headers)}`);
		for (const key of Object.keys(headers)) this.set(key, headers[key]);
	}
	set(name, value) {
		if (typeof name !== 'string') throw new TypeError(`Expected ${getName(this)} name to be a string: ${typeof name}`);
		if (typeof value !== 'string') throw new TypeError(`Expected ${getName(this)} value to be a string: ${typeof value}`);
		if (!headerName.test(name)) throw new TypeError(`Invalid ${getName(this)} name: ${name}`);
		if (!headerValue.test(value)) throw new TypeError(`Invalid ${getName(this)} value: ${value}`);
		return super.set(name, value);
	}
}

const isPlain = (obj) => {
	const proto = Object.getPrototypeOf(obj);
	return proto === Object.prototype || proto === null;
};

const getClass = (obj) => {
	const proto = Object.getPrototypeOf(obj);
	if (proto === null) return 'Object';
	if (typeof proto.constructor !== 'function') return '(unknown class)';
	if (typeof proto.constructor.name !== 'string') return '(unknown class)';
	return proto.constructor.name || '(anonymous class)';
};

const getName = (obj) => {
	const { constructor } = Object.getPrototypeOf(obj) || Headers.prototype;
	const constructorName = String(constructor && constructor.name || 'Headers');
	return constructorName.toLowerCase().replace(/s$/, '');
};

const headerName = /^[-\w!#$%&'*+.^`|~]+$/i;
const headerValue = /^(?:[\x21-\x7e](?:[\x20\x09]+[\x21-\x7e])?)*$/;
module.exports = Headers;
