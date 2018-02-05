'use strict';
const Promise = require('wise-promise');
const River = require('wise-river');
const instance = Symbol();
const body = Symbol();

class Request {
	constructor(req, location) {
		this[instance] = this;
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
	// stream() {
	// 	if (this[type] !== undefined) throw new TypeError('The request body was already consumed');
	// 	const river = this[body];
	// 	this[instance][body] = null;
	// 	this[instance][type] = stream;
	// 	return river;
	// }
	// raw() { return consume(this, identity, raw); }
	// json() { return consume(this, toJSON, json); }
}

module.exports = Request;
