'use strict';

/*
	A ReadOnlyMap is just like a regular Map except it cannot be mutated.
 */

class ReadOnlyMap extends Map {
	constructor() {
		super(...arguments);
		Object.freeze(this);
	}
	set() {
		if (Object.isFrozen(this)) throw new TypeError('This map object is read-only');
		return super.set(...arguments);
	}
	delete() {
		throw new TypeError('This map object is read-only');
	}
	clear() {
		throw new TypeError('This map object is read-only');
	}
}

module.exports = ReadOnlyMap;
