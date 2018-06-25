'use strict';
const { TLSSocket } = require('tls');
const { inspect } = require('util');
const River = require('wise-river');
const Fields = require('./fields');
const shared = require('../shared');
const mut = Symbol();

/*
	The public interface for an incoming request. Since requests are immutable,
	the mutable request.meta object is reserved for application use.
 */

class Request {
	constructor(req, location, params) {
		this.method = req.method;
		this.target = Object.freeze(location);
		this.params = params && Object.freeze(params);
		this.headers = new Fields(req.headers);
		this.version = req.httpVersion;
		this.secure = req.socket instanceof TLSSocket;
		this.meta = new MetaObject;
		this[mut] = { raw: req, body: undefined, aborted: false, discarded: false };
		req.on('aborted', onAborted(this));
		Object.freeze(this);
	}
	get aborted() {
		return this[mut].aborted;
	}
	read() {
		const { [mut]: self } = this;
		if (self.body) return River.reject(new TypeError('The request body was already consumed'));
		if (self.discarded) return self.body = River.reject(new TypeError('The request body was discarded because a response was already sent'));
		if (self.aborted) return self.body = River.reject(new Error('The request was aborted'));
		return self.body = new River((resolve, reject, write) => {
			self.raw.on('data', write);
			self.raw.on('end', resolve);
			self.raw.on('aborted', () => reject(new Error('The request was aborted')));
		});
	}
	trailers() {
		const { [mut]: self } = this;
		if (!self.body) this.read().drain().catchLater();
		return self.body.then(() => new Fields(self.raw.trailers));
	}
	[shared.discardBody]() {
		const { [mut]: self } = this;
		if (!self.body) {
			self.discarded = true;
			self.raw.resume(); // Ensure the request stream is consumed
		}
	}
	[inspect.custom]() {
		const ret = new RequestInspection;
		for (const [key, value] of Object.entries(this)) ret[key] = value;
		return ret;
	}
}

const MetaObject = class Object {
	[inspect.custom]() {
		const ret = {};
		for (const [key, value] of global.Object.entries(this)) ret[key] = value;
		return ret;
	}
};

const onAborted = (self) => () => { self[mut].aborted = true; };
const RequestInspection = class Request {};
module.exports = Request;
