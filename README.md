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

## Immutable requests

In many other frameworks, the `req` object is completely mutable. Patterns emerge where a programmer might change the value of a header or query parameter in order to change the behavior of a middleware/plugin down the line. This type of pattern can cause countless bugs that are very difficult to trace. In a better world, if a plugin wishes to allow "overrides", it can simply expose an option to do so.

With Vapr, the `req` object is *deeply immutable*, so programmers can safely rely on the values within it, knowing with certainty that they were not modified by some other code. This might seem like a minor feature, but it gives you an idea of how seriously Vapr is on dependability.

As a request is processed, it's common to attach new auxiliary information to it (such as an object that was parsed from a header). To facilitate this, the `req.meta` object is available, and is completely mutable. Any user-defined or plugin-defined information can be placed there.

```js
app.get('/', (req) => {
  const parsedDate = new Date(req.headers.get('date'));

  req.headers.set('date', parsedDate); // Error
  req.meta.date = parsedDate; // Good
});
```

## Expressive responses

(coming soon)

## Functional middleware

(coming soon)

## Modern async tooling

(coming soon)

## Correctness and security

(coming soon)
