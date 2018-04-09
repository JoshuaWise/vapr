'use strict';
const Promise = require('wise-promise');
const Headers = require('./headers');

/*
	Trailers are just like Headers except their values can also be promises.
	TODO: make set() work with the automatic lowercasing of trailer names caused by Header class
 */

class Trailers extends Headers {
	set(name, value) {
		if (Promise.isPromise(value)) {
			value = Promise.resolve(value).catchLater();
			super.set(name, ''); // Validate the trailer name
			return set.call(this, name, value);
		}
		return super.set(name, value);
	}
}

const { set } = Map.prototype;
module.exports = Trailers;
