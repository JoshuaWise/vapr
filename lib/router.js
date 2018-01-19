'use strict';
const locate = require('./locate');
const statics = Symbol();
const dynamics = Symbol();
const missing = Symbol();

class Router {
  constructor(missingHandler, getKey, splitKey) {
    this[statics] = Object.create(null);
    this[dynamics] = newNode();
    this[missing] = missingHandler;
    return Object.setPrototypeOf(makeHandler(this, getKey, splitKey), this);
  }
}

const newNode = (parentNode) => ({
  children: Object.create(null),
  parent: parentNode,
  wild: undefined,
  exit: undefined,
});

const makeHandler = (router, getKey, splitKey) => (req, res) => {
  const key = getKey(req, res);
  if (!key) return void router[missing](req, res);
  const handler = router[statics][key];
  if (handler && handler(req, res)) return;
  const parts = splitKey(key);
  if (!parts) return void router[missing](req, res);
  dynamicHandler(router[dynamics], parts, router, req, res);
};

const dynamicHandler = (node, parts, router, req, res) => {
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
