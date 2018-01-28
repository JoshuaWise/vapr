'use strict';

/*
	The execution definition for a single route.
	TODO: a way to say, "validate this path parameter"
	TODO: a way to say, "ensure this header exists, and validate it"
	TODO: a way to say, "ensure this query parameter exists, and validate it"
	TODO: a way to say, "if this header exists, validate it [and do this]"
	TODO: a way to say, "if this query parameter exists, validate it [and do this]"
	TODO: create method execution handler (promise/river-based).
	TODO: `before` and `after` route actions.
 */

class Route {
	constructor() {
		return Object.setPrototypeOf(makeHandler(this), this);
	}
}

Object.setPrototypeOf(Route.prototype, Function.prototype);
module.exports = Route;
