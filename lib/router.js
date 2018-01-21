'use strict';
const shared = require('./shared');
const statics = Symbol();
const dynamics = Symbol();
const missing = Symbol();

/*
	A generic router capable of handling both static and parameterized paths.
	The getKey(req) function should generate the key used for static resolution,
	and splitKey(key) should provide the keys used for parameterized resolution.
	If either of these functions return falsey values, no route will be matched.
	Route handlers should return true to indicate that the route was taken, or
	false to keep searching for another route.
 */

class Router {
	constructor(missingHandler, getKey, splitKey) {
		this[statics] = Object.create(null);
		this[dynamics] = newNode();
		this[missing] = missingHandler;
		return Object.setPrototypeOf(makeHandler(this, getKey, splitKey), this);
	}
	[shared.addStaticRoute](key, handler) {
		// TODO: protect against duplicates
		this[statics][key] = handler;
	}
	[shared.addDynamicRoute](keys, handler) {
		// TODO: protect against duplicates
		let node = this[dynamics];
		for (const part of keys) {
			if (part === '') node = node.wild || (node.wild = newNode(node));
			else node = node.children[part] || (node.children[part] = newNode(node));
		}
		node.exit = handler;
	}
	[shared.setMissingRoute](handler) {
		let self = this;
		// No properties are assigned directly to the router function.
		while (!self.hasOwnProperty(missing)) self = Object.getPrototypeOf(self);
		self[missing] = handler;
	}
}

const newNode = (parentNode) => ({
	children: Object.create(null),
	parent: parentNode,
	wild: undefined,
	exit: undefined,
});

const makeHandler = (router, getKey, splitKey) => (req, res) => {
	const key = getKey(req);
	if (!key) return void router[missing](req, res);
	const handler = router[statics][key];
	if (handler && handler(req, res)) return;
	const parts = splitKey(key);
	if (!parts) return void router[missing](req, res);
	dynamicHandler(router, parts, req, res);
};

const dynamicHandler = (router, parts, req, res) => {
	let node = router[dynamics];
	let i = parts.length;
	search: for (;;) {
		attempt: {
			while (--i >= 0) {
				const nextNode = node.children[parts[i]] || node.wild;
				if (nextNode) node = nextNode;
				else break attempt;
			}
			if (node.exit && node.exit(req, res)) return;
		}
		generalizing: while (node.parent) {
			while (node.parent.wild === node) {
				node = node.parent;
				i += 1;
				if (!node.parent) break generalizing;
			}
			node = node.parent;
			i += 1;
			if (node.wild) {
				node = node.wild;
				continue search;
			}
		}
		return void router[missing](req, res);
	}
};
