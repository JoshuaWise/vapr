'use strict';
const PathRouter = require('./lib/path-router');
const HostRouter = require('./lib/host-router');

// TODO: maybe things like HEAD, OPTIONS, TRACE, or CONNECT should be handled differently
// for (const m of ['GET', 'CONNECT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE']) {
// 	const fn = function (pathname, handler) { return this.define(m, pathname, handler) };
// 	const name = m.toLowerCase();
// 	Object.defineProperty(fn, 'name', Object.assign(Object.getOwnPropertyDescriptor(fn, 'name'), { value: name }));
// 	Object.defineProperty(PathRouter.prototype, name, { value: fn, writable: true, enumerable: false, configurable: true });
// }

module.exports = PathRouter;
module.exports.HostRouter = HostRouter;
