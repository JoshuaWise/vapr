'use strict';
const Router = require('./router');
const locate = require('./locate');
const shared = require('./shared');

/*
	A router for specializing between hostnames and ports.
	Options:
		"defaultPort": the implied port when no port is provided to #host().
		               (defaults to 80, so set this to 443 when using HTTPS)
	Examples:
		router.host('mywebsite.com', fn);
		router.host('www.mywebsite.com', fn);
		router.host('*.mywebsite.com:8080', fn);
		router.host('this.accepts.anyport:*', fn);
		router.host('foo.*.*', fn);
		router.host('192.168.1.254', fn);
		router.noHost(fn); // This is used when no host is matched
 */

class HostRouter extends Router {
	constructor({ defaultPort = 80 } = {}) {
		if (typeof defaultPort !== 'number') throw new TypeError('Expected defaultPort to be a number');
		if (defaultPort >>> 0 !== defaultPort || defaultPort > 65535) throw new TypeError(`Invalid default port: ${defaultPort}`);
		super(badGateway, getStaticKey, getDynamicKeys);
		defaultPorts.set(this, ':' + defaultPort);
	}
	host(hostport, handler) {
		if (typeof hostport !== 'string') throw new TypeError('Expected hostname to be a string');
		if (typeof handler !== 'function') throw new TypeError('Expected host handler to be a function');
		if (!validRoute.test(hostport)) throw new TypeError(`Invalid hostname: ${hostport}`);
		if (!hostport.includes(':')) hostport += defaultPorts.get(this);
		hostport = hostport.toLowerCase(); // Hostnames are never case-sensitive
		const [hostname, port] = hostport.split(':');
		if (+port > 65535) throw new RangeError(`Invalid port number: ${port}`);
		if (!hostport.includes('*')) {
			if (this[shared.addStaticRoute](hostport, handler)) {
				// Make an alias for requests that include the root domain.
				if (notIP(hostname)) this[shared.addStaticRoute](`${hostname}.:${port}`, handler);
				return this;
			}
		} else {
			const keys = [...hostname.split('.').reverse(), port].map(s => s === '*' ? undefined : s);
			if (this[shared.addDynamicRoute](keys, handler)) return this;
		}
		throw new TypeError(`Duplicate host: ${hostport}`);
	}
	noHost(handler) {
		if (typeof handler !== 'function') throw new TypeError('Expected noHost handler to be a function');
		if (this[shared.setMissingRoute](handler)) return this;
		throw new TypeError('A noHost handler was already set on this router');
	}
}

const getStaticKey = (req) => {
	const location = locate(req);
	if (!location) return '';
	if (wontMatch(location.hostname)) return '.0'; // Bypass unsupported hosts
	return `${location.hostname}:${location.port}`;
};

const getDynamicKeys = (key) => {
	const [hostname, port] = key.split(':');
	if (!notIP(hostname)) return; // IP addresses cannot be parameterized
	const keys = hostname.split('.');
	if (!keys[keys.length - 1]) keys.pop(); // Ignore the root domain
	keys.reverse();
	keys.push(port);
	return keys;
};

const badGateway = (req, res) => { res.writeHead(502); res.end(); };
const wontMatch = s => !s || s.charCodeAt(0) === 91;
const notIP = (s) => { const i = s.lastIndexOf('.'); return i === -1 || i === s.length - 1 || s.charCodeAt(i + 1) > 64; };
const validRoute = /^(?=[^:]{1,254}(?::|$))(?:(?:(?:\*|[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)\.)*(?:\*|[a-z](?:[a-z\d-]{0,61}[a-z\d])?)(?::(?:\*|[1-9]\d*|0))?|(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?::(?:[1-9]\d*|0))?)$/i;
const defaultPorts = new WeakMap;
module.exports = HostRouter;
