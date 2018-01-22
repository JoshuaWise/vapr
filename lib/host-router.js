'use strict';
const { TLSSocket } = require('tls');
const Router = require('./router');
const locate = require('./locate');
const shared = require('./shared');

/*
	A router for specializing between hostnames, and optionally ports as well.
	TODO: If a hostname is registered without a port, it can only be matched when the
	actual connection's port matches the Request-URI (or Host header) port.
	(or) TODO: make a wild port be explicit, having an empty port be wild plus requiring it to match localPort
 */

class HostRouter extends Router {
	constructor() {
		super(badGateway, getKey, splitKey);
	}
	host(domain, handler) {
		if (typeof domain !== 'string') throw new TypeError('Expected hostname to be a string');
		if (typeof handler !== 'function') throw new TypeError('Expected host handler to be a function');
		if (!validDomain.test(domain)) throw new TypeError(`Invalid hostname: ${domain}`);
		domain = domain.toLowerCase();
		const [hostname, port] = domain.split(':');
		if (port) {
			if (port > 65535) throw new TypeError(`Invalid port number: ${port}`);
			if (!hostname.includes('*')) {
				if (this[shared.addStaticRoute](domain, handler)) {
					// Make an alias for requests that include the root domain.
					this[shared.addStaticRoute](`${hostname}.:${port}`, handler);
					return this;
				}
				throw new TypeError(`Duplicate host: ${domain}`);
			}
		}
		const keys = hostname.split('.').reverse().map(s => s === '*' ? undefined : s).concat(port);
		if (this[shared.addDynamicRoute](keys, handler)) return this;
		throw new TypeError(`Duplicate host: ${domain}`);
	}
	noHost(handler) {
		this[shared.setMissingRoute](handler);
		return this;
	}
}

const getKey = (req) => {
	// TODO: port numbers starting with "0"s will be different from their regular representation.
	const location = locate(req);
	if (location.host) return location.port ? location.host : location.host + defaultPort(req);
	let key = (req.headers.host || '').toLowerCase();
	if (!key) return '';
	const lastChar = key.charCodeAt(key.length - 1);
	if (lastChar < 33 || lastChar > 126) {
		key = key.trimRight();
		if (!key) return '';
	}
	if (!key.includes(':')) key += defaultPort(req);
	return key;
};

const splitKey = (key) => {
	if (key.length > 261 || !validHost.test(key)) return;
	const [hostname, port] = key.split(':');
	if (port > 65535) return;
	const keys = hostname.split('.');
	if (!keys[keys.length - 1]) {
		keys.pop(); // Ignore the root domain
		if (hostname.length > 255) return;
	} else if (hostname.length > 254) {
		return;
	}
	keys.reverse();
	keys.push(port);
	return keys;
};

const badGateway = (req, res) => { res.writeHead(502); res.end(); };
const defaultPort = req => req.socket instanceof TLSSocket ? ':443' : ':80';
const validDomain = /^(?=[^:]{1,254}(?::|$))(?:(?:\*|[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?!$)|(?::\d+)?$)){2,}$/i;
const validHost = /^(?:[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.|(?=:))){2,}:\d{1,5}$/i;
module.exports = HostRouter;
