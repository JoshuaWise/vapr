'use strict';
const Promise = require('wise-promise');
const Headers = require('./headers');

/*
	Trailers are just like Headers except their values can also be promises.
 */

class Trailers extends Headers {
	set(name, value) {
		if (Promise.isPromise(value)) {
			value = Promise.resolve(value).catchLater();
			super.set(name, ''); // Validate the trailer name
			return set.call(this, name.toLowerCase(), value);
		}
		return super.set(name, value);
	}
}

const { set } = Map.prototype;
module.exports = Trailers;
