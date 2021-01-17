'use strict';
const parse = require('request-target');
let currentRequest = {};
let currentLocation = {};

/*
	A wrapper around request-target that caches the most recently parsed url.
	If the request-target is invalid, an appropriate response will be sent and
	null will be returned.
 */

module.exports = (req, res) => {
	if (req === currentRequest) {
		return currentLocation;
	}

	// Suspiciously long url
	if (req.url.length > 16384) {
		res.writeHead(414, { 'content-length': '0', 'connection': 'close' });
		res.end();
		return null;
	}

	const location = parse(req);

	// Invalid url
	if (!location) {
		res.writeHead(400, { 'content-length': '0', 'connection': 'close' });
		res.end();
		return null;
	}

	currentRequest = req;
	return currentLocation = location;
};
