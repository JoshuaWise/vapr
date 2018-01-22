# PathRouter
* When `respectTrailingSlash` is `true`, the final parameter in a route path could be an empty string.
* Pathnames are considered invalid if they contain any empty path segments, aside from the last.
* Pathnames are considered invalid if they contain any of the unencoded characters `;`, `@`, `&`, `=`, `~`, `'`, or `:`.

# HostRouter
* Can only register hostnames up to 253 characters in length, instead of the standard 254 characters (not including the root domain).
* Will reject requests that identify a hostname longer than 254 characters in length (regardless of whether the root domain is present), instead of the standard 255 characters.
* Does not support hostname labels that start with a digit.
* Does not support routing IP addresses.
* Hostnames are considered invalid if they contain any empty domain labels, aside from the root domain.
* Hostnames are considered invalid if they contain fewer than two domain labels, aside from the root domain.
* Will not properly recognize and parse `authority-form` ([[RFC7230](https://tools.ietf.org/html/rfc7230#section-5.3.3)]) request targets, which are used in `CONNECT` requests.
