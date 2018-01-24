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
		if (!validRoute.test(domain)) throw new TypeError(`Invalid hostname: ${domain}`);
		domain = domain.replace(leadingZeros, ':').toLowerCase();
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

// TODO: deal with leading zeros in IP addresses
const getKey = (req) => {
	const location = locate(req);
	if (location.host) {
		if (!location.port) return location.host + defaultPort(req);
		if (location.port.charCodeAt(0) !== 48 || location.port.length === 1) return location.host;
		return location.host.replace(leadingZeros, ':');
	}
	let key = (req.headers.host || '').toLowerCase();
	if (!key) return '';
	const lastChar = key.charCodeAt(key.length - 1);
	if (lastChar < 33 || lastChar > 126) {
		key = key.trimRight();
		if (!key) return '';
	}
	const index = key.indexOf(':');
	if (index === -1) return key + defaultPort(req);
	if (key.length < index + 3 || key.charCodeAt(index + 1) !== 48) return key;
	return key.replace(leadingZeros, ':');
};

// TODO: could a numeric-looking subdomain cause a false resolution of a port? or vice-verse?
const splitKey = (key) => {
	if (key.length > 261 || !validDynamicKey.test(key)) return;
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
const leadingZeros = /:0+(?!$)/;
const validRoute = /^(?=[^:]{1,254}(?::|$))(?:(?:(?:\*|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.)+(?:\*|[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?)|\d+\.\d+\.\d+\.\d+)(?::\d+)?$/i
const validDynamicKey = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?\.?:\d{1,5}$/i;
module.exports = HostRouter;
