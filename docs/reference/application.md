# class *Application*

To create a new Vapr app, just invoke the main exported function.

```js
const vapr = require('vapr');

const app = vapr(options);
```

Vapr apps can be used directly with [`http.createServer()`](https://nodejs.org/api/http.html#http_http_createserver_options_requestlistener). Multiple servers can be created from the same Vapr app.

```js
const fs = require('fs');
const vapr = require('vapr');

const app = vapr();

const encryption = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
};

const httpServer = require('http').createServer(app);
const httpsServer = require('https').createServer(encryption, app);
```

## Options

An options object can be passed to the app constructor. These options are propagated to all child [apps](#class-application), [resources](#class-resource), and [routes](#class-route). Additionally, there are a few options (below) which affect the app object directly.

### options.respectCase = *false*

If `true`, routing will be done in a case-sensitive manner. This only applies to pathnames (e.g., `/foo/bar`); hostnames are always considered case-insensitive, regardless of this option.

### options.respectTrailingSlash = *false*

If `true`, the app will not ignore trailing slashes while routing. By default, pathnames such as `/foo` and `/foo/` are considered equal.

### options.defaultPort = *80*

When routing based on hostname, this specifies which port to use for routes that doesn't specify an explicit port. For example, `www.foo.com:443` will always use port `443` but, by default, `www.foo.com` would use port `80`.

```js
const vapr = require('vapr');

const app = vapr({
  respectCase: true,
  respectTrailingSlash: true,
  defaultPort: process.env.NODE_ENV === 'production' ? 443 : 3000,
});
```

## Methods

### .host(*hostname*, [*options*]) -> *Application*

Creates a child [app](#class-application) object, which will receive requests that contain a matching `hostname`. If any `options` are passed, the child app will use those options instead of inheriting from the parent.

```js
const parentApp = require('vapr')();

const articleApp = app.host('articles.my-service.com');
const videoApp = app.host('videos.my-service.com', { respectCase: true });
```

The `hostname` string can contain wildcards (`*`) in any subdomain position and/or the port position. If no port is specified in the string, the [`defaultPort`](#optionsdefaultport--80) is used.

```js
app.host('foo.bar.com');
app.host('foo.bar.com:443');
app.host('foo.bar.com:*');
app.host('*.bar.com:*');
app.host('*.*.*:*');
```

### .route(*pathname*, [*options*]) -> *Resource*

Creates a new [resource](#class-resource) object, which will receive requests that contain a matching `pathname`. If any `options` are passed, the resource object will use those options instead of inheriting from the app.

```js
const app = require('vapr')();

const zebraResource = app.route('/animals/zebras');
const dragonResource = app.route('/animals/dragons', { logger: myCustomLogger });
```

The `pathname` string can contain parameters (e.g., `:foo`) in place of any regular path segment. If a request is received that could match multiple resources, regular/exact path segments are prioritized over parameters.

```js
app.route('/dog/husky/snowball');
app.route('/dog/husky/:name');
app.route('/:species/all-breeds/:name');
app.route('/:species/:breed/:name');
```

> A single application object cannot use both [`.host()`](#hosthostname-options---application) *and* [`.route()`](#routepathname-options---resource). Either an app uses `.host()` and spawns children apps, or it uses `.route()` and spawns resource objects. If you try to use both on the same app, you'll receive an appropriate error message.

### .noHost(*...handlers*) -> *Route*

Creates a new [route](#class-route) object, which will be used whenever a request is received that doesn't match any [defined hostnames](#hosthostname-options---application). You can optionally pass any number of `handlers`, which is equivalent to invoking `route.use(...handlers)` on the returned route object.

If this method is never used, the default behavior is to respond with `404 Not Found` to such requests.

```js
app.noHost(showHelpPage);
```

### .notFound(*...handlers*) -> *Route*

Creates a new [route](#class-route) object, which will be used whenever a request is received that doesn't match any [defined pathnames](#routepathname-options---resource). You can optionally pass any number of `handlers`, which is equivalent to invoking `route.use(...handlers)` on the returned route object.

If this method is never used, the default behavior is to respond with `404 Not Found` to such requests.

```js
app.notFound(showHelpPage);
```

## Shorthand methods

- **.get(*pathname*, *...handlers*) -> *Route***
- **.post(*pathname*, *...handlers*) -> *Route***
- **.put(*pathname*, *...handlers*) -> *Route***
- **.patch(*pathname*, *...handlers*) -> *Route***
- **.delete(*pathname*, *...handlers*) -> *Route***
- **.head(*pathname*, *...handlers*) -> *Route***
- **.options(*pathname*, *...handlers*) -> *Route***
- **.trace(*pathname*, *...handlers*) -> *Route***

These convenience methods can be used whenever a [resource](#class-resource) would only contain one HTTP verb. The examples below are equivalent.

```js
app.route('/foo/bar').get(handler);
app.get('/foo/bar', handler);
```

# class *Resource*

Resource objects are created with [`app.route()`](#routepathname-options---resource), and are used to associate HTTP verbs (GET, POST, etc.) with routed pathnames.

```js
const resource = app.route('/foo/bar');

resource.get(handlerFunction);
```

## Methods

- **.get(*...handlers*) -> *Route***
- **.post(*...handlers*) -> *Route***
- **.put(*...handlers*) -> *Route***
- **.patch(*...handlers*) -> *Route***
- **.delete(*...handlers*) -> *Route***
- **.head(*...handlers*) -> *Route***
- **.options(*...handlers*) -> *Route***
- **.trace(*...handlers*) -> *Route***

Each of these methods creates a new [route](#class-route) object, which will be used whenever a request is received that matches the given HTTP verb. You can optionally pass any number of `handlers`, which is equivalent to invoking `route.use(...handlers)` on the returned route object.

- **.noSuchMethod(*...handlers*) -> *Route***

This method creates a [route](#class-route) object that will be used for requests containing an unused HTTP verb. If this method is never used, the default behavior is to respond with `405 Method Not Allowed` to such requests.

```js
const resource = app.route('/articles/:id');

resource.get(getArticle);
resource.post(postArticle);
resource.delete(deleteArticle);

resource.noSuchMethod(showHelpPage);
```

# class *Route*

Route objects are used to define what the program will actually do when someone makes a request to your app.

```js
const route = app.get('/foo/bar');

route.use(somePlugin());
route.use(someOtherPlugin());
route.use(handlerFunction);
```

When a request is received, each function passed to `.use()` is invoked *in order*, until a response is returned or thrown. If an async function is used, subsequent handlers won't be invoked until the async function finishes. Each handler receives the [request](./request.md#class-request) object as a parameter.

```js
const route = app.get('/articles/:id');

route.use(async (req) => {
 req.meta.article = await db.findArticle(req.params.id);
});

route.use((req) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  const body = JSON.serialize(req.meta.article);
  return [200, headers, [body]];
});

route.use((req) => {
  // This handler will never be invoked because the previous handler always returns a response
});
```

#### Late handlers

So-called *late handlers* can be used to modify a [response](./response.md#class-response) object before it's sent. Late handlers are invoked in the *opposite* order from which they are created.

```js
route.use((req) => (res) => {
  // This function will be invoked last, not first
});

route.use((req) => (res) => {
  res.headers.set('Connection', 'close');
});
```

A late handler can also return a new response, which will replace the existing response for subsequent late handlers.

```js
route.use((req) => (res) => {
  if (etagsMatch(req, res)) return 304;
});
```

## Methods

### .use(*...handlers*) -> *this*

Appends the given `handlers` to this route object. Each handler may be either a function or an array of handlers (recursively).

```js
route.use(fn);
route.use(fn1, fn2, fn3);
route.use([fn1, fn2, fn3]);
route.use([fn1, [fn2, [[[[fn3]]], fn4]]], [fn5, [fn6]], fn7);
```

### logger(*loggerFunction*) -> *this*

Some errors in HTTP are considered unrecoverable. For example, a response stream could error out after the status code was already sent. The provided `loggerFunction` will be used to report such errors.

If no logger is specified, the default behavior is to pass the error to [`process.emitWarning()`](#process_process_emitwarning_warning_options).

## Options

When a route is created, it inherits any options that were passed to the [app constructor](#class-application) or [`app.route()`](#routepathname-options---resource).

### options.logger = *process.emitWarning*

This option can be used to change the default logger function that is used by routes that do not invoke the [`.logger()`](#loggerloggerfunction---this) method.

```js
const vapr = require('vapr');

const app = vapr({ logger: myCustomLogger });
```
