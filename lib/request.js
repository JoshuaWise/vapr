'use strict';
const Promise = require('wise-promise');
const River = require('wise-river');
const Response = require('./response');
const instance = Symbol();
const state = Symbol();
const body = Symbol();

class Request {
	constructor(req, location) {
		this[instance] = this; // Provides write access for the returned object
		this[state] = 0;
		this[body] = new River((resolve, reject, write) => {
			req.on('data', write);
			req.on('end', resolve);
			req.on('aborted', () => reject(new Error('The request was aborted')));
		});
		const trailers = new Promise((resolve, reject) => {
			req.on('end', () => resolve(Object.freeze(req.trailers)));
			req.on('aborted', () => reject(new Error('The request was aborted')));
		});
		const pub = Object.create(this);
		pub.method = req.method;
		pub.target = Object.freeze(location);
		pub.headers = Object.freeze(req.headers);
		pub.trailers = trailers.catchLater();
		pub.meta = {};
		return Object.freeze(pub);
	}
	raw() {
		if (this[state] !== 0) return River.reject(new TypeError('The request body was already consumed'));
		const data = this[body];
		this[instance][body] = null;
		this[instance][state] = 1;
		return data;
	}
	body() {
		if (this[state] === 2) return this[body];
		if (this[state] !== 0) return Promise.reject(new TypeError('The request body was already consumed'));
		this[instance][state] = 2;
		return this[instance][body] = this[body].all().then(Buffer.concat); // TODO: support plugin content types
	}
	set(...args) {
		if (args.length === 2) {
			this.meta[args[0]] = args[1];
			return this;
		}
		if (args.length < 2) {
			throw new TypeError('Expected at least two arguments');
		}
		const len = args.length - 2;
		let index = 0;
		let obj = this.meta;
		do {
			obj = obj[args[index]];
			if (obj == null || typeof obj !== 'object') {
				throw new TypeError(`Non-existent object path: meta.${args.slice(0, -2).map(String).join('.')}`);
			}
		} while (index < len)
		obj[args[index]] = args[index + 1];
		return this;
	}
	respond() {
		return new Response(...arguments);
	}
}

module.exports = Request;
