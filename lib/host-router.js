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
		if (!validDomain.test(domain)) throw new TypeError(`Invalid hostname: ${domain}`);
		domain = domain.toLowerCase();
		const [hostname, port = ''] = domain.split(':');
		if (port) {
			if (port > 65535) throw new TypeError(`Invalid port number: ${port}`);
			if (!hostname.includes('*')) {
				if (this[shared.addStaticRoute](domain, handler)) {
					this[shared.addStaticRoute](`${hostname}.:${port}`, handler);
					return this;
				}
				throw new TypeError(`Duplicate host: ${domain}`);
			}
		}
		const keys = hostname.split('.').reverse().map(s => s === '*' ? '' : s).concat(port);
		if (this[shared.addDynamicRoute](keys, handler)) return this;
		throw new TypeError(`Duplicate host: ${domain}`);
		// TODO: for wild port keys, maybe ensure the provided port matches the localPort
	}
	noHost(handler) {
		this[shared.setMissingRoute](handler);
		return this;
	}
}

const getKey = (req) => {
	const location = locate(req);
	// Use the host in the Request-URI, if given.
	let host = location.host;
	if (host) {
		if (!location.port) host += defaultPort(req);
		return host;
	}
	// Otherwise, use the Host header.
	host = req.headers.host;
	if (!host) return '';
	// Trim trailing whitespace from the Host header.
	const lastChar = host.charCodeAt(host.length - 1);
	if (lastChar < 33 || lastChar > 126) {
		host = host.trimRight();
		if (!host) return '';
	}
	// Hostnames are always case-insensitive.
	host = host.toLowerCase();
	if (!host.includes(':')) host += defaultPort(req);
	return host;
};

// TODO
// TODO: ensure dynamic routes work with hostnames that end with "."
const splitKey = (key) => {
	const [hostname, port, invalid] = key.split(':');
	if (invalid || !port || !validPort.test(port)) return;
	// const keys = hostname.split('.');
	// // A trailing dot after the hostname can be ignored.
	// if (!keys[keys.length - 1]) keys.pop();
	// // Ensure each subdomain is non-empty and does not start with a digit.
	// for (const subdomain of keys) {
	// 	if (!subdomain || isDigit(subdomain.charCodeAt(0))) return;
	// }
	// // Ensure the port number starts with a digit.
	// if (!isDigit(port.charCodeAt(0))) return;
	// keys.reverse();
	// keys.push(port);
	// return keys;
};

const badGateway = (req, res) => { res.writeHead(502); res.end(); };
const defaultPort = req => req.socket instanceof TLSSocket ? ':443' : ':80';
const validDomain = /^(?=.{1,255}(?::|$))(?:(?=[^.:]{1,63}(?:[.:]|$))(?:\*|[a-z](?:[a-z0-9-]*[a-z0-9])?)(?:(?::\d+)?$|\.(?!$))){2,}$/i;
const validPort = /^\d+$/;
