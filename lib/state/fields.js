'use strict';
const { inspect } = require('util');
const raw = Symbol();
const mut = Symbol();

/*
	Fields are just like regular Map objects except they cannot be mutated and
	keys are case-insensitive. The constructor takes req.headers or req.trailers
	as its only argument, instead of an array of arrays.
	TODO: https://github.com/nodejs/node/issues/3093
 */

class Fields extends Map {
	constructor(fields) {
		super();
		this[raw] = fields;
		this[mut] = { size: -1 };
		Object.freeze(this);
	}
	get(name) {
		if (typeof name !== 'string') throw new TypeError('Expected field name to be a string');
		name = name.toLowerCase();
		if (!this[raw].hasOwnProperty(name)) return;
		return this[raw][name].trim();
	}
	has(name) {
		if (typeof name !== 'string') throw new TypeError('Expected field name to be a string');
		return this[raw].hasOwnProperty(name.toLowerCase());
	}
	*entries() {
		for (const name of Object.keys(this[raw])) yield [name, this[raw][name].trim()];
	}
	*keys() {
		for (const name of Object.keys(this[raw])) yield name;
	}
	*values() {
		for (const name of Object.keys(this[raw])) yield this[raw][name].trim();
	}
	forEach(fn, thisArg) {
		if (typeof fn !== 'function') throw new TypeError('Expected callback to be a function');
		for (const name of Object.keys(this[raw])) call.call(fn, thisArg, this[raw][name].trim(), name, this);
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
	get size() {
		if (this[mut].size !== -1) return this[mut].size;
		return this[mut].size = Object.keys(this[raw]).length;
	}
	[inspect.custom]() {
		return new FieldsInspection(this);
	}
}

const { call } = Function.prototype;
const FieldsInspection = class Fields extends Map {};
Fields.prototype[Symbol.iterator] = Fields.prototype.entries;
module.exports = Fields;
