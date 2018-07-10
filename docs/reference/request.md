# class *Request*

Request objects are passed to [route handlers](./application.md#class-route) when they are executed.

```js
app.get('/foo/bar', (req) => {
  console.log(req);
  return 204;
});
```

In Vapr, request objects are *deeply immutable*, which means you cannot change or add properties on them. This improves reliability for third-party plugins that are added to the program. However, each request has a `meta` object, which *is* mutable, and can be used for attaching auxiliary information to the request.

```js
route.use((req) => {
  req.meta.date = new Date(req.headers.get('date'));
});
```

## Properties

### .headers -> *Map*

A [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) object containing the request headers. Header names are case-insensitive.

```js
route.use((req) => {
  console.log(req.headers.get('Content-Type')); // => "application/json"
});
```

### .params -> *object or null*

The associated URI parameters. Parameter values may contain percent-encodings, such as `%2F`. If the route has no parameters, this property will be `null`.

```js
const route = app.get('/pets/:name');
route.use((req) => {
  console.log(req.params.name); // => "snowball"
});
```

### .target -> *object*

The [effective URI](https://tools.ietf.org/html/rfc7230#section-5.5) of the request. This object has five properties:

* `protocol`: either `"http:"`, `"https:"`, or `null`
* `hostname`: the requested hostname, such as `"foo.bar.com"` or `null`
* `port`: the requested port, such as `"443"` or `null`
* `pathname`: the requested path, such as `"/foo/bar"` or `"*"`
* `search`: the query string following the pathname, such as `"?foo=bar"` or `""`

The first three properties (`protocol`, `hostname`, and `port`) are either non-empty strings or `null`, and are mutually dependent. For example, if a request did not contain a `Host` header and did not specify a host in the url, the three properties will be `null`; otherwise they will be non-empty strings, and are always lowercase.

The `pathname` is always a non-empty string, and `search` is either a string starting with `?` or an empty string. These two properties may contain percent-encodings, such as `%2F`.

### .method -> *string*

The HTTP verb of the request (`"GET"`, `"POST"`, etc.).

### .version -> *string*

The HTTP version of the request (`"1.0"` or `"1.1"`).

### .secure -> *boolean*

Whether or not the request was made over HTTPS/TLS.

### .aborted -> *boolean*

Whether or not the request was aborted by the client. If aborted requests are common in your application, this can be used to avoid unnecessary processing.

### .meta -> *object*

A mutable object for attaching application-defined or plugin-defined information to the request. If a plugin doesn't need to expose the attached information, it should use [symbols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol) to simulate private properties.

```js
const querystring = require('querystring');

const route = app.get('/foo/bar');

route.use((req) => {
  req.meta.query = querystring.parse(req.target.search.slice(1));
});
```

## Methods

### .read() -> *River*

Reads the request body, returning a [River](https://github.com/JoshuaWise/wise-river) (async iterable) that emits chunks of the octet stream. This method can only be used once per request—it will return a rejected River after the first invocation.

```js
route.use(async (req) => {
  req.meta.body = await req.read().all().then(Buffer.concat).then(JSON.parse);
});
```

### .trailers() -> *Promise*

Returns a [promise](https://github.com/JoshuaWise/wise-promise) that will eventually be fulfilled with a [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) object containing the request trailers. If this method is invoked before [`.read()`](#read---river), the request body will be implicitly consumed and discarded.

```js
route.use(async (req) => {
  req.meta.trailers = await req.trailers();
});
```
