# PathRouter
* Pathnames are considered invalid if they contain any of the unencoded characters `;`, `@`, `&`, `=`, `~`, `'`, `.`, `*`, `!`, or `:`.
* Pathnames are considered invalid if they contain any empty path segments, aside from the last.

# HostRouter
* IP address routes cannot use dynamic (`*`) matching.
* Hostnames are considered invalid if they contain fewer than two domain labels, aside from the root domain.
* Hostnames are considered invalid if they contain any empty domain labels, aside from the root domain.
* Will not properly recognize and parse `authority-form` ([[RFC7230](https://tools.ietf.org/html/rfc7230#section-5.3.3)]) request targets, which are used in `CONNECT` requests.
