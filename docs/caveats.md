# General

* Request URIs are considered invalid if they are longer than 16384 bytes.
* Pathnames are considered invalid if they contain any empty path segments, aside from the last.
* Hostnames are considered invalid if they contain any empty domain labels, aside from the root domain.
* Port numbers longer than 5 digits are considered invalid.
* Hostnames and URIs with [`userinfo@`](https://tools.ietf.org/html/rfc7230#section-2.7.1) are considered invalid.

# Virtual Hosting

* IPv4 address routes cannot use wildcard (`*`) matching.
* IPv6 address routes are not supported.
