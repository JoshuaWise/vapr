'use strict';
const PathRouter = require('./lib/path-router');
const HostRouter = require('./lib/host-router');
const MethodRouter = require('./lib/method-router');

module.exports = PathRouter;
module.exports.HostRouter = HostRouter;
module.exports.MethodRouter = MethodRouter;
try { require('wise-inspection')(require('wise-promise')); } catch (_) {}
