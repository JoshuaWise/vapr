'use strict';
const { TLSSocket } = require('tls');
let currentRequest = {};
let currentLocation = {};

// request-target: https://tools.ietf.org/html/rfc7230#section-5.3
const requestTarget = /^(?:(?:(https?):\/\/|(?=[^/?*]+$))((?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)|(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z](?:[a-z\d-]{0,61}[a-z\d])?\.?)(?::([1-9]\d*|0)?)?(?!\*)|(?=[/*]))((?:\/(?:[\w.~:@!$&'()*+,;=-]|%[\da-f]{2})+)+\/?|\/|\*$)?(?:\?((?:[\w.~:@!$&'()*+,;=/?-]|%[\da-f]{2})*))?$/i;

module.exports = (req) => {
	let target;
	if (req === currentRequest) return currentLocation;
	if (req.url.length > 2048) return; // Suspiciously long url
	if (!(target = req.url.match(requestTarget))) return; // Invalid url
	
	let [,scheme = '', host = '', port = '', path = '', query = ''] = target;
	const isSecure = req.socket instanceof TLSSocket;
	
	if (scheme) {
		scheme = scheme.toLowerCase();
		if (!path) path = req.method === 'OPTIONS' ? '*' : '/';
	} else if (!host) {
		scheme = isSecure ? 'https' : 'http';
		const hostport = getHostHeader(req);
		if (!hostport) return; // Invalid Host header
		[,host = '', port = ''] = hostport;
	}
	
	if (port && +port > 65535) return; // Invalid port number
	if (host) {
		if (host.length > (host.charCodeAt(host.length - 1) === 46 ? 255 : 254)) return; // Domain Names: https://tools.ietf.org/html/rfc1123#section-2
		if (!port) port = isSecure ? '443' : '80';
		host = host.toLowerCase();
	}
	
	currentRequest = req;
	return currentLocation = { scheme, host, port, path, query };
};

const hostHeader = /^(?:((?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)|(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)*[a-z](?:[a-z\d-]{0,61}[a-z\d])?\.?)(?::([1-9]\d*|0)?)?)?\s*$/i;
const noHostHeader = ''.match(hostHeader);
const getHostHeader = req => req.headers.host ? req.headers.host.match(hostHeader) : noHostHeader;
