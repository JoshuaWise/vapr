# General
* Request URIs are considered invalid if they are longer than 2048 bytes.
* Pathnames are considered invalid if they contain any empty path segments, aside from the last.
* Hostnames are considered invalid if they contain any empty domain labels, aside from the root domain.
* Port numbers and IP addresses with leading zeros are considered invalid.
* Hostnames and URIs with [`userinfo@`](https://tools.ietf.org/html/rfc7230#section-2.7.1) are considered invalid.

# HostRouter
* IP address routes cannot use dynamic (`*`) matching.
