# vapr [![Build Status](https://travis-ci.org/JoshuaWise/vapr.svg?branch=master)](https://travis-ci.org/JoshuaWise/vapr)
A framework for writing expressive, functional-style apps.

Using concepts such as immutability, cascading flow control, and observables, Vapr makes complex tasks easy while preventing bugs and remaining unopinionated.

Vapr is not a RESTful JSON server, or a template rendering app, or an asset streaming service. Vapr is simply a modern HTTP framework suited for any and all of the above. It comes with powerful high-level features, but leaves application-specific functionality to the middleware/plugins.

## Installation

Vapr requires **node v8.9.0** or higher.

```bash
npm install --save vapr
```

## Hello world

```js
const app = require('vapr')();
const server = require('http').createServer(app);

app.get('/', req => [['hello world']]);

server.listen(3000);
```

# Guide

## Routing

Routing is easy.

```js
app.get('/foo', (req) => { /* app logic here */ });
app.post('/bar', (req) => { /* app logic here */ });
```

Need parameters? Also easy.

```js
app.get('/article/:id', (req) => {
  const articleId = req.params.id;
});
```

In the above example, requesting `POST /article/123` would result in a `405 Method Not Allowed`. To have multiple methods on the same path, use `app.route()`.

```js
const resource = app.route('/article/:id');

resource.get(getHandler);
resource.post(postHandler);

// Although uncommon, you can also define a custom 'method not allowed' handler
resource.noSuchMethod(fn);
```

If someone requests a non-existent path, they'll receive a `404 Not Found`, but you can optionally define a custom *not found* handler instead.

```js
app.notFound(handler);
```

By default, the router is case-insensitive and ignores trailing slashes. Either of these settings can be changed by passing options to the app constructor.

```js
const app = require('vapr')({
  respectCase: true,
  respectTrailingSlash: true,
});
```

## Immutable requests

In many other frameworks, the `req` object is completely mutable. Patterns emerge where a programmer might change the value of a header or query parameter in order to change the behavior of a middleware/plugin down the line. This type of pattern can cause bugs that are very difficult to trace.

With Vapr, the `req` object is *deeply immutable*, so programmers can safely rely on the values within it, knowing with certainty that they were not modified by some other code.

As a request is processed, it's common to attach new auxiliary information to it (such as an object that was parsed from a header). To facilitate this, the `req.meta` object is available, and is completely mutable. Any user-defined or plugin-defined information can be placed there.

```js
app.get('/', (req) => {
  const parsedDate = new Date(req.headers.get('date'));

  req.headers.set('date', parsedDate); // Error
  req.meta.date = parsedDate; // Good
});
```

## Expressive responses

In Vapr, a response is generated by returning or throwing a value. If the value is a number, it will generate an empty response with that status code.

```js
app.get('/', (req) => {
  if (req.headers.has('x-deprecated-header')) throw 400;
  return 204;
});
```

Sometimes you may wish to include a custom message or header. To do this, just return an array.

```js
app.get('/', (req) => {
  if (req.headers.has('x-deprecated-header')) throw [400, 'Deprecated Request'];
  return [204, { 'set-cookie': 'visited=true' }];
});
```

Response bodies must be distinguished from headers and messages, so they get wrapped in another array. Don't worry about efficiency here; small arrays are extremely cheap to create.

```js
app.get('/', (req) => {
  return [200, 'this is a status message', ['this is body text']];
});
```

Normally, the status code is required. But when you're just returning a body with a 200 status code, there's a convenient shorthand.

```js
app.get('/', (req) => {
  return [['im a response with a 200 status code']];
});
```

The response body can either be a string, a Buffer, or a [River](#modern-async-tooling) of such. But with the use of plugins, it could be anything.

## Functional middleware

Middleware (plugins) can be assigned in multiple ways.

```js
// Insert it before the main route handler
app.get('/', plugin(), (req) => { ... });

// Insert as many plugins as you want
app.get('/', plugin1(), plugin2(), (req) => { ... });

// Group common plugins together as an array
const commonPlugins = [plugin1(), plugin2()];
app.get('/', commonPlugins, (req) => { ... });

// Use multiple arrays, and nested arrays
const moreCommonPlugins = [commonPlugins, plugin3()];
app.get('/', moreCommonPlugins, otherPlugins, (req) => { ... });

// Use the route object itself
const route = app.get('/');
route.use(commonPlugins, otherPlugins);
route.use(specialPlugin());
route.use((req) => { ... });
```

In the last example, it's revealed that there's actually no difference between the main route handler and a middleware plugin. A route will simply execute each of the handlers in order, until a response is returned (or thrown), at which point all future handlers are skipped.

Async handlers are supported automatically. If a handler is an async function, the next handler will not be invoked until the async function finishes.

```js
route.use(async (req) => {
  req.meta.user = await db.getUser(req.params.id);
});
```

Some plugins will need to operate after a response has been generated, but before it's sent to the client. To do this, just return a function. Such a function is called a "late handler", and is guaranteed to be called later on, before the response is sent. It will receive the response object as an argument.

```js
route.use((req) => {
  // this happens before the response is generated
  return (res) => {
    // this happens after the response is generated, before it's sent
  };
});
```

In many cases, this can be simplified.

```js
route.use((req) => (res) => {
  res.headers.set('x-custom-header', 'some value');
});
```

Route handlers behave like a stack. They are called in order until a response is generated. When that happens, control will start flowing in the reverse direction, calling each of the *late handlers* in the opposite order.

Late handlers are capable of mutating the response object, but all properties are guarded by setters/getters, preventing any invalid mutation (such as setting the response code to an object). Additionally, each late handler may return a new response, replacing the existing one for subsequent late handlers.

When all handlers and late handlers are finished, the resulting response is finally sent to the client.

## Modern async tooling

Vapr abandons the use of low-level asynchronous tools such as callbacks, event emitters, and Node.js streams, instead favoring high-level promises and [observables](https://www.youtube.com/watch?v=-vPFP-2Mkl8).

In another framework, if you want to write a plugin to parse a request's body as JSON, this would be your code:

```js
function jsonPlugin(req, callback) {
  const buffers = [];
  req.on('data', (chunk) => {
    buffers.push(chunk);
  });
  req.on('end', () => {
    let result;
    try {
      result = JSON.parse(Buffer.concat(buffers));
    } catch (err) {
      callback(err);
      return;
    }
    callback(null, result);
  });
  req.on('error', (err) => {
    callback(err);
  });
  req.on('aborted', () => {
    callback(new Error('The request was aborted'));
  });
}
```

Because of how terrible that is, many frameworks take the opinionated approach of providing JSON support out of the box, making the resulting object available at `req.body`. Unfortunately, this approach has many downsides. For example, imagine you want to check the size of the body before processing it—this would be impossible. Or perhaps your route is for uploading files, so it shouldn't accept JSON. The proper response would be `415 Unsupported Media Type`, but you're only able to send that response after uselessly parsing the JSON body anyways.

Vapr is able to remain unopinionated and flexible, while at the same time making it extremely easy for you to impart your own opinions. If you want to replicate the behavior of a more opinioned framework, you can do so with a one-line plugin:

```js
route.use(async (req) => {
  req.meta.body = await req.read().all().then(Buffer.concat).then(JSON.parse);
});
```

This is all possible because Vapr embraces the use of [observables](https://www.youtube.com/watch?v=-vPFP-2Mkl8). More specifically, Vapr uses a very JavaScripty observable pattern called a [River](https://github.com/JoshuaWise/wise-river). Visit [the repo](https://github.com/JoshuaWise/wise-river) to learn about all the amazing things you can do with Rivers. Or, just forget about it and pretend they're [async iterables](https://github.com/tc39/proposal-async-iteration), because they are:

```js
route.use(async (req) => {
  const buffers = [];
  for await (const chunk of req.read()) {
    buffers.push(chunk);
  }
  req.meta.body = JSON.parse(Buffer.concat(buffers));
});
```

## Streaming responses

If you're dealing with large response bodies, you can stream them to reduce the memory footprint of your application and greatly improve stability and latency. Doing this in Vapr is as easy as responding with a [River](https://github.com/JoshuaWise/wise-river) instead of a Buffer.

```js
const fs = require('fs');
const { River } = require('vapr');

// This function returns a River
const streamFile = filename => River.riverify(fs.createReadStream(filename));

app.get('/:filename', (req) => {
  return [[streamFile(req.params.filename)]];
});
```

Notice how we didn't need to close the stream, or handle errors. Observables have automatic resource management and error propagation, so we only need to worry about app logic.

Although only HTTP/1.1 supports "chunked" responses, the above example even works with HTTP/1.0 requests, because Vapr is smart enough to detect the situation and adjust the response accordingly.

## Expected and unexpected errors

If you can anticipate an error, you can handle it gracefully with ease.

```js
app.get('/article/:id', (req) => {
  if (!isValid(req.params.id)) throw 400;
});
```

If an unexpected error occurs (i.e., an Error object is thrown), it will be converted into a 500 response object. Responses that originate from unexpected errors will have the original error available at `res.error`.

```js
const route = app.get('/article/:id');

// The error handler should come first, using a 'late handler'
route.use((req) => (res) => {
  if (res.code < 400) return;
  if (res.error) console.error(res.error);
  console.log(`A ${res.code} response was generated`);
});

// This is the main route handler
route.use(async (req) => {
  const article = await db.findArticle(req.params.id);
  if (article) return [[removePrivateFields(article)]];
  return [404, 'Article Not Found'];
});
```

The above example reveals a common pattern found in late handlers. Most late handlers only care about successful responses or error responses, but usually not both. For example, a plugin that sets a cookie might only want to do so for successful responses. Therefore it's very common to use `if (res.code >= 400) return;` within late handlers.

### Unrecoverable errors

Some errors in HTTP are considered unrecoverable. For example, if the response stream errors out after the status code was already sent, the only logical thing to do is to destroy the connection, signaling to the client that the response is incomplete and should be discarded. Most frameworks have no way of gracefully reporting situation like this.

By default, unrecoverable errors will be emitted as process warnings. If desired, custom logging can be used instead.

```js
const app = require('vapr')({ logger: myLoggerFunction });
```

## Virtual hosting

Vapr has the ability to route requests based on the hostname provided in the request. Vapr apps accomplish this by spawning "child apps". The parent app will route based on hostname, while the child apps route based on pathname.

```js
const parent = require('vapr')();

const child1 = parent.host('www.mywebsite.com');
const child2 = parent.host('dev.mywebsite.com:8080');
const child3 = parent.host('*.mywebsite.com:*');
```

As seen above, wildcards (`*`) can be used in any subdomain position and/or the port position. Wildcards are only utilized when a request doesn't have an exact match.

Each child app can be used like a regular router.

```js
child1.get('/foo', () => { ... });
child2.get('/foo', () => { ... });
child3.get('/foo', () => { ... });
```

If no port is specified in the host string, a default port of `80` ([http](https://nodejs.org/api/http.html)) or `443` ([https](https://nodejs.org/api/https.html)) is used. You can specify a different default port by passing an option to the parent app constructor.

```js
const parent = require('vapr')({ defaultPort: 8080 });
```

If someone makes a request to an unknown host, they'll receive a `404 Not Found`, but you can optionally define a custom handler instead.

```js
parent.noHost(handler);
```

## Correctness and security

Vapr takes security very seriously. At the time of this writing, no known HTTP framework for Node.js (besides Vapr) does any validation on the URL of incoming requests. Unfortunately for the users of those frameworks, failing to correctly parse and validate these URLs is a known security vulnerability. Using `url.parse()` or `new URL()` from the builtin [`url`](https://nodejs.org/api/url.html) module is not sufficient. Vapr correctly parses these URLs in accordance with [RFC 7230](https://tools.ietf.org/html/rfc7230) and discards connections that provide invalid URLs.

There are many other issues with existing frameworks similar to the one described above. Other examples include trimming the whitespace at the end of header values (which Node.js does not do by default for some strange reason, even though the HTTP spec demands it), and ensuring that certain response headers which should be mutually exclusive are indeed treated that way. An exhaustive list of these issues would be too long to cover. Suffice it to say that Vapr is a *true* HTTP framework in the sense that it obeys the HTTP specification very strictly.

Another feature of correctness is with regards to the string comparison used by the router. Most frameworks ignore unicode normalization, and treat percent-encoded characters as-is. Without properly normalizing a url before comparison, strange and difficult-to-trace bugs can occur. Vapr performs proper normalization while routing.

## Efficiency

(radix tree routing)
(event loop efficiency)
(benchmark)
