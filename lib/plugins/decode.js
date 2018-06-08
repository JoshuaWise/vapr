'use strict';
const { createGunzip, createInflate } = require('zlib');
const River = require('wise-river');
const decode = Symbol();

module.exports = (options) => {
	options = Object.assign({}, options, { info: false });
	return { before: (req, res) => {
		const encodings = [];
		const ceHeader = req.headers.get('content-encoding');
		if (ceHeader) {
			if (!contentCodings.test(ceHeader)) return 415;
			encodings.push(...ceHeader.split(','));
		}
		const teHeader = req.headers.get('transfer-encoding');
		if (teHeader) {
			if (!transferCodings.test(teHeader)) return 501;
			encodings.push(...teHeader.split(','));
		}
		if (encodings.length) {
			const decoders = [];
			for (let encoding of encodings) {
				encoding = encoding.trim().toLowerCase();
				if (encoding === 'gzip') decoders.push(createGunzip);
				else if (encoding === 'deflate') decoders.push(createInflate);
			}
			decoders.reverse();
			req.meta[decode] = { decoders, options };
		}
	} };
};

const decodeRiver = (river, decoder) => new River((resolve, reject, write, free) => {
	decoder.on('end', resolve);
	decoder.on('error', reject);
	decoder.on('data', write);
	free(() => { cancel(); decoder.destroy(); });
	river.then(() => void decoder.end(), reject);
	const cancel = river.pump(data => void decoder.write(data));
});

// TODO: modify req.read() method to use req.meta[decoders]

const contentCodings = /^(?:gzip|deflate|identity)(?:[ \t]*,[ \t]*(?:gzip|deflate|identity))*$/i;
const transferCodings = /^(?:gzip|deflate|identity|chunked$)(?:[ \t]*,[ \t]*(?:gzip|deflate|identity|chunked$))*$/i;
