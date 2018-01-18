'use strict';
const { TLSSocket } = require('tls');
const { parse } = require('url');

let currentRequest;
let currentLocation;

module.exports = (req, res) => {
  if (req === currentRequest) return currentLocation;
  const location = parse(req.url, false, true);
  const protocol = location.protocol;
  if (protocol !== null && protocol !== 'http:') {
    if (protocol !== 'https:') {
      res.writeHead(400, 'Invalid protocol in Request-URI');
      res.end();
      return;
    }
    if (!(req.socket instanceof TLSSocket)) {
      res.writeHead(400, 'Requested https on an http connection');
      res.end();
      return;
    }
  }
  currentRequest = req;
  currentLocation = location;
  return location;
};
