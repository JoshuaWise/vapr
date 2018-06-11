'use strict';
const shared = require('../shared');
const statics = Symbol();
const dynamics = Symbol();
const missing = Symbol();

/*
	A generic router capable of handling both static and parameterized routes.
	
	Static routes are matched by performing a single hash lookup with the string
	key returned by getStaticKey(req). If an empty string is returned, the
	request is aborted. Static routes are prioritized over parameterized routes.
	
	Parameterized routes are matched by traversing a radix tree using an ordered
	array of strings returned by getDynamicKeys(key). If no array is returned,
	no route will be matched. If multiple routes could be matched, the winning
	route is the one with the most non-parameters earliest in the array.
	In the following example, the second route will be matched:
		GET /articles/123/images/header/1920x1080
		- ["GET", "articles", :id, "images", :name, "1920x1080"]
		- ["GET", "articles", :id, "images", "header", :size]
	
	If there are no matching routes, the missingHandler() is used.
 */

class Router {
	constructor(missingHandler, getStaticKey, getDynamicKeys) {
		this[statics] = new Map;
		this[dynamics] = newNode();
		this[missing] = { handler: missingHandler, changed: false };
		return Object.setPrototypeOf(makeRouter(this[statics], this[dynamics], this[missing], getStaticKey, getDynamicKeys), this);
	}
	[shared.addStaticRoute](key, handler) {
		if (this[statics].has(key)) return false; // Prevent duplicate routes
		this[statics].set(key, handler);
		return true;
	}
	[shared.addDynamicRoute](keys, handler) {
		let node = this[dynamics];
		for (const key of keys) {
			// An `undefined` represents parameterization (matches any string).
			if (key === undefined) node = node.wild || (node.wild = newNode(node));
			else node.children.set(key, node = node.children.get(key) || newNode(node));
		}
		if (node.exit) return false; // Prevent duplicate routes
		node.exit = handler;
		return true;
	}
	[shared.setMissingRoute](handler) {
		if (this[missing].changed) return false; // Only allow one invocation
		this[missing].changed = true;
		this[missing].handler = handler;
		return true;
	}
}

const newNode = (parentNode) => ({
	children: new Map,
	parent: parentNode,
	wild: undefined,
	exit: undefined,
});

const makeRouter = (statics, dynamics, missing, getStaticKey, getDynamicKeys) => (req, res) => {
	const key = getStaticKey(req);
	if (!key) return void req.destroy();
	const handler = statics.get(key);
	if (handler) return void handler(req, res);
	const keys = getDynamicKeys(key);
	(keys && dynamicHandler(dynamics, keys) || missing.handler)(req, res);
};

const dynamicHandler = (node, keys) => {
	const len = keys.length;
	let i = 0;
	search: for (;;) {
		attempt: {
			for (; i < len; ++i) {
				const key = keys[i];
				const nextNode = node.children.get(key);
				if (nextNode) node = nextNode;
				else if (node.wild && key) node = node.wild;
				else break attempt;
			}
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
