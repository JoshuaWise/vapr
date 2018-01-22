# Liberties taken

* The HostRouter can only register hostnames up to 253 characters in length, instead of the standard 254 (not including the root domain).
* The HostRouter will reject requests with a specified hostname longer than 254 characters in length (regardless of whether the root domain is present), instead of the standard 255.
* The HostRouter considers a hostname invalid if it contains any zero-length subdomains, aside from the root domain.
* The PathRouter considers a pathname invalid if it has any empty path segments, aside from the last.
* The PathRouter considers a pathname invalid if it contain any of the unencoded characters `;`, `@`, `&`, `=`, `~`, `'`, or `:`.
