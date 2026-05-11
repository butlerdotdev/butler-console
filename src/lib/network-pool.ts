// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { ipToInt, intToIp, parseCIDR, rangesOverlap } from '@/lib/ip-math'
import type { AllocationRange, NetworkPoolSpec, InfrastructureAllocation, IPAllocation } from '@/types/networks'

/**
 * Returns the effective tenant allocation ranges for a NetworkPool.
 * When ranges is populated, it takes precedence over start/end.
 * When only start/end are present, they are returned as a single range.
 * Mirrors butler-api's GetEffectiveRanges Go helper.
 */
export function getEffectiveRanges(
	ta: NetworkPoolSpec['tenantAllocation']
): AllocationRange[] {
	if (!ta) return []
	if (ta.ranges && ta.ranges.length > 0) {
		return ta.ranges
	}
	if (ta.start && ta.end) {
		return [{ start: ta.start, end: ta.end }]
	}
	return []
}

// ---------------------------------------------------------------------------
// Range Breakdown — used by IPAddressMap
// ---------------------------------------------------------------------------

export type PoolRangeKind = 'gateway' | 'reserved' | 'tenant' | 'unmanaged'

export interface InfraDetail {
	ip: number
	ipStr: string
	source: string
	serviceName?: string
	serviceNamespace?: string
	nodeName?: string
}

export interface TenantDetail {
	clusterName: string
	type: string
	start: number
	end: number
	count: number
	allocationName: string
}

export interface NodeDetail {
	ip: number
	ipStr: string
	nodeName: string
}

export interface PoolRange {
	kind: PoolRangeKind
	startIP: number
	endIP: number
	label: string
	description?: string
	totalIPs: number
	consumedIPs: number
	freeIPs: number
	infraDetails: InfraDetail[]
	tenantDetails: TenantDetail[]
	nodeDetails: NodeDetail[]
}

/**
 * Computes an ordered breakdown of all IP ranges within a pool.
 * Returns non-overlapping PoolRange entries covering the full pool CIDR,
 * ordered by IP address.
 */
export function computeRangeBreakdown(
	poolCidr: string,
	reserved: Array<{ cidr: string; description?: string }>,
	tenantAllocation: NetworkPoolSpec['tenantAllocation'],
	allocations: IPAllocation[],
	infrastructureAllocations: InfrastructureAllocation[],
): PoolRange[] {
	const pool = parseCIDR(poolCidr)
	const poolStart = pool.start
	const poolEnd = pool.end

	// 1. Collect defined ranges: gateway, reserved CIDRs, tenant ranges.
	interface DefinedRange {
		kind: PoolRangeKind
		start: number
		end: number
		description?: string
	}

	const defined: DefinedRange[] = []

	// Gateway: first IP
	defined.push({ kind: 'gateway', start: poolStart, end: poolStart })

	// Reserved CIDRs
	for (const r of reserved) {
		const parsed = parseCIDR(r.cidr)
		const start = Math.max(parsed.start, poolStart) >>> 0
		const end = Math.min(parsed.end, poolEnd) >>> 0
		if (start <= end) {
			defined.push({ kind: 'reserved', start, end, description: r.description })
		}
	}

	// Tenant ranges
	const effectiveRanges = getEffectiveRanges(tenantAllocation)
	for (const r of effectiveRanges) {
		const start = Math.max(ipToInt(r.start), poolStart) >>> 0
		const end = Math.min(ipToInt(r.end), poolEnd) >>> 0
		if (start <= end) {
			defined.push({ kind: 'tenant', start, end })
		}
	}

	// 2. Sort defined ranges by start IP, then merge overlapping same-kind ranges.
	defined.sort((a, b) => a.start - b.start || a.end - b.end)

	// 3. Build final range list by filling gaps with 'unmanaged'.
	// Flatten into non-overlapping intervals. Higher-priority kinds win overlaps.
	// Priority: gateway > reserved > tenant > unassigned.
	// Use the same boundary-splitting approach as computePoolLayout.

	const boundaries = new Set<number>()
	boundaries.add(poolStart)
	boundaries.add((poolEnd + 1) >>> 0)

	for (const d of defined) {
		boundaries.add(d.start)
		boundaries.add((d.end + 1) >>> 0)
	}

	const sorted = Array.from(boundaries).sort((a, b) => a - b)

	// Assign each interval to the highest-priority defined range that covers it.
	interface RawInterval {
		start: number
		end: number
		kind: PoolRangeKind
		description?: string
	}

	const intervals: RawInterval[] = []

	for (let i = 0; i < sorted.length - 1; i++) {
		const segStart = sorted[i]
		const segEnd = (sorted[i + 1] - 1) >>> 0

		if (segStart > poolEnd || segEnd < poolStart) continue
		const clampedStart = Math.max(segStart, poolStart) >>> 0
		const clampedEnd = Math.min(segEnd, poolEnd) >>> 0
		if (clampedStart > clampedEnd) continue

		// Determine kind by priority
		let kind: PoolRangeKind = 'unmanaged'
		let description: string | undefined

		// Gateway check
		if (clampedStart === poolStart && clampedEnd === poolStart) {
			kind = 'gateway'
		}

		// Reserved check
		if (kind === 'unmanaged') {
			for (const d of defined) {
				if (d.kind === 'reserved' && rangesOverlap(clampedStart, clampedEnd, d.start, d.end)) {
					kind = 'reserved'
					description = d.description
					break
				}
			}
		}

		// Tenant check
		if (kind === 'unmanaged') {
			for (const d of defined) {
				if (d.kind === 'tenant' && rangesOverlap(clampedStart, clampedEnd, d.start, d.end)) {
					kind = 'tenant'
					break
				}
			}
		}

		intervals.push({ start: clampedStart, end: clampedEnd, kind, description })
	}

	// 4. Merge consecutive intervals with the same kind and description.
	const merged: RawInterval[] = []
	for (const interval of intervals) {
		const last = merged[merged.length - 1]
		if (last && last.kind === interval.kind && last.description === interval.description && ((last.end + 1) >>> 0) === interval.start) {
			last.end = interval.end
		} else {
			merged.push({ ...interval })
		}
	}

	// 5. Pre-parse infra and allocation data for cross-referencing.
	// InfrastructureAllocations now carry both Service and Node references.
	const parsedInfra: InfraDetail[] = infrastructureAllocations.map(a => ({
		ip: ipToInt(a.ip),
		ipStr: a.ip,
		source: a.source,
		serviceName: a.serviceRef?.name,
		serviceNamespace: a.serviceRef?.namespace,
		nodeName: a.nodeRef?.name,
	}))

	// Extract node details from infra allocations with source="node" or with nodeRef.
	const parsedNodes: NodeDetail[] = infrastructureAllocations
		.filter(a => a.nodeRef?.name)
		.map(a => ({
			ip: ipToInt(a.ip),
			ipStr: a.ip,
			nodeName: a.nodeRef!.name,
		}))

	const parsedAllocations = allocations
		.filter(a => a.status?.startAddress && a.status?.endAddress)
		.map(a => ({
			start: ipToInt(a.status!.startAddress!),
			end: ipToInt(a.status!.endAddress!),
			clusterName: a.spec.tenantClusterRef?.name || 'unknown',
			type: a.spec.type || 'nodes',
			count: a.spec.count || ((ipToInt(a.status!.endAddress!) - ipToInt(a.status!.startAddress!) + 1) >>> 0),
			allocationName: a.metadata.name,
		}))

	// 6. Build PoolRange output with cross-referenced details.
	const ranges: PoolRange[] = []

	for (const interval of merged) {
		const totalIPs = ((interval.end - interval.start + 1) >>> 0)
		const startIPStr = intToIp(interval.start)
		const endIPStr = intToIp(interval.end)
		const label = totalIPs === 1 ? startIPStr : `${startIPStr} - ${endIPStr}`

		let consumedIPs = 0
		const infraDetails: InfraDetail[] = []
		const tenantDetails: TenantDetail[] = []
		const nodeDetails: NodeDetail[] = []

		if (interval.kind === 'reserved' || interval.kind === 'unmanaged') {
			// Cross-reference infrastructure allocations (Services and Nodes)
			for (const infra of parsedInfra) {
				if (infra.ip >= interval.start && infra.ip <= interval.end) {
					infraDetails.push(infra)
				}
			}
			// Cross-reference nodes within this range
			for (const node of parsedNodes) {
				if (node.ip >= interval.start && node.ip <= interval.end) {
					nodeDetails.push(node)
				}
			}
			// Consumed = unique IPs (infra entries already deduplicate by IP)
			consumedIPs = infraDetails.length
		} else if (interval.kind === 'tenant') {
			// Cross-reference tenant allocations
			for (const alloc of parsedAllocations) {
				if (rangesOverlap(interval.start, interval.end, alloc.start, alloc.end)) {
					// Clamp allocation to this range
					const overlapStart = Math.max(interval.start, alloc.start) >>> 0
					const overlapEnd = Math.min(interval.end, alloc.end) >>> 0
					const overlapCount = ((overlapEnd - overlapStart + 1) >>> 0)
					tenantDetails.push({
						clusterName: alloc.clusterName,
						type: alloc.type,
						start: overlapStart,
						end: overlapEnd,
						count: overlapCount,
						allocationName: alloc.allocationName,
					})
					consumedIPs += overlapCount
				}
			}
		} else if (interval.kind === 'gateway') {
			consumedIPs = 1
		}

		ranges.push({
			kind: interval.kind,
			startIP: interval.start,
			endIP: interval.end,
			label,
			description: interval.description,
			totalIPs,
			consumedIPs,
			freeIPs: totalIPs - consumedIPs,
			infraDetails,
			tenantDetails,
			nodeDetails,
		})
	}

	return ranges
}
