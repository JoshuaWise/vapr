'use strict';
const ApplicationResource = require('./application-resource');
const HostRouter = require('../routers/host-router');
const PathRouter = require('../routers/path-router');
const Route = require('../route');
const settings = Symbol();

class Application {
	constructor(options) {
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
		const resource = new ApplicationResource;
		router.route(pathname, resource);
		return resource;
	}
	noHost(...handlers) {
		const router = useHostRouter(this[settings]);
		const route = new Route().use(...handlers);
		router.noHost(route);
		return route;
	}
	notFound(...handlers) {
		const router = usePathRouter(this[settings]);
		const route = new Route().use(...handlers);
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
