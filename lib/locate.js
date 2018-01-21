'use strict';
const { parse } = require('url');
let currentRequest = {};
let currentLocation = {};

module.exports = (req) => {
  if (req === currentRequest) return currentLocation;
  const location = parse(req.url, false, true);
  currentRequest = req;
  currentLocation = location;
  return location;
};
