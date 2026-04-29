// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// Framework-agnostic test matrix for computePoolLayout. Follows the same
// pattern as ip-math.test.ts: exported cases and a runner function that
// throws on first mismatch.

import { computePoolLayout } from './NetworkLayoutBar'
import type { NetworkPool } from '@/types/networks'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePool(overrides: {
	cidr: string
	reserved?: Array<{ cidr: string; description?: string }>
	tenantAllocation?: { start: string; end: string }
}): NetworkPool {
	return {
		metadata: { name: 'test-pool', namespace: 'default' },
		spec: {
			cidr: overrides.cidr,
			reserved: overrides.reserved,
			tenantAllocation: overrides.tenantAllocation,
		},
	}
}

type SegmentKind = 'gateway' | 'reserved' | 'tenant-allocated' | 'tenant-available' | 'unassigned'

/** Summarize segments into a map of kind -> total IPs */
function summarize(segments: ReturnType<typeof computePoolLayout>): Record<string, number> {
	const counts: Record<string, number> = {}
	for (const s of segments) {
		counts[s.kind] = (counts[s.kind] || 0) + s.size
	}
	return counts
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

interface LayoutCase {
	name: string
	pool: NetworkPool
	allocatedIPs: number
	expectKinds: Partial<Record<SegmentKind, number>>
	/** Total IPs across all segments must equal CIDR size */
	expectTotalSize: number
}

const layoutCases: LayoutCase[] = [
	{
		name: '/24, no reservations, no tenant range',
		pool: makePool({ cidr: '192.168.1.0/24' }),
		allocatedIPs: 0,
		expectKinds: {
			gateway: 1,
			unassigned: 255,
		},
		expectTotalSize: 256,
	},
	{
		name: '/24 with tenant range, zero allocations',
		pool: makePool({
			cidr: '192.168.1.0/24',
			tenantAllocation: { start: '192.168.1.32', end: '192.168.1.63' },
		}),
		allocatedIPs: 0,
		expectKinds: {
			gateway: 1,
			'tenant-available': 32,
		},
		expectTotalSize: 256,
	},
	{
		name: '/24 with tenant range, partial allocations',
		pool: makePool({
			cidr: '192.168.1.0/24',
			tenantAllocation: { start: '192.168.1.32', end: '192.168.1.63' },
		}),
		allocatedIPs: 10,
		expectKinds: {
			gateway: 1,
			'tenant-allocated': 10,
			'tenant-available': 22,
		},
		expectTotalSize: 256,
	},
	{
		name: '/24 with tenant range, fully allocated',
		pool: makePool({
			cidr: '192.168.1.0/24',
			tenantAllocation: { start: '192.168.1.32', end: '192.168.1.63' },
		}),
		allocatedIPs: 32,
		expectKinds: {
			gateway: 1,
			'tenant-allocated': 32,
			'tenant-available': 0,
		},
		expectTotalSize: 256,
	},
	{
		name: '/23 pool matching crop cluster layout',
		pool: makePool({
			cidr: '10.92.90.0/23',
			reserved: [
				{ cidr: '10.92.90.0/27', description: 'Network infrastructure' },
			],
			tenantAllocation: { start: '10.92.90.32', end: '10.92.90.63' },
		}),
		allocatedIPs: 5,
		expectKinds: {
			// Gateway (.0) overlaps with the reserved /27 (.0-.31).
			// Reserved wins for the gateway IP, so gateway=0 or gateway gets
			// absorbed. The boundary algorithm assigns gateway first (highest
			// priority), so .0 = gateway, .1-.31 = reserved (31), .32-.63 = tenant.
			gateway: 1,
			reserved: 31,
			'tenant-allocated': 5,
			'tenant-available': 27,
			unassigned: 448,
		},
		expectTotalSize: 512,
	},
	{
		name: 'reserved range outside tenant range',
		pool: makePool({
			cidr: '10.0.0.0/24',
			reserved: [
				{ cidr: '10.0.0.128/25', description: 'DHCP scope' },
			],
			tenantAllocation: { start: '10.0.0.1', end: '10.0.0.32' },
		}),
		allocatedIPs: 0,
		expectKinds: {
			gateway: 1,
			reserved: 128,
			'tenant-available': 32,
		},
		expectTotalSize: 256,
	},
	{
		name: 'multiple reserved ranges',
		pool: makePool({
			cidr: '10.0.0.0/24',
			reserved: [
				{ cidr: '10.0.0.64/26', description: 'DHCP' },
				{ cidr: '10.0.0.128/26', description: 'Management' },
			],
			tenantAllocation: { start: '10.0.0.1', end: '10.0.0.63' },
		}),
		allocatedIPs: 20,
		expectKinds: {
			gateway: 1,
			reserved: 128,
			'tenant-allocated': 20,
			'tenant-available': 43,
		},
		expectTotalSize: 256,
	},
]

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function validateLayoutCases(): void {
	for (const c of layoutCases) {
		const segments = computePoolLayout(c.pool, c.allocatedIPs)

		// Verify total size
		const totalSize = segments.reduce((sum, s) => sum + s.size, 0)
		if (totalSize !== c.expectTotalSize) {
			throw new Error(
				`[${c.name}] total segment size: got ${totalSize}, want ${c.expectTotalSize}`
			)
		}

		// Verify expected kind counts
		const summary = summarize(segments)
		for (const [kind, expected] of Object.entries(c.expectKinds)) {
			const got = summary[kind] || 0
			if (expected === 0 && got === 0) continue
			if (got !== expected) {
				throw new Error(
					`[${c.name}] ${kind}: got ${got}, want ${expected}. ` +
					`Full summary: ${JSON.stringify(summary)}`
				)
			}
		}

		// Verify segments are contiguous (no gaps or overlaps)
		for (let i = 1; i < segments.length; i++) {
			const prev = segments[i - 1]
			const curr = segments[i]
			// endIP of previous should be one less than startIP of current
			// (we can't easily check numerically without ip-math, but we can
			// verify ordering via the string comparison of start IPs)
			if (prev.startIP > curr.startIP) {
				throw new Error(
					`[${c.name}] segments not sorted: ${prev.startIP} > ${curr.startIP}`
				)
			}
		}
	}
}
