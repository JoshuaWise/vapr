'use strict';

/*
  The execution definition for a single route.
  TODO: create implementation (promise-based execution).
  TODO: ensure all places in all files with "req, res" are handled correctly.
  TODO: `before` and `after` route actions.
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
