// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { ipToInt, intToIp, parseCIDR, rangesOverlap } from '@/lib/ip-math'
import type { NetworkPool } from '@/types/networks'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SegmentKind = 'gateway' | 'reserved' | 'tenant-allocated' | 'tenant-available' | 'unassigned'

interface Segment {
	kind: SegmentKind
	startIP: string
	endIP: string
	size: number
	label: string
	description?: string
}

interface NetworkLayoutBarProps {
	pool: NetworkPool
	allocatedIPs: number
}

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

const SEGMENT_STYLES: Record<SegmentKind, { bg: string; text: string }> = {
	gateway: { bg: 'bg-cyan-500/30', text: 'text-cyan-400' },
	reserved: { bg: 'bg-neutral-600/60', text: 'text-neutral-400' },
	'tenant-allocated': { bg: 'bg-amber-500/50', text: 'text-amber-400' },
	'tenant-available': { bg: 'bg-emerald-500/50', text: 'text-emerald-400' },
	unassigned: { bg: 'bg-neutral-800/60', text: 'text-neutral-500' },
}

const SEGMENT_LABELS: Record<SegmentKind, string> = {
	gateway: 'Gateway',
	reserved: 'Reserved',
	'tenant-allocated': 'Tenant (Allocated)',
	'tenant-available': 'Tenant (Available)',
	unassigned: 'Unassigned',
}

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

export function computePoolLayout(pool: NetworkPool, allocatedIPs: number): Segment[] {
	const poolRange = parseCIDR(pool.spec.cidr)
	const poolStart = poolRange.start
	const poolEnd = poolRange.end

	// Build a list of "claimed" regions: gateway, reserved blocks, tenant range.
	// Then compute unassigned as the remainder.
	interface Region {
		start: number
		end: number
		kind: SegmentKind
		description?: string
	}

	const regions: Region[] = []

	// Gateway: first IP in the pool
	regions.push({
		start: poolStart,
		end: poolStart,
		kind: 'gateway',
		description: 'Network/gateway address',
	})

	// Reserved ranges from spec
	if (pool.spec.reserved) {
		for (const r of pool.spec.reserved) {
			const parsed = parseCIDR(r.cidr)
			// Clamp to pool boundaries
			const start = Math.max(parsed.start, poolStart) >>> 0
			const end = Math.min(parsed.end, poolEnd) >>> 0
			if (start <= end) {
				regions.push({
					start,
					end,
					kind: 'reserved',
					description: r.description,
				})
			}
		}
	}

	// Tenant allocation range
	const ta = pool.spec.tenantAllocation
	let tenantStart = 0
	let tenantEnd = 0
	if (ta?.start && ta?.end) {
		tenantStart = ipToInt(ta.start)
		tenantEnd = ipToInt(ta.end)
	}

	// Flatten into a sorted list of segments covering the full pool.
	// Walk through every IP (conceptually) and assign it to the highest-
	// priority region. For rendering, we merge consecutive IPs with the
	// same kind into contiguous segments.

	// Priority: gateway > reserved > tenant > unassigned.
	// We mark each IP position with a kind, then run-length encode.

	// For large pools this per-IP walk is too expensive. Instead, build
	// non-overlapping intervals by sorting regions and splitting.

	// Collect boundary points
	const boundaries = new Set<number>()
	boundaries.add(poolStart)
	boundaries.add((poolEnd + 1) >>> 0)

	for (const r of regions) {
		boundaries.add(r.start)
		boundaries.add((r.end + 1) >>> 0)
	}
	if (tenantStart && tenantEnd) {
		boundaries.add(tenantStart)
		boundaries.add((tenantEnd + 1) >>> 0)
	}

	const sorted = Array.from(boundaries).sort((a, b) => a - b)

	const segments: Segment[] = []

	for (let i = 0; i < sorted.length - 1; i++) {
		const segStart = sorted[i]
		const segEnd = (sorted[i + 1] - 1) >>> 0

		// Skip if outside pool
		if (segStart > poolEnd || segEnd < poolStart) continue
		const clampedStart = Math.max(segStart, poolStart) >>> 0
		const clampedEnd = Math.min(segEnd, poolEnd) >>> 0
		if (clampedStart > clampedEnd) continue

		const size = (clampedEnd - clampedStart + 1) >>> 0
		if (size === 0) continue

		// Determine kind by priority
		let kind: SegmentKind = 'unassigned'
		let description: string | undefined

		// Check gateway (highest priority)
		const isGateway = clampedStart === poolStart && clampedEnd === poolStart
		if (isGateway) {
			kind = 'gateway'
			description = 'Network/gateway address'
		}

		// Check reserved (next priority, but gateway wins)
		if (kind === 'unassigned') {
			for (const r of regions) {
				if (r.kind === 'reserved' && rangesOverlap(clampedStart, clampedEnd, r.start, r.end)) {
					kind = 'reserved'
					description = r.description
					break
				}
			}
		}

		// Check tenant (lower priority than reserved)
		if (kind === 'unassigned' && tenantStart && tenantEnd) {
			if (rangesOverlap(clampedStart, clampedEnd, tenantStart, tenantEnd)) {
				// Split tenant into allocated and available based on allocatedIPs count.
				// We show the tenant range as one "tenant-available" segment for now
				// since we don't know the exact allocated sub-ranges at this level.
				// The detail view (IPAddressMap) shows per-IP allocation status.
				kind = 'tenant-available'
			}
		}

		const startIP = intToIp(clampedStart)
		const endIP = intToIp(clampedEnd)
		const label = size === 1 ? startIP : `${startIP} - ${endIP}`

		segments.push({ kind, startIP, endIP, size, label, description })
	}

	// Merge the tenant segments into allocated + available based on the
	// aggregate allocatedIPs count. Walk tenant segments left-to-right
	// and mark the first N IPs as allocated.
	let remaining = allocatedIPs
	for (const seg of segments) {
		if (seg.kind !== 'tenant-available') continue
		if (remaining <= 0) break

		if (remaining >= seg.size) {
			seg.kind = 'tenant-allocated'
			remaining -= seg.size
		} else {
			// Split this segment: the first `remaining` IPs are allocated,
			// the rest are available. Insert a new segment after this one.
			const allocEnd = (ipToInt(seg.startIP) + remaining - 1) >>> 0
			const availStart = (allocEnd + 1) >>> 0

			const availSize = seg.size - remaining
			const newSeg: Segment = {
				kind: 'tenant-available',
				startIP: intToIp(availStart),
				endIP: seg.endIP,
				size: availSize,
				label: `${intToIp(availStart)} - ${seg.endIP}`,
			}

			seg.kind = 'tenant-allocated'
			seg.endIP = intToIp(allocEnd)
			seg.size = remaining
			seg.label = seg.size === 1 ? seg.startIP : `${seg.startIP} - ${seg.endIP}`

			// Insert after current position
			const idx = segments.indexOf(seg)
			segments.splice(idx + 1, 0, newSeg)
			remaining = 0
			break
		}
	}

	return segments
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function SegmentTooltip({ segment, totalIPs, x, y }: {
	segment: Segment
	totalIPs: number
	x: number
	y: number
}) {
	const pct = totalIPs > 0 ? ((segment.size / totalIPs) * 100).toFixed(1) : '0'

	return (
		<div
			className="fixed z-50 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 shadow-xl pointer-events-none"
			style={{
				left: x,
				top: y,
				transform: 'translate(-50%, -100%) translateY(-8px)',
			}}
		>
			<div className="text-xs space-y-0.5 whitespace-nowrap">
				<div className="text-neutral-100 font-medium">
					{SEGMENT_LABELS[segment.kind]}
				</div>
				<div className="text-neutral-400 font-mono">{segment.label}</div>
				<div className="text-neutral-400">
					{segment.size.toLocaleString()} IP{segment.size !== 1 ? 's' : ''} ({pct}%)
				</div>
				{segment.description && (
					<div className="text-neutral-500">{segment.description}</div>
				)}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NetworkLayoutBar({ pool, allocatedIPs }: NetworkLayoutBarProps) {
	const [tooltip, setTooltip] = useState<{ segment: Segment; x: number; y: number } | null>(null)

	const poolSize = useMemo(() => parseCIDR(pool.spec.cidr).size, [pool.spec.cidr])

	const segments = useMemo(
		() => computePoolLayout(pool, allocatedIPs),
		[pool, allocatedIPs],
	)

	const handleMouseEnter = (segment: Segment, e: React.MouseEvent) => {
		const rect = (e.target as HTMLElement).getBoundingClientRect()
		setTooltip({ segment, x: rect.left + rect.width / 2, y: rect.top })
	}

	return (
		<div className="space-y-2">
			<div className="flex items-baseline justify-between">
				<h3 className="text-sm font-medium text-neutral-200">Network Layout</h3>
				<span className="text-xs text-neutral-500 font-mono">
					{pool.spec.cidr} ({poolSize.toLocaleString()} addresses)
				</span>
			</div>

			{/* Stacked bar */}
			<div className="h-6 bg-neutral-800 rounded-lg overflow-hidden flex">
				{segments.map((seg, i) => {
					const widthPct = poolSize > 0 ? (seg.size / poolSize) * 100 : 0
					if (widthPct < 0.1) return null

					return (
						<div
							key={i}
							className={cn(
								'h-full transition-all hover:brightness-125',
								SEGMENT_STYLES[seg.kind].bg,
								widthPct > 5 ? 'min-w-[2px]' : 'min-w-[1px]',
							)}
							style={{ width: `${widthPct}%` }}
							onMouseEnter={(e) => handleMouseEnter(seg, e)}
							onMouseLeave={() => setTooltip(null)}
						/>
					)
				})}
			</div>

			{/* Legend */}
			<div className="flex flex-wrap gap-x-5 gap-y-1.5">
				{(Object.keys(SEGMENT_LABELS) as SegmentKind[]).map(kind => {
					const style = SEGMENT_STYLES[kind]
					const total = segments.filter(s => s.kind === kind).reduce((sum, s) => sum + s.size, 0)
					if (total === 0) return null

					return (
						<div key={kind} className="flex items-center gap-1.5">
							<div className={cn('w-3 h-3 rounded-sm', style.bg)} />
							<span className={cn('text-xs', style.text)}>
								{SEGMENT_LABELS[kind]} ({total.toLocaleString()})
							</span>
						</div>
					)
				})}
			</div>

			{/* Tooltip */}
			{tooltip && (
				<SegmentTooltip
					segment={tooltip.segment}
					totalIPs={poolSize}
					x={tooltip.x}
					y={tooltip.y}
				/>
			)}
		</div>
	)
}
