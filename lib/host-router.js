'use strict';
const { TLSSocket } = require('tls');
const Router = require('./router');
const locate = require('./locate');
const shared = require('./shared');

/*
	A router for specializing between hostnames, and optionally ports as well.
	If a hostname is registered without a port, it can only be matched when the
	actual connection's port matches the Request-URI (or Host header) port.
 */

class HostRouter extends Router {
	constructor() {
		super(badGateway, getKey, splitKey);
	}
	host(domain, handler) {
		if (typeof domain !== 'string') throw new TypeError('Expected hostname to be a string');
		if (typeof handler !== 'function') throw new TypeError('Expected host handler to be a function');
		if (invalidDomain.test(domain)) throw new TypeError(`Invalid hostname: ${domain}`);
		const [hostname, port] = domain.split(':');
		// TODO: allow multiple handlers on one hostname, but different ports
		const wrapper = wrap(handler, port ? +port : -1);
		if (!hostname.includes('*')) this[shared.addStaticRoute](hostname, wrapper);
		else this[shared.addDynamicRoute](hostname.split('.').reverse(), wrapper);
		return this;
	}
	noHost(handler) {
		this[shared.setMissingRoute](handler);
		return this;
	}
}

// TODO
const wrap = (handler, port) => {
	if (port >> 0 !== port || port > 65535) throw new TypeError(`Invalid port number: ${port}`);
	if (port !== -1) return (req, res) => req.key.port === port && (handler(req, res), true);
	return (req, res) => req.key.port === req.socket.localPort && (handler(req, res), true);
};

const getKey = (req) => {
	const location = locate(req);
	let hostname;
	let port;
	if (location.hostname) {
		// Use the host in the Request-URI, if given.
		hostname = location.hostname;
		port = location.port === null ? defaultPort(req) : +location.port;
	} else {
		// Otherwise, use the Host header.
		hostname = req.headers.host;
		if (!hostname) return '';
		const index = hostname.indexOf(':');
		if (index === -1) {
			port = defaultPort(req);
			// Explicitly trim trailing whitespace from the Host header.
			const lastChar = hostname.charCodeAt(hostname.length - 1);
			if (lastChar < 33 || lastChar > 126) {
				hostname = hostname.trimRight();
				if (!hostname) return '';
			}
		} else if (index !== 0) {
			// Trailing whitespace is implicitly trimmed here.
			port = +hostname.slice(index + 1);
			if (port >>> 0 !== port || port > 65535) return '';
			hostname = hostname.slice(0, index);
		} else {
			return '';
		}
		// Hostnames are always case-insensitive.
		hostname = hostname.toLowerCase();
	}
	// Leading and trailing dots in a hostname are forgiven.
	if (hostname.charCodeAt(0) === 46 || hostname.charCodeAt(hostname.length - 1) === 46) {
		hostname = hostname.replace(/^\.+|\.+$/g, '');
		if (!hostname) return '';
	}
	return hostname; // TODO: propagate parsed port for later use
};

const splitKey = key => key.includes('..') ? undefined : key.split('.');
const badGateway = (req, res) => { res.writeHead(502); res.end(); };
const defaultPort = req => req.socket instanceof TLSSocket ? 443 : 80;
const invalidDomain = /^$|^[.:]|\.[.:]|\.$|[?#@/\s]|[^.]\*|\*[^.:]|:(?!\d+$)/;
