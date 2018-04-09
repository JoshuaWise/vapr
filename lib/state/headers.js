'use strict';

/*
	Headers are just like regular Map objects except all key-value pairs must be
	strings and keys are case-insensitive. The constructor accepts an object
	literal for initialization, instead of an array of arrays.
 */

class Headers extends Map {
	constructor(headers) {
		Object.freeze(super());
		if (headers == null) return;
		if (typeof headers !== 'object') throw new TypeError(`Expected response ${getName(this)}s to be an object`);
		if (!isPlain(headers)) throw new TypeError(`Expected response ${getName(this)}s to be a plain object (got ${getClass(headers)})`);
		for (const name of Object.keys(headers)) this.set(name, headers[name]);
	}
	get(name) {
		if (typeof name !== 'string') throw new TypeError(`Expected response ${getName(this)} name to be a string`);
		return super.get(name.toLowerCase());
	}
	has(name) {
		if (typeof name !== 'string') throw new TypeError(`Expected response ${getName(this)} name to be a string`);
		return super.has(name.toLowerCase());
	}
	set(name, value) {
		if (typeof name !== 'string') throw new TypeError(`Expected response ${getName(this)} name to be a string`);
		if (typeof value !== 'string') throw new TypeError(`Expected response ${getName(this)} value to be a string`);
		return super.set(name.toLowerCase(), value);
	}
	delete(name) {
		if (typeof name !== 'string') throw new TypeError(`Expected response ${getName(this)} name to be a string`);
		return super.delete(name.toLowerCase());
	}
}

const isPlain = (obj) => {
	const proto = Object.getPrototypeOf(obj);
	return proto === Object.prototype || proto === null;
};

const getClass = (obj) => {
	const proto = Object.getPrototypeOf(obj);
	if (proto === null) return 'Object';
	if (typeof proto.constructor !== 'function') return 'unknown class';
	if (typeof proto.constructor.name !== 'string') return 'unknown class';
	return proto.constructor.name || 'anonymous class';
};

const getName = (obj) => {
	const { constructor } = Object.getPrototypeOf(obj) || Headers.prototype;
	const constructorName = String(constructor && constructor.name || 'Headers');
	return constructorName.toLowerCase().replace(/s$/, '');
};

module.exports = Headers;
