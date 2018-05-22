'use strict';
const Promise = require('wise-promise');
const Headers = require('./headers');
const { hint } = require('../shared');

/*
	Trailers are just like Headers except their values can also be promises.
	Attempting to set a forbidden trailer field will throw an error.
 */

class Trailers extends Headers {
	set(name, value) {
		if (Promise.isPromise(value)) value = Promise.resolve(value).catchLater();
		else if (typeof value !== 'string') throw new TypeError(`Expected trailer value to be a string or promise ${hint(name)}`);
		if (typeof name !== 'string') throw new TypeError(`Expected trailer name to be a string ${hint(name)}`);
		name = name.toLowerCase();
		if (forbidden.has(name)) throw new TypeError(`Forbidden trailer name: ${name}`);
		return set.call(this, name, value);
	}
}

// https://tools.ietf.org/html/rfc7230#section-4.1.2
const forbidden = new Map([
	['transfer-encoding'],
	['content-length'],
	['host'],
	['www-authenticate'],
	['authorization'],
	['proxy-authenticate'],
	['proxy-authorization'],
	['set-cookie'],
	['content-encoding'],
	['content-type'],
	['content-range'],
	['trailer'],
	['age'],
	['cache-control'],
	['expires'],
	['date'],
	['location'],
	['retry-after'],
	['vary'],
	['warning'],
]);


const { set } = Map.prototype;
module.exports = Trailers;
