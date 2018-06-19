# vapr [![Build Status](https://travis-ci.org/JoshuaWise/vapr.svg?branch=master)](https://travis-ci.org/JoshuaWise/vapr)
A framework for writing expressive, functional-style apps.

## Installation

```bash
npm install --save vapr
```

## Usage

```js
const app = require('vapr')();

app.get('/', req => [[Buffer.from('hello world')]]);

require('http').createServer(app).listen(3000);
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
