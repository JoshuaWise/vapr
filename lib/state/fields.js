'use strict';

/*
	Fields are just like regular Map objects except they cannot be mutated,
	and field names are case-insensitive. The constructor takes req.headers or
	req.trailers as its only argument, instead of an array of arrays.
	TODO: this doesn't validate incomming header names or values
 */

class Fields extends Map {
	constructor(fields) {
		Object.freeze(super());
		for (const name of Object.keys(fields)) super.set(name, fields[name].trim());
	}
	get(name) {
		if (typeof name !== 'string') throw new TypeError('Expected field name to be a string');
		return super.get(name.toLowerCase());
	}
	has(name) {
		if (typeof name !== 'string') throw new TypeError('Expected field name to be a string');
		return super.has(name.toLowerCase());
	}
	set() {
		throw new TypeError('This map object is read-only');
	}
	delete() {
		throw new TypeError('This map object is read-only');
	}
	clear() {
		throw new TypeError('This map object is read-only');
	}
}

module.exports = ReadOnlyMap;
