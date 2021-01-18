# Contributing Guide

Vapr welcomes contributions from the community. If you have an idea for improving Vapr, the best approach is to open a new [pull request](https://github.com/JoshuaWise/vapr/pulls) with your desired changes, including an explanation of why the contribution is valuable. Although Vapr doesn't have official linting rules, contributors should try to match the style of Vapr's existing code. Any new features should also include [tests](../test) and [documentation](./reference/index.md).

Lastly, contributions and feature requests will be rejected if they aren't aligned with Vapr's design goals:

### 1. No application-specific features

For example, not all HTTP services use JSON, so parsing JSON is not done by Vapr automatically—it should be implemented in a plugin instead.

As an exception, any feature directly related to the core [HTTP procotol](https://tools.ietf.org/html/rfc7230) may be included in Vapr. For example, even though trailer fields are not used in every HTTP service, they're supported by Vapr because they're a direct feature of HTTP.

### 2. No low-level features

Vapr utilizes high-level APIs in every case possible. For example, header fields are [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) objects, request bodies are [River](https://github.com/JoshuaWise/wise-river) objects, etc. All Vapr features should respect this philosophy unless it would be impossible or counterproductive to do so.

### 3. No overly opinionated features

Vapr doesn't parse query parameters for you because different query specifications exists. Likewise, new features of Vapr should not be opinionated in ways that favor some use-cases over others.

### 4. Be strict about security and correctness

Whenever possible, Vapr should make an effort to protect programmers from known security vulnerabilities. Vapr should also be very strict about following the HTTP specification, and should attempt to protect programmers from disobeying lesser-known aspects of the specification. If complex or unintuitive code is introduced for the sake of obeying the specification, the code should be commented with a reference to the part of specification being enforced.
