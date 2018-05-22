'use strict';
exports.addStaticRoute = Symbol();
exports.addDynamicRoute = Symbol();
exports.setMissingRoute = Symbol();
exports.discardBody = Symbol();
exports.settings = Symbol(); // Only for Route class -- used for ducktyping
exports.params = null;

exports.hint = (value) => {
  if (value === null) return '(got null)';
  if (typeof value !== 'object') return `(got ${typeof value})`;
  const proto = Object.getPrototypeOf(value);
  if (proto === null) return '(got object)';
  if (typeof proto.constructor !== 'function') return '(got unknown class)';
  if (typeof proto.constructor.name !== 'string') return '(got unknown class)';
  if (!proto.constructor.name) return '(got anonymous class)';
  if (proto.constructor.name === 'Object') return '(got object)';
  return `(got ${proto.constructor.name})`;
};
