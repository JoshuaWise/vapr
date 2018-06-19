'use strict';
const http = require('http');
const https = require('https');
const Promise = require('wise-promise');
const ApplicationResource = require('./application-resource');
const HostRouter = require('../routers/host-router');
const PathRouter = require('../routers/path-router');
const Route = require('../route');
const settings = Symbol();

/*
	This is the package's main export. An Application behaves as either a
	PathRouter or a HostRouter. In the latter case, each host has its own child
	Application for defining path-based routes. As a path-based router, each
	path is defined by an ApplicationResource (which is just a wrapper around
	MethodRouter). If a resource only has one method, shorthand functions can be
	used directly on the Application object (e.g., get(), post(), etc.).
	
	When defining routes (such as with get(), post(), noHost(), or notFound()),
	instead of providing a raw http.Server handler function, any number of Route
	handlers (or arrays of such) may be provided. These handlers will be passed
	directly to the use() method of the Route object which is then returned.
	
	An options object may be passed to the Application constructor. This object
	will then be propagated to the constructor of each of the routers and Route
	objects that are created within the Application.
 */

class Application {
	constructor(options) {
		if (options == null) options = undefined;
		else if (typeof options !== 'object') throw new TypeError('Expected options to be an object');
		this[settings] = { options, router: undefined };
		return Object.setPrototypeOf(makeApplication(this[settings]), this);
	}
	host(hostport) {
		const router = useHostRouter(this[settings]);
		const child = new Application(this[settings].options);
		router.host(hostport, child);
		return child;
	}
	route(pathname) {
		const router = usePathRouter(this[settings]);
		const resource = new ApplicationResource(this[settings].options);
		router.route(pathname, resource);
		return resource;
	}
	noHost(...handlers) {
		const router = useHostRouter(this[settings]);
		const route = new Route(this[settings].options).use(...handlers);
		router.noHost(route);
		return route;
	}
	notFound(...handlers) {
		const router = usePathRouter(this[settings]);
		const route = new Route(this[settings].options).use(...handlers);
		router.notFound(route);
		return route;
	}
	get(pathname, ...handlers) { return this.route(pathname).get(...handlers); }
	post(pathname, ...handlers) { return this.route(pathname).post(...handlers); }
	put(pathname, ...handlers) { return this.route(pathname).put(...handlers); }
	patch(pathname, ...handlers) { return this.route(pathname).patch(...handlers); }
	delete(pathname, ...handlers) { return this.route(pathname).delete(...handlers); }
	head(pathname, ...handlers) { return this.route(pathname).head(...handlers); }
	options(pathname, ...handlers) { return this.route(pathname).options(...handlers); }
	trace(pathname, ...handlers) { return this.route(pathname).trace(...handlers); }
}

const makeApplication = (settings) => (req, res) => {
	if (!settings.router) req.destroy();
	else (0, settings.router)(req, res);
};

const useHostRouter = (settings) => {
	if (settings.router instanceof PathRouter) throw new TypeError('Cannot define a host-based route alongside path-based routes');
	return settings.router || (settings.router = new HostRouter(settings.options));
};

const usePathRouter = (settings) => {
	if (settings.router instanceof HostRouter) throw new TypeError('Cannot define a path-based route alongside host-based routes');
	return settings.router || (settings.router = new PathRouter(settings.options));
};

Object.setPrototypeOf(Application.prototype, Function.prototype);
module.exports = Application;
