// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

// Framework-agnostic test matrix for computeRangeBreakdown. Follows the same
// pattern as NetworkLayoutBar.test.ts: exported cases and a runner function
// that throws on first mismatch.

import { computeRangeBreakdown } from './network-pool'
import type { PoolRangeKind } from './network-pool'
import type { NetworkPoolSpec, InfrastructureAllocation, IPAllocation } from '@/types/networks'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAllocations(
	allocs: Array<{ name: string; cluster: string; type: string; start: string; end: string; count?: number }>
): IPAllocation[] {
	return allocs.map(a => ({
		metadata: { name: a.name, namespace: 'default' },
		spec: {
			poolRef: { name: 'test-pool', namespace: 'default' },
			tenantClusterRef: { name: a.cluster, namespace: 'default' },
			type: a.type as 'nodes' | 'loadbalancer',
			count: a.count,
		},
		status: {
			phase: 'Allocated' as const,
			startAddress: a.start,
			endAddress: a.end,
		},
	}))
}

/** Summarize ranges into a map of kind -> total IPs */
function summarize(ranges: ReturnType<typeof computeRangeBreakdown>): Record<string, number> {
	const counts: Record<string, number> = {}
	for (const r of ranges) {
		counts[r.kind] = (counts[r.kind] || 0) + r.totalIPs
	}
	return counts
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

interface RangeCase {
	name: string
	cidr: string
	reserved: Array<{ cidr: string; description?: string }>
	tenantAllocation?: NetworkPoolSpec['tenantAllocation']
	allocations: IPAllocation[]
	infraAllocations: InfrastructureAllocation[]
	expectKinds: Partial<Record<PoolRangeKind, number>>
	expectTotalSize: number
	expectRangeCount?: number
	expectInfraInReserved?: number
	expectInfraInUnassigned?: number
	expectTenantConsumed?: number
}

const rangeCases: RangeCase[] = [
	{
		name: 'empty pool — only gateway + unassigned',
		cidr: '10.1.1.0/24',
		reserved: [],
		allocations: [],
		infraAllocations: [],
		expectKinds: { gateway: 1, unassigned: 255 },
		expectTotalSize: 256,
		expectRangeCount: 2,
	},
	{
		name: '/24 with reserved + tenant, no allocations',
		cidr: '10.1.1.0/24',
		reserved: [{ cidr: '10.1.1.0/28', description: 'mgmt' }],
		tenantAllocation: { start: '10.1.1.32', end: '10.1.1.63' },
		allocations: [],
		infraAllocations: [],
		expectKinds: { gateway: 1, reserved: 15, tenant: 32, unassigned: 208 },
		expectTotalSize: 256,
	},
	{
		name: 'reserved range with infra allocations',
		cidr: '10.1.1.0/24',
		reserved: [{ cidr: '10.1.1.0/28', description: 'mgmt' }],
		tenantAllocation: { start: '10.1.1.32', end: '10.1.1.63' },
		allocations: [],
		infraAllocations: [
			{ ip: '10.1.1.2', source: 'metallb', serviceRef: { namespace: 'ingress', name: 'traefik' } },
			{ ip: '10.1.1.3', source: 'metallb', serviceRef: { namespace: 'monitoring', name: 'grafana' } },
		],
		expectKinds: { gateway: 1, reserved: 15, tenant: 32, unassigned: 208 },
		expectTotalSize: 256,
		expectInfraInReserved: 2,
	},
	{
		name: 'tenant range with allocations',
		cidr: '10.1.1.0/24',
		reserved: [],
		tenantAllocation: { start: '10.1.1.32', end: '10.1.1.63' },
		allocations: makeAllocations([
			{ name: 'alloc-1', cluster: 'dev-cluster', type: 'nodes', start: '10.1.1.32', end: '10.1.1.36', count: 5 },
			{ name: 'alloc-2', cluster: 'prd-cluster', type: 'loadbalancer', start: '10.1.1.40', end: '10.1.1.42', count: 3 },
		]),
		infraAllocations: [],
		expectKinds: { gateway: 1, tenant: 32, unassigned: 223 },
		expectTotalSize: 256,
		expectTenantConsumed: 8,
	},
	{
		name: 'crop cluster layout (real data pattern)',
		cidr: '10.92.90.0/23',
		reserved: [
			{ cidr: '10.92.90.7/32', description: 'mgmt' },
			{ cidr: '10.92.90.8/29', description: 'mgmt' },
			{ cidr: '10.92.90.16/28', description: 'mgmt' },
			{ cidr: '10.92.91.192/26', description: 'mgmt-extension' },
		],
		tenantAllocation: {
			ranges: [
				{ start: '10.92.90.32', end: '10.92.90.63' },
				{ start: '10.92.91.51', end: '10.92.91.191' },
			],
		},
		allocations: makeAllocations([
			{ name: 'alloc-nodes', cluster: 'app-dev', type: 'nodes', start: '10.92.90.32', end: '10.92.90.36', count: 5 },
		]),
		infraAllocations: [
			{ ip: '10.92.90.7', source: 'metallb', serviceRef: { namespace: 'traefik', name: 'traefik' } },
			{ ip: '10.92.90.8', source: 'metallb', serviceRef: { namespace: 'tempo-dev', name: 'tempo-dev' } },
			{ ip: '10.92.90.9', source: 'metallb', serviceRef: { namespace: 'vm-dev', name: 'victoria-metrics-dev' } },
		],
		expectKinds: {
			gateway: 1,
			// .7 (1) + .8-.15 (8) + .16-.31 (16) + .91.192-.91.255 (64) = 89
			reserved: 89,
			// .32-.63 (32) + .91.51-.91.191 (141) = 173
			tenant: 173,
			// .1-.6 (6) + .64-.255 (192) + .91.0-.91.50 (51) = 249
			unassigned: 249,
		},
		expectTotalSize: 512,
		expectInfraInReserved: 3,
		expectTenantConsumed: 5,
	},
	{
		name: 'multiple tenant ranges',
		cidr: '10.0.0.0/24',
		reserved: [],
		tenantAllocation: {
			ranges: [
				{ start: '10.0.0.10', end: '10.0.0.19' },
				{ start: '10.0.0.30', end: '10.0.0.39' },
			],
		},
		allocations: makeAllocations([
			{ name: 'a1', cluster: 'c1', type: 'nodes', start: '10.0.0.10', end: '10.0.0.14', count: 5 },
		]),
		infraAllocations: [],
		expectKinds: { gateway: 1, tenant: 20, unassigned: 235 },
		expectTotalSize: 256,
		expectTenantConsumed: 5,
	},
	{
		name: 'services in unassigned (DHCP) range',
		cidr: '10.0.0.0/24',
		reserved: [{ cidr: '10.0.0.0/28', description: 'mgmt' }],
		tenantAllocation: { start: '10.0.0.32', end: '10.0.0.63' },
		allocations: [],
		infraAllocations: [
			{ ip: '10.0.0.2', source: 'metallb', serviceRef: { namespace: 'ingress', name: 'traefik' } },
			{ ip: '10.0.0.100', source: 'metallb', serviceRef: { namespace: 'monitoring', name: 'grafana' } },
			{ ip: '10.0.0.200', source: 'metallb', serviceRef: { namespace: 'logging', name: 'loki' } },
		],
		expectKinds: { gateway: 1, reserved: 15, tenant: 32, unassigned: 208 },
		expectTotalSize: 256,
		expectInfraInReserved: 1,
		expectInfraInUnassigned: 2,
	},
]

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export function validateRangeBreakdownCases(): void {
	for (const c of rangeCases) {
		const ranges = computeRangeBreakdown(
			c.cidr,
			c.reserved,
			c.tenantAllocation,
			c.allocations,
			c.infraAllocations,
		)

		// Verify total size
		const totalSize = ranges.reduce((sum, r) => sum + r.totalIPs, 0)
		if (totalSize !== c.expectTotalSize) {
			throw new Error(
				`[${c.name}] total size: got ${totalSize}, want ${c.expectTotalSize}`
			)
		}

		// Verify expected kind counts
		const kindSummary = summarize(ranges)
		for (const [kind, expected] of Object.entries(c.expectKinds)) {
			const got = kindSummary[kind] || 0
			if (expected === 0 && got === 0) continue
			if (got !== expected) {
				throw new Error(
					`[${c.name}] ${kind}: got ${got}, want ${expected}. ` +
					`Full summary: ${JSON.stringify(kindSummary)}`
				)
			}
		}

		// Verify range count if specified
		if (c.expectRangeCount !== undefined && ranges.length !== c.expectRangeCount) {
			throw new Error(
				`[${c.name}] range count: got ${ranges.length}, want ${c.expectRangeCount}`
			)
		}

		// Verify infra details cross-referencing
		if (c.expectInfraInReserved !== undefined) {
			const totalInfra = ranges
				.filter(r => r.kind === 'reserved')
				.reduce((sum, r) => sum + r.infraDetails.length, 0)
			if (totalInfra !== c.expectInfraInReserved) {
				throw new Error(
					`[${c.name}] infra in reserved: got ${totalInfra}, want ${c.expectInfraInReserved}`
				)
			}
		}

		// Verify infra in unassigned ranges
		if (c.expectInfraInUnassigned !== undefined) {
			const totalInfra = ranges
				.filter(r => r.kind === 'unassigned')
				.reduce((sum, r) => sum + r.infraDetails.length, 0)
			if (totalInfra !== c.expectInfraInUnassigned) {
				throw new Error(
					`[${c.name}] infra in unassigned: got ${totalInfra}, want ${c.expectInfraInUnassigned}`
				)
			}
		}

		// Verify tenant consumed count
		if (c.expectTenantConsumed !== undefined) {
			const totalConsumed = ranges
				.filter(r => r.kind === 'tenant')
				.reduce((sum, r) => sum + r.consumedIPs, 0)
			if (totalConsumed !== c.expectTenantConsumed) {
				throw new Error(
					`[${c.name}] tenant consumed: got ${totalConsumed}, want ${c.expectTenantConsumed}`
				)
			}
		}

		// Verify ranges are contiguous and non-overlapping
		for (let i = 1; i < ranges.length; i++) {
			const prev = ranges[i - 1]
			const curr = ranges[i]
			const expectedStart = ((prev.endIP + 1) >>> 0)
			if (curr.startIP !== expectedStart) {
				throw new Error(
					`[${c.name}] gap/overlap between range ${i-1} and ${i}: ` +
					`prev ends at ${prev.endIP}, curr starts at ${curr.startIP}`
				)
			}
		}

		// Verify each range's freeIPs = totalIPs - consumedIPs
		for (const r of ranges) {
			if (r.freeIPs !== r.totalIPs - r.consumedIPs) {
				throw new Error(
					`[${c.name}] range ${r.label}: freeIPs (${r.freeIPs}) !== totalIPs (${r.totalIPs}) - consumedIPs (${r.consumedIPs})`
				)
			}
		}
	}
}
