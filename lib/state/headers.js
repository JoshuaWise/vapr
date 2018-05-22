'use strict';
const { hint } = require('../shared');

/*
	Headers are just like regular Map objects except all key-value pairs must be
	strings and keys are case-insensitive. The constructor accepts an object
	literal for initialization, instead of an array of arrays.
 */

class Headers extends Map {
	constructor(headers) {
		Object.freeze(super());
		if (headers == null) return;
		if (typeof headers !== 'object') throw new TypeError(`Expected ${getName(this)}s to be an object ${hint(headers)}`);
		if (!isPlain(headers)) throw new TypeError(`Expected ${getName(this)}s to be a plain object ${hint(headers)}`);
		for (const name of Object.keys(headers)) this.set(name, headers[name]);
	}
	get(name) {
		if (typeof name !== 'string') throw new TypeError(`Expected ${getName(this)} name to be a string ${hint(name)}`);
		return super.get(name.toLowerCase());
	}
	has(name) {
		if (typeof name !== 'string') throw new TypeError(`Expected ${getName(this)} name to be a string ${hint(name)}`);
		return super.has(name.toLowerCase());
	}
	set(name, value) {
		if (typeof name !== 'string') throw new TypeError(`Expected ${getName(this)} name to be a string ${hint(name)}`);
		if (typeof value !== 'string') throw new TypeError(`Expected ${getName(this)} value to be a string ${hint(value)}`);
		return super.set(name.toLowerCase(), value);
	}
	delete(name) {
		if (typeof name !== 'string') throw new TypeError(`Expected ${getName(this)} name to be a string ${hint(name)}`);
		return super.delete(name.toLowerCase());
	}
}

const isPlain = (obj) => {
	const proto = Object.getPrototypeOf(obj);
	return proto === Object.prototype || proto === null;
};

const getName = (obj) => {
	const { constructor } = Object.getPrototypeOf(obj) || Headers.prototype;
	const constructorName = String(constructor && constructor.name || 'Headers');
	return constructorName.toLowerCase().replace(/s$/, '');
};

module.exports = Headers;
