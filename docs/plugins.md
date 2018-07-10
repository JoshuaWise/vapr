# Authoring Plugins

Many authors may wish to publish their own reusable Vapr plugins. When doing so, it's recommended that they follow a few guidelines.

### 1. Package naming

It's recommended that all Vapr plugins begin with the prefix `vapr-`, to make them easily searchable within package registries such as [NPM](https://www.npmjs.com/package/request). For example, a plugin for compressing responses could be called `vapr-compress`.

### 2. Request mutation

It's common for plugins to add new properties to the [`req.meta`](./reference/request.md#meta---object) object. If such a property is used by the host application, its existence should be well documented. If the property is *not* used by the host application (i.e., it's only used by the plugin itself), it should be hidden away via the use of [symbols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol). This will prevent naming collisions and will protect application authors from invalidating the behavior of your plugin.

### 3. Status code checks

Most plugins are only designed to operate on successful responses or error responses, but usually not both. For example, a caching plugin should never cache error responses. If a plugin uses a [late handler](./reference/application.md#late-handlers), it should virtually always check the status code before continuing to operate.

```js
const cachePlugin = (options) => (req) => (res) => {
  if (res.code >= 400) return;
  ...
};
```

```js
const errorHandlingPlugin = (options) => (req) => (res) => {
  if (res.code < 400) return;
  ...
};
```
