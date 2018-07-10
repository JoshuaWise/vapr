# class *Response*

Responses are created by returning (or throwing) a number or array in one of the following formats:

- `code`
- `[code, message?, headers?, [body, trailers?]?]`
- `[[body, trailers?]]`

Any optional value (`?`) can be omitted (or replaced with `null` or `undefined`). Don't worry about memorizing these formats—if you have a typo, a helpful error will be thrown so you can make a correction. Some examples of valid response formats are shown below.

```js
return 204;
return 400;
return [200, 'status message'];
return [200, { 'X-Custom-Header': 'foo' }];
return [200, 'status message', { 'X-Custom-Header': 'foo' }];
return [200, ['body text']];
return [200, ['body text', { 'X-Custom-Trailer': new Promise(fn) }]];
return [200, 'status message', ['body text']];
return [200, { 'X-Custom-Header': 'foo' }, ['body text']];
return [200, 'status message', { 'X-Custom-Header': 'foo' }, ['body text', { 'X-Custom-Trailer': new Promise(fn) }]];
return [['body text']];
return [['body text', { 'X-Custom-Trailer': new Promise(fn) }]];
```

Response objects are exposed by [late handlers](./application.md#late-handlers).

```js
route.use((req) => (res) => {
  console.log(res);
});
```

## Properties

### .code -> *number*

The status code of the response. If you change the status code, and the [`message`](#message---string) property is the [default](https://nodejs.org/api/http.html#http_http_status_codes) message for the old status code, the `message` will be set to the default for the new status code.

```js
route.use((req) => (res) => {
  if (res.code === 200 && (!res.body || !res.body.byteLength)) res.code = 204;
});
```

### .message -> *string*

The status message of the response. If you set the status message to `null` or `undefined`, the [default](https://nodejs.org/api/http.html#http_http_status_codes) message for the current status code will be used.

```js
route.use((req) => (res) => {
  if (!req.secure) res.message = null;
});
```

### .headers -> *Map*

A [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) object containing the response headers. Header names are case-insensitive, and header values must be strings.

```js
route.use((req) => (res) => {
  res.headers.set('ETag', etag(res.body));
});
```

### .trailers -> *Map*

A [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) object containing the response trailers. Trailer names are case-insensitive. Unlike headers, trailer values may be either strings or promises of strings.

```js
route.use((req) => (res) {
  const promise = Promise.resolve(res.body).then(() => new Date().toUTCString());
  res.trailers.set('X-Finished-At', promise);
});
```

### .body -> *any*

Before the response is sent, the response body must be converted to either `null`/`undefined`, a string, a [Buffer](https://nodejs.org/api/buffer.html), or a [River](https://github.com/JoshuaWise/wise-river) of strings or Buffers. For example, it's common for applications to set the body to an object, relying on a plugin to serialize it into a string/Buffer later on.

```js
route.use((req) => (res) => {
  res.body = JSON.stringify(res.body);
  res.headers.set('Content-Type', 'application/json; charset=utf-8');
});
```

### .error -> *Error*

If a route handler throws an Error object, it will generate an empty response with a `500` status code. In such cases, the original Error object is exposed by this read-only property.
