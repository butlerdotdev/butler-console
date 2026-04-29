// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// Framework-agnostic test matrix for ip-math utilities. Follows the
// same pattern as webhookError.test.ts: exported cases and a runner
// function that throws on first mismatch.

import { ipToInt, intToIp, parseCIDR, rangesOverlap, cidrSize, rangeSize } from './ip-math'

// ---------------------------------------------------------------------------
// ipToInt / intToIp round-trip
// ---------------------------------------------------------------------------

interface RoundTripCase {
	name: string
	ip: string
	int: number
}

const roundTripCases: RoundTripCase[] = [
	{ name: '0.0.0.0', ip: '0.0.0.0', int: 0 },
	{ name: '255.255.255.255', ip: '255.255.255.255', int: 0xffffffff },
	{ name: '10.0.0.1', ip: '10.0.0.1', int: 0x0a000001 },
	{ name: '10.92.90.0', ip: '10.92.90.0', int: (10 << 24 | 92 << 16 | 90 << 8) >>> 0 },
	{ name: '192.168.1.255', ip: '192.168.1.255', int: (192 << 24 | 168 << 16 | 1 << 8 | 255) >>> 0 },
]

// ---------------------------------------------------------------------------
// parseCIDR
// ---------------------------------------------------------------------------

interface CIDRCase {
	name: string
	cidr: string
	expectStart: string
	expectEnd: string
	expectPrefix: number
	expectSize: number
}

const cidrCases: CIDRCase[] = [
	{
		name: '/23 pool',
		cidr: '10.92.90.0/23',
		expectStart: '10.92.90.0',
		expectEnd: '10.92.91.255',
		expectPrefix: 23,
		expectSize: 512,
	},
	{
		name: '/24 block',
		cidr: '192.168.1.0/24',
		expectStart: '192.168.1.0',
		expectEnd: '192.168.1.255',
		expectPrefix: 24,
		expectSize: 256,
	},
	{
		name: '/32 single host',
		cidr: '10.0.0.1/32',
		expectStart: '10.0.0.1',
		expectEnd: '10.0.0.1',
		expectPrefix: 32,
		expectSize: 1,
	},
	{
		name: '/25 half-block',
		cidr: '10.92.90.0/25',
		expectStart: '10.92.90.0',
		expectEnd: '10.92.90.127',
		expectPrefix: 25,
		expectSize: 128,
	},
	{
		name: '/16 large pool',
		cidr: '172.16.0.0/16',
		expectStart: '172.16.0.0',
		expectEnd: '172.16.255.255',
		expectPrefix: 16,
		expectSize: 65536,
	},
]

// ---------------------------------------------------------------------------
// rangesOverlap
// ---------------------------------------------------------------------------

interface OverlapCase {
	name: string
	a: [string, string]
	b: [string, string]
	expect: boolean
}

const overlapCases: OverlapCase[] = [
	{
		name: 'identical ranges overlap',
		a: ['10.0.0.0', '10.0.0.255'],
		b: ['10.0.0.0', '10.0.0.255'],
		expect: true,
	},
	{
		name: 'adjacent ranges do not overlap',
		a: ['10.0.0.0', '10.0.0.127'],
		b: ['10.0.0.128', '10.0.0.255'],
		expect: false,
	},
	{
		name: 'partial overlap',
		a: ['10.0.0.0', '10.0.0.200'],
		b: ['10.0.0.100', '10.0.0.255'],
		expect: true,
	},
	{
		name: 'disjoint ranges',
		a: ['10.0.0.0', '10.0.0.31'],
		b: ['10.0.1.0', '10.0.1.31'],
		expect: false,
	},
	{
		name: 'one range contains the other',
		a: ['10.0.0.0', '10.0.0.255'],
		b: ['10.0.0.32', '10.0.0.63'],
		expect: true,
	},
	{
		name: 'single-IP overlap at boundary',
		a: ['10.0.0.0', '10.0.0.128'],
		b: ['10.0.0.128', '10.0.0.255'],
		expect: true,
	},
]

// ---------------------------------------------------------------------------
// cidrSize / rangeSize
// ---------------------------------------------------------------------------

interface SizeCase {
	name: string
	fn: 'cidrSize' | 'rangeSize'
	args: [string] | [string, string]
	expect: number
}

const sizeCases: SizeCase[] = [
	{ name: 'cidrSize /23', fn: 'cidrSize', args: ['10.92.90.0/23'], expect: 512 },
	{ name: 'cidrSize /24', fn: 'cidrSize', args: ['192.168.1.0/24'], expect: 256 },
	{ name: 'cidrSize /32', fn: 'cidrSize', args: ['10.0.0.1/32'], expect: 1 },
	{ name: 'rangeSize single IP', fn: 'rangeSize', args: ['10.0.0.1', '10.0.0.1'], expect: 1 },
	{ name: 'rangeSize 32 IPs', fn: 'rangeSize', args: ['10.92.90.32', '10.92.90.63'], expect: 32 },
	{ name: 'rangeSize spanning octets', fn: 'rangeSize', args: ['10.92.90.200', '10.92.91.55'], expect: 112 },
]

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function validateIPMathCases(): void {
	// Round-trip
	for (const c of roundTripCases) {
		const gotInt = ipToInt(c.ip)
		if (gotInt !== c.int) {
			throw new Error(`ipToInt(${c.ip}): got ${gotInt}, want ${c.int}`)
		}
		const gotIP = intToIp(c.int)
		if (gotIP !== c.ip) {
			throw new Error(`intToIp(${c.int}): got ${gotIP}, want ${c.ip}`)
		}
	}

	// parseCIDR
	for (const c of cidrCases) {
		const r = parseCIDR(c.cidr)
		const gotStart = intToIp(r.start)
		const gotEnd = intToIp(r.end)
		if (gotStart !== c.expectStart) {
			throw new Error(`parseCIDR(${c.cidr}).start: got ${gotStart}, want ${c.expectStart}`)
		}
		if (gotEnd !== c.expectEnd) {
			throw new Error(`parseCIDR(${c.cidr}).end: got ${gotEnd}, want ${c.expectEnd}`)
		}
		if (r.prefix !== c.expectPrefix) {
			throw new Error(`parseCIDR(${c.cidr}).prefix: got ${r.prefix}, want ${c.expectPrefix}`)
		}
		if (r.size !== c.expectSize) {
			throw new Error(`parseCIDR(${c.cidr}).size: got ${r.size}, want ${c.expectSize}`)
		}
	}

	// rangesOverlap
	for (const c of overlapCases) {
		const got = rangesOverlap(ipToInt(c.a[0]), ipToInt(c.a[1]), ipToInt(c.b[0]), ipToInt(c.b[1]))
		if (got !== c.expect) {
			throw new Error(`rangesOverlap ${c.name}: got ${got}, want ${c.expect}`)
		}
	}

	// cidrSize / rangeSize
	for (const c of sizeCases) {
		const got = c.fn === 'cidrSize'
			? cidrSize(c.args[0])
			: rangeSize(c.args[0], c.args[1] as string)
		if (got !== c.expect) {
			throw new Error(`${c.fn} ${c.name}: got ${got}, want ${c.expect}`)
		}
	}
}
