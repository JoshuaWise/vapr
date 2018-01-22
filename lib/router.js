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
 */

class Router {
	constructor(missingHandler, getKey, splitKey) {
		this[statics] = Object.create(null);
		this[dynamics] = newNode();
		this[missing] = missingHandler;
		return Object.setPrototypeOf(makeHandler(this, getKey, splitKey), this);
	}
	[shared.addStaticRoute](key, handler) {
		if (this[statics][key]) return false;
		this[statics][key] = handler;
		return true;
	}
	[shared.addDynamicRoute](keys, handler) {
		let node = this[dynamics];
		for (const key of keys) {
			if (key === undefined) node = node.wild || (node.wild = newNode(node));
			else node = node.children[key] || (node.children[key] = newNode(node));
		}
		if (node.exit) return false;
		node.exit = handler;
		return true;
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
	if (handler) return void handler(req, res);
	const keys = splitKey(key);
	(keys && dynamicHandler(router[dynamics], keys) || router[missing])(req, res);
};

const dynamicHandler = (node, keys) => {
	const len = keys.length;
	let i = 0;
	search: for (;;) {
		attempt: {
			for (; i < len; ++i) {
				const key = keys[i];
				const nextNode = node.children[key];
				if (nextNode) node = nextNode;
				else if (node.wild && key) node = node.wild;
				else break attempt;
			}
			// TODO: propagate parameter values in key
			if (node.exit) return node.exit;
		}
		while (node.parent) {
			while (node.parent.wild === node) {
				node = node.parent;
				i -= 1;
				if (!node.parent) return;
			}
			node = node.parent;
			if (node.wild) {
				node = node.wild;
				continue search;
			}
			i -= 1;
		}
		return;
	}
};

Object.setPrototypeOf(Router.prototype, Function.prototype);
module.exports = Router;
