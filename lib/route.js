'use strict';

class Route {
  constructor(definition) {
    this.definition = definition;
    // this.before = [];
    // this.after = [];
  }
  execute(req, res, pathname) {
    (0, this.definition)(req, res, pathname);
  }
}

module.exports = Route;
