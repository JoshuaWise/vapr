'use strict';

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
