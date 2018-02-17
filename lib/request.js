'use strict';
const Promise = require('wise-promise');
const River = require('wise-river');
const stream = Symbol();

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
		Object.defineProperty(this, stream, { value: body, writable: true });
		this.method = req.method;
		this.target = Object.freeze(location);
		this.headers = Object.freeze(req.headers);
		this.trailers = trailers.catchLater();
		this.meta = {};
		Object.freeze(this);
	}
	body() {
		if (!this[stream]) return River.reject(new TypeError('The request body was already consumed'));
		const body = this[stream];
		this[stream] = null;
		return body;
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
}

module.exports = Request;
