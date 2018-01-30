'use strict';
const Promise = require('wise-promise');
const River = require('wise-river');
const river = Symbol();

class Request {
  constructor(req, location) {
	this.method = req.method;
	this.target = location;
	this.headers = Object.freeze(req.headers);
	this.trailers = new Promise((resolve, reject) => {
		req.on('end', () => resolve(Object.freeze(req.trailers)));
		req.on('aborted', () => reject(new Error('The request was aborted')));
	});
	this.meta = {};
	Object.defineProperty(this, river, { value: new River((resolve, reject, write) => {
		req.on('data', write);
		req.on('end', resolve);
		req.on('aborted', () => reject(new Error('The request was aborted')));
	}) });
	this.trailers.catchLater();
	Object.freeze(this);
  }
  // get body() {
  //   if (this[body]) return this[body];
  //   return this[body] = this.data.all().then(chunks => Buffer.concat(chunks));
  // }
}

module.exports = Request;
