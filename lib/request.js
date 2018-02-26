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

 // TODO: Dont create trailers promise unless accessed (or inspected), but
 //       protect against race conditions caused by listening on events too late.
 //       Also, the returned promise should not be handled even if inspected.
class Request {
	constructor(req, location) {
		const body = new River((resolve, reject, write) => {
			req.on('data', write);
			req.on('end', resolve);
			req.on('aborted', () => reject(new Error('The request was aborted')));
		});
		const trailers = new Promise((resolve, reject) => {
			req.on('end', () => resolve(Object.freeze(req.trailers)));
			req.on('aborted', () => reject(new Error('The request was aborted')));
		});
		this.method = req.method;
		this.target = Object.freeze(location);
		this.headers = Object.freeze(req.headers);
		this.trailers = trailers.catchLater();
		this.meta = {};
		this[mut] = { body };
		Object.freeze(this);
	}
	body() {
		const body = this[mut].body;
		if (!body) return River.reject(new TypeError('The request body was already consumed'));
		this[mut].body = null;
		return body;
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
