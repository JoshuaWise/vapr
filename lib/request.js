'use strict';
const { inspect } = require('util');
const Promise = require('wise-promise');
const River = require('wise-river');
const mut = Symbol();

/*
	The public interface for an incoming request. Since requests are immutable,
	the mutable request.meta object is reserved for application use. Purely for
	convenience, the get() and set() methods are provided to deeply access and
	mutate the request.meta object, respectively.
	TODO: when asynchronous iterators are in the LTS, the wise-* packages
	should be dropped in favor of dumb native objects.
 */

class Request {
	constructor(req, location) {
		this.method = req.method;
		this.target = Object.freeze(location);
		this.headers = Object.freeze(req.headers);
		this.meta = {};
		this[mut] = { raw: req, flowing: false, aborted: false, body: undefined };
		req.on('aborted', () => { this[mut].aborted = true; });
		Object.freeze(this);
	}
	body() {
		const { [mut]: self } = this;
		if (self.flowing) return River.reject(new TypeError('The request body was already consumed'));
		self.flowing = true;
		if (self.aborted) return self.body = River.reject(new Error('The request was aborted'));
		return self.body = new River((resolve, reject, write) => {
			self.raw.on('data', write);
			self.raw.on('end', resolve);
			self.raw.on('aborted', () => reject(new Error('The request was aborted')));
		});
	}
	trailers() {
		const { [mut]: self } = this;
		if (!self.flowing) this.body();
		return self.body.then(() => Object.freeze(self.raw.trailers));
	}
	get(...args) {
		if (args.length === 1) return this.meta[args[0]];
		if (args.length === 0) return this.meta;
		const len = args.length - 1;
		let index = 0;
		let obj = this.meta;
		do {
			obj = obj[args[index]];
			if (obj == null) return;
		} while (++index < len)
		return obj[args[index]];
	}
	set(...args) {
		if (args.length === 2) return (this.meta[args[0]] = args[1]), this;
		if (args.length < 2) throw new TypeError('Expected at least two arguments');
		const len = args.length - 2;
		let index = 0;
		let obj = this.meta;
		do {
			obj = obj[args[index]];
			if (obj == null || typeof obj !== 'object') {
				throw new TypeError(`Non-existent object path: meta.${args.slice(0, -1).map(String).join('.')}`);
			}
		} while (++index < len)
		obj[args[index]] = args[index + 1];
		return this;
	}
	[inspect.custom]() {
		const ret = new RequestInspection;
		for (const [key, value] of Object.entries(this)) ret[key] = value;
		return ret;
	}
}

const RequestInspection = class Request {};
module.exports = Request;
