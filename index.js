'use strict';
const PathRouter = require('./lib/routers/path-router');
const HostRouter = require('./lib/routers/host-router');
const MethodRouter = require('./lib/routers/method-router');
const Route = require('./lib/route');

module.exports = PathRouter;
module.exports.HostRouter = HostRouter;
module.exports.MethodRouter = MethodRouter;
module.exports.Route = Route;
try { require('wise-inspection')(require('wise-promise')); } catch (_) {}
