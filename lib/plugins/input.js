'use strict';
const Promise = require('wise-promise');
const Request = require('../state/request');
const parser = Symbol();
const parsed = Symbol();
// TODO: these symbols will be visible because meta is a regular object

module.exports = (parsers) => {
	if (!isObject(parsers)) throw new TypeError('Expected input parsers to be an object');
	if (!Object.values(parsers).every(isFunction)) throw new TypeError('Expected each input parser to be a function');
	parsers = Object.assign({}, parsers);
	return { before: (req, res) => {
		const contentType = req.headers.get('content-type');
		// TODO: if contentType is undefined, throw a 400 when body() is invoked? throw a 400 requiring a body? generate a default?
		//       if contentType matches a defined parser, store that parser
		//       if contentType matches nothing, throw a 415
		// TODO: maybe disable read()?
	} };
};

function body() {
	const { meta: self } = this;
	if (self[parsed] !== undefined) return self[parsed];
	if (self[parser] === undefined) return noPlugin.call(this);
	try {
		let result = self[parser](this.read());
		if (!(result instanceof Promise)) result = Promise.resolve(result);
		return self[parsed] = result;
	} catch (err) {
		return self[parsed] = Promise.reject(err);
	}
}

const isObject = x => typeof x === 'object' && x !== null;
const isFunction = x => typeof x === 'function';
const noPlugin = Request.prototype.body;
Object.defineProperty(Request.prototype, 'body', {
	configurable: true,
	writable: true,
	value: body,
});
