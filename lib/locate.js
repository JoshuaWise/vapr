'use strict';
const parse = require('parse-http-url');
let currentRequest = {};
let currentLocation = {};

module.exports = (req) => {
	if (req === currentRequest) return currentLocation;
	if (req.url.length > 2048) return null; // Suspiciously long url
	const location = parse(req);
	if (!location) return null; // Invalid url
	currentRequest = req;
	return currentLocation = location;
};
