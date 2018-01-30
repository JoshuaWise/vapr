// 'use strict';
// const { hasOwnProperty } = Object.prototype;
// const descriptor = { value: undefined, writable: false, enumerable: true, configurable: true };
// const location = Symbol();
// const port = Symbol();
// const url = Symbol();
// const method = Symbol();
// const body = Symbol();

// class Request {
//   constructor(req, loc) {
//     this[location] = loc;
//     this[port] = -1;
//     this[url] = '';
//     this[method] = req.method;
//     this[body] = undefined;

//     descriptor.value = Object.freeze(req.headers);
//     Object.defineProperty(this, 'headers', descriptor);

//     descriptor.value = new Promise((resolve, reject) => {
//       req.on('end', () => resolve(Object.freeze(req.trailers)));
//       req.on('aborted', () => reject(new Error('The request was aborted')));
//     });
//     Object.defineProperty(this, 'trailers', descriptor);

//     descriptor.value = new River((resolve, reject, write, free) => {
//       req.on('data', write);
//       req.on('end', resolve);
//       req.on('aborted', () => reject(new Error('The request was aborted')));
//       free(() => req.destroy());
//     });
//     Object.defineProperty(this, 'data', descriptor);
//   }
//   get method() { return this[method]; }
//   get scheme() { return this[location].scheme; }
//   get host() { return this[location].host; }
//   get port() { return this[port] === -1 ? (this[port] = +this[location].port) : this[port]; }
//   get path() { return this[location].path; }
//   get query() { return this[location].query; }
//   get url() {
//     if (this[url]) return this[url];
//     const { host, path, query } = this[location];
//     const search = query ? '?' + query : '';
//     if (host) {
//       const { scheme, port } = this[location];
//       const hostport = port === '80' && scheme === 'http' || port === '443' && scheme === 'https' ? host : `${host}:${port}`;
//       this[url] = `${scheme}://${hostport}${path === '*' ? '' : path}${search}`;
//     } else {
//       this[url] = path + search;
//     }
//     return this[url];
//   }
//   get body() {
//     if (this[body]) return this[body];
//     return this[body] = this.data.all().then(chunks => Buffer.concat(chunks));
//   }
// }

// module.exports = Request;
