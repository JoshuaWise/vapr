'use strict';
const Application = require('./application/application');

module.exports = function vapr(options) { return new Application(options); };
module.exports.Application = Application;
module.exports.HostRouter = require('./routers/host-router');
module.exports.PathRouter = require('./routers/path-router');
module.exports.MethodRouter = require('./routers/method-router');
module.exports.Route = require('./route');
module.exports.Request = require('./state/request');
module.exports.Response = require('./state/response');
module.exports.Promise = require('wise-promise');
module.exports.River = require('wise-river');
try { require('wise-inspection')(require('wise-promise')); } catch (_) {}
