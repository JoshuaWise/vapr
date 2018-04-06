'use strict';
const { TLSSocket } = require('tls');
const { inspect } = require('util');
const River = require('wise-river');
const ReadOnlyMap = require('./read-only-map');
const shared = require('../shared');
const mut = Symbol();

/*
	The public interface for an incoming request. Since requests are immutable,
	the mutable request.meta object is reserved for application use. Purely for
	convenience, the get() and set() methods are provided to deeply access and
	mutate the request.meta object, respectively.
	TODO: when asynchronous iterators are in the LTS, the wise-* packages
	should be dropped in favor of dumb native objects.
	TODO: allow the sending of a 1xx status code
 */

class Request {
	constructor(req, location, params) {
		this.method = req.method;
		this.target = Object.freeze(location);
		this.params = params && Object.freeze(params);
		this.headers = makeHeaders(req.headers);
		this.version = req.httpVersion;
		this.secure = req.socket instanceof TLSSocket;
		this.meta = {};
		this[mut] = { raw: req, aborted: false, discarded: false, body: undefined };
		req.on('aborted', () => { this[mut].aborted = true; });
		Object.freeze(this);
	}
	get aborted() {
		return this[mut].aborted;
	}
	body() {
		const { [mut]: self } = this;
		if (self.body) return River.reject(new TypeError('The request body was already consumed'));
		if (self.discarded) return self.body = River.reject(new TypeError('The request body was discarded because a response was already sent'));
		if (self.aborted) return self.body = River.reject(new Error('The request was aborted'));
		return self.body = new River((resolve, reject, write) => {
			self.raw.on('data', write);
			self.raw.on('end', resolve);
			self.raw.on('aborted', () => reject(new Error('The request was aborted')));
		});
	}
	trailers() {
		const { [mut]: self } = this;
		if (!self.body) this.body().drain().catchLater();
		return self.body.then(() => makeHeaders(self.raw.trailers));
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
	[shared.discardBody]() {
		const { [mut]: self } = this;
		if (!self.body) {
			self.discarded = true;
			self.raw.resume(); // Ensure the request stream is consumed
		}
	}
	[inspect.custom]() {
		const ret = new RequestInspection;
		for (const [key, value] of Object.entries(this)) ret[key] = value;
		return ret;
	}
}

// TODO: this doesn't validate incomming header names or values
const makeHeaders = (obj) => {
	const headers = new ReadOnlyMap;
	for (const key of Object.keys(obj)) set.call(headers, key, obj[key].trim());
	return headers;
};

const { set } = Map.prototype;
const RequestInspection = class Request {};
module.exports = Request;
