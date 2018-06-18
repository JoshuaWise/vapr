'use strict';
const Route = require('./route');
const HostRouter = require('./routers/host-router');
const PathRouter = require('./routers/path-router');
const MethodRouter = require('./routers/method-router');

class App {
	constructor(options) {
		return Object.setPrototypeOf(makeApp(this[settings]), this);
	}
}

const makeApp = (settings) => (req, res) => {

};

Object.setPrototypeOf(App.prototype, Function.prototype);
module.exports = App;
