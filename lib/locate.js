'use strict';
const parse = require('request-target');
let currentRequest = {};
let currentLocation = {};

/*
	A wrapper around request-target that caches the most recently parsed url.
 */

module.exports = (req) => {
	if (req === currentRequest) return currentLocation;
	if (req.url.length > 65527) return null; // Suspiciously long url
	const location = parse(req);
	if (!location) return null; // Invalid url
	currentRequest = req;
	return currentLocation = location;
};
