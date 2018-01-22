'use strict';

/*
  The execution definition for a single route.
  TODO: create implementation (promise-based execution).
  TODO: `before` and `after` route actions.
  TODO: allow the user to specify required headers, path parameters, and query parameters.
 */

class Route {
  constructor(fn) {
    this.fn = fn;
    // this.before = [];
    // this.after = [];
  }
  execute(req, res) {
    (0, this.fn)(req, res);
  }
}

module.exports = Route;
