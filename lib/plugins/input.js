'use strict';
const { parse: getContentType } = require('content-type');
const Promise = require('wise-promise');
const Request = require('../state/request');
const parser = Symbol();
const parsed = Symbol();

/*
	This plugin is constructed by passing an object that maps media types (e.g.,
	"application/json") to parsing functions. Each parsing function takes a river
	of buffers, and should return a promise (or river) for the parsed value. If
	there is no parser matching a request's "content-type" header, a 415 error
	will be triggered. A "default" parser may be provided, which will be used when
	no other media type is matched.
	
	For the sake of simplicity and security concerns, if any charset is provided
	besides utf-8 or us-ascii, a 415 error will be triggered.
	
	When this plugin is used on a route, that route's Request object will have a
	new method available called body(). The body() method returns a promise for
	the parsed request body. The body() method may be called multiple times, in
	which case the same promise is returned every time.
 */

module.exports = (parsers) => {
	if (!isObject(parsers)) throw new TypeError('Expected input parsers to be an object');
	if (!Object.values(parsers).every(isFunction)) throw new TypeError('Expected each input parser to be a function');
	parsers = new Map(Object.entries(parsers));
	
	// Handle the "default" key specially.
	const defaultParser = parsers.get('default');
	parsers.delete('default');
	
	// Return the parameterized plugin.
	return { before: (req, res) => {
		const header = req.headers.get('content-type');
		let contentType;
		if (header) {
			let type, charset;
			try {
				const obj = getContentType(header);
				type = obj.type;
				charset = obj.parameters.charset;
			} catch (_) {
				return 415;
			}
			if (charset && !supportedCharsets.has(charset.toLowerCase())) return 415;
			contentType = type;
		} else {
			// Default to octet-stream (https://tools.ietf.org/html/rfc7231#section-3.1.1.5).
			contentType = 'application/octet-stream';
		}
		const parserFunction = parsers.get(contentType) || defaultParser;
		if (!parserFunction) return 415;
		req.meta[parser] = parserFunction;
	} };
};

function body() {
	const { meta: self } = this;
	if (self[parsed]) return self[parsed];
	if (!self[parser]) return noPlugin.call(this);
	try {
		let result = self[parser](this.read());
		if (!(result instanceof Promise)) result = Promise.resolve(result);
		return self[parsed] = result;
	} catch (err) {
		return self[parsed] = Promise.reject(err);
	}
}

const supportedCharsets = new Map([
	['utf-8'],
	['utf8'],
	['unicode-1-1-utf-8'],
	['us-ascii'],
]);

const isObject = x => typeof x === 'object' && x !== null;
const isFunction = x => typeof x === 'function';
const noPlugin = Request.prototype.body;
Object.defineProperty(Request.prototype, 'body', {
	configurable: true,
	writable: true,
	value: body,
});
