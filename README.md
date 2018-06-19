# vapr [![Build Status](https://travis-ci.org/JoshuaWise/vapr.svg?branch=master)](https://travis-ci.org/JoshuaWise/vapr)
A framework for writing expressive, functional-style apps.

Using concepts such as immutability, cascading flow control, and observables, Vapr makes complex tasks easy while preventing bugs and remaining unopinionated.

Vapr is not a RESTful JSON server, or a template rendering app, or an asset streaming service. Vapr is simply a modern HTTP framework suited for any and all of the above. It comes with powerful high-level features, but leaves application-specific functionality to the middleware/plugins.

## Installation

Vapr requires **node v8.9.0** or higher.

```bash
npm install --save vapr
```

## Usage

```js
const app = require('vapr')();

app.get('/', req => [[Buffer.from('hello world')]]);

app.listen(3000);
```

# Guide

(coming soon)

## Simple responses

(coming soon)

## Functional middleware

(coming soon)

## Modern async tooling

(coming soon)

## Correctness and security

(coming soon)
