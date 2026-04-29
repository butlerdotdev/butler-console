// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

/** Convert a dotted-quad IP string to a 32-bit unsigned integer. */
export function ipToInt(ip: string): number {
	return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

/** Convert a 32-bit unsigned integer to a dotted-quad IP string. */
export function intToIp(n: number): string {
	return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.')
}

/** Parse a CIDR string into its network start, broadcast end, prefix length, and size. */
export function parseCIDR(cidr: string): { start: number; end: number; prefix: number; size: number } {
	const [ip, prefix] = cidr.split('/')
	const p = parseInt(prefix, 10)
	const mask = p === 0 ? 0 : (~0 << (32 - p)) >>> 0
	const start = ipToInt(ip) & mask
	const size = 1 << (32 - p)
	return { start, end: (start + size - 1) >>> 0, prefix: p, size }
}

/** Check whether two inclusive IP ranges overlap. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
	return aStart <= bEnd && bStart <= aEnd
}

/** Count the number of IPs in a CIDR block. */
export function cidrSize(cidr: string): number {
	return parseCIDR(cidr).size
}

/** Count the number of IPs in an inclusive start-end range (dotted-quad strings). */
export function rangeSize(start: string, end: string): number {
	return (ipToInt(end) - ipToInt(start) + 1) >>> 0
}
