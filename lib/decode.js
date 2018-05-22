'use strict';
const hexCharToNumber = c => c - (c < 58 ? 48 : c < 91 ? 55 : 87);
const encoding = /%[\dA-F][\dA-F]/ig;
let state = 0;
let shift = 0;
let carry = 0;
let prev = 0;

/*
	Similar to decodeURI() except a few differences:
	 - It decodes everything besides forward slashes ("/")
	 - If the input is invalid, it returns an empty string instead of an exception
	 - Non-decoded sequences are case-folded for better string comparisons
 */

const replacer = (match, pos) => {
	const movedBy = pos - prev;
	prev = pos;
	const u8 = hexCharToNumber(match.charCodeAt(1)) * 16 + hexCharToNumber(match.charCodeAt(2));
	if (state === 0) {
		// Single byte character
		if (u8 < 0x80) {
			return u8 === 0x2f ? match.toUpperCase() : String.fromCharCode(u8);
		}
		if (u8 >= 0xc0) {
			// Two-byte character
			if (u8 < 0xe0) {
				state = 0x80;
				shift = 0;
				carry = (u8 & 0x1f) << 6;
				return '';
			}
			// Three-byte character
			if (u8 < 0xf0) {
				state = 0x800;
				shift = 6;
				carry = (u8 & 0xf) << 12;
				return '';
			}
			// Four-byte character
			if (u8 < 0xf8) {
				state = 0x10000;
				shift = 12;
				carry = (u8 & 0x7) << 18;
				return '';
			}
		}
	}
	// Continuation byte
	else if (state > 0 && u8 >= 0x80 && u8 < 0xc0 && movedBy === 3) {
		carry |= (u8 & 0x3f) << shift;
		if (shift === 0 && carry <= 0x10ffff && carry >= state) {
			state = 0;
			return String.fromCharCode(carry);
		}
		shift -= 6;
		return '';
	}
	// Invalid input
	state = -1;
	return '';
};

module.exports = (str) => {
	state = 0;
	const result = str.replace(encoding, replacer);
	return state === 0 ? result : '';
};
