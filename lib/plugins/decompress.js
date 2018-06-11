'use strict';
const { createGunzip, createInflate } = require('zlib');
const River = require('wise-river');
const Request = require('../state/request');
const decodePlan = Symbol();

/*
	This plugin decompresses the request body as it is read. It supports both the
	content-encoding and transfer-encoding headers, and it recognizes "gzip",
	"deflate", and "identity" encodings. If an unrecognized encoding is received,
	a 501 or 415 error will be triggered, as recommended in RFC 7230 and RFC 7231.
	When the plugin is constructed, an options object can be provided which will
	be passed to the zlib core module for configuring the decompression streams.
	TODO: make sure it's safe to call read() on an already-read request with multiple encodings
 */

module.exports = (options) => {
	options = Object.assign({}, options, { info: false });
	return (req) => {
		const encodings = [];
		
		// Process the content-encoding header.
		const ceHeader = req.headers.get('content-encoding');
		if (ceHeader) {
			if (!contentCodings.test(ceHeader)) return 415;
			encodings.push(...ceHeader.split(','));
		}
		
		// Process the transfer-encoding header.
		const teHeader = req.headers.get('transfer-encoding');
		if (teHeader) {
			if (!transferCodings.test(teHeader)) return 501;
			encodings.push(...teHeader.split(','));
		}
		
		// If any encodings were specified, store a decoding plan in req.meta
		if (encodings.length) {
			const decoders = [];
			for (let encoding of encodings) {
				encoding = encoding.trim().toLowerCase();
				if (encoding === 'gzip') decoders.push(createGunzip);
				else if (encoding === 'deflate') decoders.push(createInflate);
			}
			decoders.reverse();
			req.meta[decodePlan] = { decoders, options };
		}
	};
};

const decodeRiver = (river, decoder) => new River((resolve, reject, write, free) => {
	decoder.on('end', resolve);
	decoder.on('error', reject);
	decoder.on('data', write);
	free(() => { cancel(); decoder.destroy(); });
	river.then(() => void decoder.end(), reject);
	const cancel = river.pump(data => void decoder.write(data));
});

function read() {
	const raw = noPlugin.call(this);
	if (!this.meta[decodePlan]) return raw;
	const { decoders, options } = this.meta[decodePlan];
	return decoders.reduce((river, decoder) => decodeRiver(river, decoder(options)), raw);
}

const contentCodings = /^(?:gzip|deflate|identity)(?:[ \t]*,[ \t]*(?:gzip|deflate|identity))*$/i;
const transferCodings = /^(?:gzip|deflate|identity|chunked$)(?:[ \t]*,[ \t]*(?:gzip|deflate|identity|chunked$))*$/i;
const noPlugin = Request.prototype.read;
Object.defineProperty(Request.prototype, 'read', {
	configurable: true,
	writable: true,
	value: read,
});
