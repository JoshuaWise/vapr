'use strict';
const Application = require('./lib/application/application');

module.exports = function vapr(options) { return new Application(options); };
module.exports.Application = Application;
module.exports.HostRouter = require('./lib/routers/host-router');
module.exports.PathRouter = require('./lib/routers/path-router');
module.exports.MethodRouter = require('./lib/routers/method-router');
module.exports.Route = require('./lib/route');
module.exports.Request = require('./lib/state/request');
module.exports.Response = require('./lib/state/response');
module.exports.Promise = require('wise-promise');
module.exports.River = require('wise-river');
try { require('wise-inspection')(require('wise-promise')); } catch (_) {}