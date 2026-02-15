// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

// ----------------------------------------------------------------------------
// IP Math Helpers
// ----------------------------------------------------------------------------

function ipToInt(ip: string): number {
	return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

function intToIp(n: number): string {
	return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.')
}

function parseCIDR(cidr: string): { start: number; end: number; prefix: number; size: number } {
	const [ip, prefix] = cidr.split('/')
	const p = parseInt(prefix, 10)
	const mask = p === 0 ? 0 : (~0 << (32 - p)) >>> 0
	const start = ipToInt(ip) & mask
	const size = 1 << (32 - p)
	return { start, end: (start + size - 1) >>> 0, prefix: p, size }
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type BlockStatus = 'free' | 'reserved' | 'allocated-nodes' | 'allocated-lb' | 'mixed' | 'gateway'

interface Block {
	start: number
	end: number
	label: string
	status: BlockStatus
	allocationName?: string
	clusterName?: string
	description?: string
}

interface IPAddressMapProps {
	cidr: string
	reserved?: Array<{ cidr: string; description?: string }>
	allocations: Array<{
		metadata: { name: string }
		spec: {
			tenantClusterRef?: { name: string; namespace?: string }
			type?: string
		}
		status?: {
			startAddress?: string
			endAddress?: string
		}
	}>
}

interface ParsedAllocationRange {
	start: number
	end: number
	name: string
	clusterName?: string
	type?: string
}

interface ParsedReservedRange {
	start: number
	end: number
	prefix: number
	size: number
	description?: string
}

// ----------------------------------------------------------------------------
// Status styling
// ----------------------------------------------------------------------------

const STATUS_STYLES: Record<BlockStatus, { bg: string; border: string; text: string }> = {
	free: {
		bg: 'bg-emerald-900/40',
		border: 'border-emerald-700/30',
		text: 'text-emerald-400',
	},
	reserved: {
		bg: 'bg-neutral-700/40',
		border: 'border-neutral-600/30',
		text: 'text-neutral-400',
	},
	'allocated-nodes': {
		bg: 'bg-blue-500/30',
		border: 'border-blue-500/40',
		text: 'text-blue-400',
	},
	'allocated-lb': {
		bg: 'bg-purple-500/30',
		border: 'border-purple-500/40',
		text: 'text-purple-400',
	},
	mixed: {
		bg: 'bg-amber-500/20',
		border: 'border-amber-500/30',
		text: 'text-amber-400',
	},
	gateway: {
		bg: 'bg-cyan-500/20',
		border: 'border-cyan-500/30',
		text: 'text-cyan-400',
	},
}

const STATUS_LABELS: Record<BlockStatus, string> = {
	free: 'Available',
	reserved: 'Reserved',
	'allocated-nodes': 'Nodes',
	'allocated-lb': 'Load Balancer',
	mixed: 'Mixed',
	gateway: 'Gateway',
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
	return aStart <= bEnd && bStart <= aEnd
}

function statusDisplayName(status: BlockStatus): string {
	switch (status) {
		case 'free': return 'Available'
		case 'reserved': return 'Reserved'
		case 'allocated-nodes': return 'Allocated (Nodes)'
		case 'allocated-lb': return 'Allocated (Load Balancer)'
		case 'mixed': return 'Mixed'
		case 'gateway': return 'Gateway'
	}
}

function classifyIP(
	ip: number,
	poolStart: number,
	reservedRanges: ParsedReservedRange[],
	allocationRanges: ParsedAllocationRange[],
): Block {
	const label = intToIp(ip)

	// Gateway = first IP in pool
	if (ip === poolStart) {
		return { start: ip, end: ip, label, status: 'gateway', description: 'Network/Gateway address' }
	}

	const statuses = new Set<BlockStatus>()
	let matchedAllocationName: string | undefined
	let matchedClusterName: string | undefined
	let matchedDescription: string | undefined

	for (const r of reservedRanges) {
		if (ip >= r.start && ip <= r.end) {
			statuses.add('reserved')
			matchedDescription = r.description
		}
	}

	for (const a of allocationRanges) {
		if (ip >= a.start && ip <= a.end) {
			const allocStatus: BlockStatus = a.type === 'loadbalancer' ? 'allocated-lb' : 'allocated-nodes'
			statuses.add(allocStatus)
			matchedAllocationName = a.name
			matchedClusterName = a.clusterName
		}
	}

	let status: BlockStatus
	if (statuses.size === 0) {
		status = 'free'
	} else if (statuses.size === 1) {
		status = statuses.values().next().value!
	} else {
		status = 'mixed'
	}

	return { start: ip, end: ip, label, status, allocationName: matchedAllocationName, clusterName: matchedClusterName, description: matchedDescription }
}

// ----------------------------------------------------------------------------
// Tooltip Component
// ----------------------------------------------------------------------------

function BlockTooltip({ block, visible, x, y }: { block: Block; visible: boolean; x: number; y: number }) {
	if (!visible) return null

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
				<div className="text-neutral-100 font-mono font-medium">{block.label}</div>
				<div className="text-neutral-400">
					Status: <span className={STATUS_STYLES[block.status].text}>{statusDisplayName(block.status)}</span>
				</div>
				{block.clusterName && (
					<div className="text-neutral-400">
						Cluster: <span className="text-neutral-200">{block.clusterName}</span>
					</div>
				)}
				{block.allocationName && (
					<div className="text-neutral-400">
						Allocation: <span className="text-neutral-200">{block.allocationName}</span>
					</div>
				)}
				{block.description && (
					<div className="text-neutral-400">
						Note: <span className="text-neutral-200">{block.description}</span>
					</div>
				)}
			</div>
		</div>
	)
}

// ----------------------------------------------------------------------------
// Filter helpers
// ----------------------------------------------------------------------------

function ipMatchesFilter(
	ip: number,
	allocationRanges: ParsedAllocationRange[],
	tenantFilter: string,
	typeFilter: string,
): boolean {
	// Unallocated IPs don't match any tenant/type filter
	const matchingAllocations = allocationRanges.filter(a => ip >= a.start && ip <= a.end)
	if (matchingAllocations.length === 0) return false

	return matchingAllocations.some(a => {
		const tenantMatch = tenantFilter === '' || a.clusterName === tenantFilter
		const typeMatch = typeFilter === '' || a.type === typeFilter
		return tenantMatch && typeMatch
	})
}

function blockMatchesFilter(
	blockStart: number,
	blockEnd: number,
	allocationRanges: ParsedAllocationRange[],
	tenantFilter: string,
	typeFilter: string,
): boolean {
	const overlapping = allocationRanges.filter(a => rangesOverlap(blockStart, blockEnd, a.start, a.end))
	if (overlapping.length === 0) return false

	return overlapping.some(a => {
		const tenantMatch = tenantFilter === '' || a.clusterName === tenantFilter
		const typeMatch = typeFilter === '' || a.type === typeFilter
		return tenantMatch && typeMatch
	})
}

// ----------------------------------------------------------------------------
// Filter Dropdown Component
// ----------------------------------------------------------------------------

function FilterDropdown({
	label,
	value,
	options,
	onChange,
}: {
	label: string
	value: string
	options: Array<{ value: string; label: string }>
	onChange: (value: string) => void
}) {
	return (
		<div className="flex items-center gap-1.5">
			<span className="text-[11px] text-neutral-500">{label}:</span>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={cn(
					'text-xs bg-neutral-800 border border-neutral-700 rounded px-2 py-1',
					'text-neutral-200 focus:outline-none focus:border-neutral-500',
					'hover:border-neutral-600 transition-colors cursor-pointer',
				)}
			>
				{options.map(opt => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
		</div>
	)
}

// ----------------------------------------------------------------------------
// Drill-Down View — individual IPs within a /24 block
// ----------------------------------------------------------------------------

function DrillDownGrid({
	parentBlock,
	poolStart,
	reservedRanges,
	allocationRanges,
	tenantFilter,
	typeFilter,
	onBack,
}: {
	parentBlock: Block
	poolStart: number
	reservedRanges: ParsedReservedRange[]
	allocationRanges: ParsedAllocationRange[]
	tenantFilter: string
	typeFilter: string
	onBack: () => void
}) {
	const [tooltip, setTooltip] = useState<{ block: Block; x: number; y: number } | null>(null)

	const hasActiveFilter = tenantFilter !== '' || typeFilter !== ''

	const ips = useMemo(() => {
		const blockSize = parentBlock.end - parentBlock.start + 1
		const result: Block[] = []
		for (let i = 0; i < blockSize; i++) {
			const ip = (parentBlock.start + i) >>> 0
			result.push(classifyIP(ip, poolStart, reservedRanges, allocationRanges))
		}
		return result
	}, [parentBlock, poolStart, reservedRanges, allocationRanges])

	const summary = useMemo(() => {
		const counts = { free: 0, reserved: 0, nodes: 0, lb: 0, mixed: 0, gateway: 0, total: ips.length }
		for (const ip of ips) {
			switch (ip.status) {
				case 'free': counts.free++; break
				case 'reserved': counts.reserved++; break
				case 'allocated-nodes': counts.nodes++; break
				case 'allocated-lb': counts.lb++; break
				case 'mixed': counts.mixed++; break
				case 'gateway': counts.gateway++; break
			}
		}
		return counts
	}, [ips])

	// Filtered summary — count how many IPs match the active filter
	const filteredSummary = useMemo(() => {
		if (!hasActiveFilter) return null
		let matchCount = 0
		let ipCount = 0
		for (const ip of ips) {
			if (ipMatchesFilter(ip.start, allocationRanges, tenantFilter, typeFilter)) {
				matchCount++
				ipCount++
			}
		}
		return { matchCount, ipCount }
	}, [ips, allocationRanges, tenantFilter, typeFilter, hasActiveFilter])

	const handleMouseEnter = (block: Block, e: React.MouseEvent) => {
		const rect = (e.target as HTMLElement).getBoundingClientRect()
		setTooltip({ block, x: rect.left + rect.width / 2, y: rect.top })
	}

	return (
		<div className="space-y-3">
			{/* Drill-down header */}
			<div className="flex items-center gap-3">
				<button
					onClick={onBack}
					className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
				>
					<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
					</svg>
					Back to overview
				</button>
			</div>

			<div className="flex items-baseline justify-between">
				<div className="flex items-center gap-2">
					<h4 className="text-sm font-medium text-neutral-200 font-mono">{parentBlock.label}</h4>
					<span className={cn(
						'px-1.5 py-0.5 rounded text-[10px] font-medium',
						STATUS_STYLES[parentBlock.status].bg,
						STATUS_STYLES[parentBlock.status].text,
					)}>
						{statusDisplayName(parentBlock.status)}
					</span>
				</div>
				<span className="text-xs text-neutral-500">
					{hasActiveFilter && filteredSummary
						? `${filteredSummary.matchCount} matching / ${summary.total} IPs`
						: `${summary.free} free / ${summary.nodes + summary.lb} allocated / ${summary.total} IPs`
					}
				</span>
			</div>

			{/* IP grid — 16 columns to show .0-.15, .16-.31, etc. */}
			<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 overflow-x-auto">
				{/* Column headers: last octet mod 16 */}
				<div className="grid grid-cols-[auto_repeat(16,1fr)] gap-0.5 mb-1">
					<div className="w-16" />
					{Array.from({ length: 16 }, (_, i) => (
						<div key={i} className="text-[9px] text-neutral-600 text-center font-mono">
							.{i}
						</div>
					))}
				</div>

				{/* IP rows — 16 rows of 16 IPs each for a /24 */}
				{Array.from({ length: Math.ceil(ips.length / 16) }, (_, row) => {
					const rowStart = row * 16
					const firstIP = ips[rowStart]
					// Show the base address for this row
					const baseOctets = intToIp(firstIP.start).split('.')
					const rowLabel = `${baseOctets[0]}.${baseOctets[1]}.${baseOctets[2]}.${rowStart}`

					return (
						<div key={row} className="grid grid-cols-[auto_repeat(16,1fr)] gap-0.5">
							<div className="w-16 text-[9px] text-neutral-600 font-mono flex items-center justify-end pr-2 truncate">
								{rowLabel}
							</div>
							{Array.from({ length: 16 }, (_, col) => {
								const idx = rowStart + col
								if (idx >= ips.length) return <div key={col} />
								const ip = ips[idx]
								const style = STATUS_STYLES[ip.status]
								const isDimmed = hasActiveFilter && !ipMatchesFilter(ip.start, allocationRanges, tenantFilter, typeFilter)
								return (
									<div
										key={col}
										className={cn(
											'w-full aspect-square rounded-[2px] border transition-all duration-100',
											style.bg,
											style.border,
											'hover:brightness-150 hover:scale-125 hover:z-10',
										)}
										style={isDimmed ? { opacity: 0.2 } : undefined}
										onMouseEnter={(e) => handleMouseEnter(ip, e)}
										onMouseLeave={() => setTooltip(null)}
										aria-label={`${ip.label}: ${statusDisplayName(ip.status)}`}
									/>
								)
							})}
						</div>
					)
				})}
			</div>

			{/* Tooltip */}
			{tooltip && (
				<BlockTooltip block={tooltip.block} visible={true} x={tooltip.x} y={tooltip.y} />
			)}
		</div>
	)
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export function IPAddressMap({ cidr, reserved = [], allocations }: IPAddressMapProps) {
	const [tooltip, setTooltip] = useState<{ block: Block; x: number; y: number } | null>(null)
	const [expandedBlock, setExpandedBlock] = useState<Block | null>(null)
	const [tenantFilter, setTenantFilter] = useState<string>('')
	const [typeFilter, setTypeFilter] = useState<string>('')

	const hasActiveFilter = tenantFilter !== '' || typeFilter !== ''

	// Extract unique tenant names for the filter dropdown
	const tenantOptions = useMemo(() => {
		const names = new Set<string>()
		for (const a of allocations) {
			const name = a.spec.tenantClusterRef?.name
			if (name) names.add(name)
		}
		const sorted = Array.from(names).sort()
		return [
			{ value: '', label: 'All Tenants' },
			...sorted.map(name => ({ value: name, label: name })),
		]
	}, [allocations])

	// Extract unique allocation types for the filter dropdown
	const typeOptions = useMemo(() => {
		const types = new Set<string>()
		for (const a of allocations) {
			if (a.spec.type) types.add(a.spec.type)
		}
		const sorted = Array.from(types).sort()
		const typeLabels: Record<string, string> = {
			loadbalancer: 'Load Balancer',
			nodes: 'Nodes',
		}
		return [
			{ value: '', label: 'All Types' },
			...sorted.map(t => ({ value: t, label: typeLabels[t] || t })),
		]
	}, [allocations])

	// Parse the pool CIDR
	const pool = useMemo(() => parseCIDR(cidr), [cidr])

	// Determine block granularity
	const blockPrefix = useMemo(() => {
		if (pool.prefix >= 24) return pool.prefix // individual IPs
		if (pool.prefix >= 16) return 24           // /24 blocks
		return 16                                   // /16 blocks
	}, [pool.prefix])

	const isIndividualIPs = blockPrefix === pool.prefix && pool.prefix >= 24
	const canDrillDown = !isIndividualIPs

	// Parse reserved and allocation ranges (shared between overview + drill-down)
	const reservedRanges = useMemo(() =>
		reserved.map(r => ({ ...parseCIDR(r.cidr), description: r.description })),
		[reserved],
	)

	const allocationRanges = useMemo(() =>
		allocations
			.filter(a => a.status?.startAddress && a.status?.endAddress)
			.map(a => ({
				start: ipToInt(a.status!.startAddress!),
				end: ipToInt(a.status!.endAddress!),
				name: a.metadata.name,
				clusterName: a.spec.tenantClusterRef?.name,
				type: a.spec.type,
			})),
		[allocations],
	)

	// Build blocks
	const blocks = useMemo(() => {
		const blockSize = blockPrefix === pool.prefix
			? 1
			: 1 << (32 - blockPrefix)
		const blockCount = pool.size / blockSize
		const result: Block[] = []

		for (let i = 0; i < blockCount; i++) {
			const blockStart = (pool.start + i * blockSize) >>> 0
			const blockEnd = (blockStart + blockSize - 1) >>> 0

			let label: string
			if (isIndividualIPs) {
				label = intToIp(blockStart)
			} else {
				label = `${intToIp(blockStart)}/${blockPrefix}`
			}

			// Check if this is the gateway (first IP in pool)
			if (blockStart === pool.start && isIndividualIPs) {
				result.push({
					start: blockStart,
					end: blockEnd,
					label,
					status: 'gateway',
					description: 'Network/Gateway address',
				})
				continue
			}

			// Collect overlapping statuses
			const statuses = new Set<BlockStatus>()
			let matchedAllocationName: string | undefined
			let matchedClusterName: string | undefined
			let matchedDescription: string | undefined

			for (const r of reservedRanges) {
				if (rangesOverlap(blockStart, blockEnd, r.start, r.end)) {
					statuses.add('reserved')
					matchedDescription = r.description
				}
			}

			for (const a of allocationRanges) {
				if (rangesOverlap(blockStart, blockEnd, a.start, a.end)) {
					const allocStatus: BlockStatus = a.type === 'loadbalancer' ? 'allocated-lb' : 'allocated-nodes'
					statuses.add(allocStatus)
					matchedAllocationName = a.name
					matchedClusterName = a.clusterName
				}
			}

			let status: BlockStatus
			if (statuses.size === 0) {
				status = 'free'
			} else if (statuses.size === 1) {
				status = statuses.values().next().value!
			} else {
				status = 'mixed'
			}

			result.push({
				start: blockStart,
				end: blockEnd,
				label,
				status,
				allocationName: matchedAllocationName,
				clusterName: matchedClusterName,
				description: matchedDescription,
			})
		}

		return result
	}, [pool, blockPrefix, isIndividualIPs, reservedRanges, allocationRanges])

	// Compute summary counts
	const summary = useMemo(() => {
		const counts = { free: 0, reserved: 0, nodes: 0, lb: 0, mixed: 0, gateway: 0, total: blocks.length }
		for (const b of blocks) {
			switch (b.status) {
				case 'free': counts.free++; break
				case 'reserved': counts.reserved++; break
				case 'allocated-nodes': counts.nodes++; break
				case 'allocated-lb': counts.lb++; break
				case 'mixed': counts.mixed++; break
				case 'gateway': counts.gateway++; break
			}
		}
		return counts
	}, [blocks])

	const allocated = summary.nodes + summary.lb + summary.mixed

	// Compute filtered summary when a filter is active
	const filteredSummary = useMemo(() => {
		if (!hasActiveFilter) return null

		// Count allocations matching the filter
		const matchingAllocations = allocationRanges.filter(a => {
			const tenantMatch = tenantFilter === '' || a.clusterName === tenantFilter
			const typeMatch = typeFilter === '' || a.type === typeFilter
			return tenantMatch && typeMatch
		})

		// Count IPs covered by matching allocations
		let ipCount = 0
		for (const a of matchingAllocations) {
			ipCount += (a.end - a.start + 1)
		}

		// Count blocks that contain matching allocations
		let blockCount = 0
		for (const b of blocks) {
			if (blockMatchesFilter(b.start, b.end, allocationRanges, tenantFilter, typeFilter)) {
				blockCount++
			}
		}

		return { allocationCount: matchingAllocations.length, ipCount, blockCount }
	}, [hasActiveFilter, allocationRanges, tenantFilter, typeFilter, blocks])

	// Summary bar percentages
	const pct = (n: number) => summary.total > 0 ? (n / summary.total) * 100 : 0

	const handleMouseEnter = (block: Block, e: React.MouseEvent) => {
		const rect = (e.target as HTMLElement).getBoundingClientRect()
		setTooltip({
			block,
			x: rect.left + rect.width / 2,
			y: rect.top,
		})
	}

	const handleMouseLeave = () => {
		setTooltip(null)
	}

	const handleBlockClick = (block: Block) => {
		if (canDrillDown) {
			setTooltip(null)
			setExpandedBlock(block)
		}
	}

	// Determine cell size classes
	const cellSize = isIndividualIPs ? 'w-5 h-5' : 'w-7 h-7'

	// Determine the unit label for summary
	const unitLabel = isIndividualIPs ? 'IPs' : `/${blockPrefix} blocks`

	return (
		<div className="space-y-4">
			{/* Summary Bar */}
			<div className="space-y-2">
				<div className="flex items-baseline justify-between">
					<h3 className="text-sm font-medium text-neutral-200">IP Address Map</h3>
					<span className="text-xs text-neutral-500 font-mono">{cidr}</span>
				</div>

				{/* Filter bar */}
				{(tenantOptions.length > 1 || typeOptions.length > 1) && (
					<div className="flex items-center gap-4 flex-wrap">
						{tenantOptions.length > 1 && (
							<FilterDropdown
								label="Tenant"
								value={tenantFilter}
								options={tenantOptions}
								onChange={setTenantFilter}
							/>
						)}
						{typeOptions.length > 1 && (
							<FilterDropdown
								label="Type"
								value={typeFilter}
								options={typeOptions}
								onChange={setTypeFilter}
							/>
						)}
						{hasActiveFilter && (
							<button
								onClick={() => { setTenantFilter(''); setTypeFilter('') }}
								className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
							>
								Clear filters
							</button>
						)}
					</div>
				)}

				<div className="text-xs text-neutral-400">
					{hasActiveFilter && filteredSummary
						? `Showing ${filteredSummary.allocationCount} allocation${filteredSummary.allocationCount !== 1 ? 's' : ''} (${filteredSummary.ipCount} IPs) across ${filteredSummary.blockCount} ${unitLabel}`
						: `${summary.free} available / ${allocated} allocated / ${summary.reserved} reserved of ${summary.total} total ${unitLabel}`
					}
				</div>

				<div className="h-3 bg-neutral-800 rounded-full overflow-hidden flex">
					{pct(summary.nodes) > 0 && (
						<div
							className="h-full bg-blue-500/70 transition-all"
							style={{ width: `${pct(summary.nodes)}%` }}
							title={`Nodes: ${summary.nodes}`}
						/>
					)}
					{pct(summary.lb) > 0 && (
						<div
							className="h-full bg-purple-500/70 transition-all"
							style={{ width: `${pct(summary.lb)}%` }}
							title={`Load Balancer: ${summary.lb}`}
						/>
					)}
					{pct(summary.mixed) > 0 && (
						<div
							className="h-full bg-amber-500/50 transition-all"
							style={{ width: `${pct(summary.mixed)}%` }}
							title={`Mixed: ${summary.mixed}`}
						/>
					)}
					{pct(summary.reserved) > 0 && (
						<div
							className="h-full bg-neutral-600/70 transition-all"
							style={{ width: `${pct(summary.reserved)}%` }}
							title={`Reserved: ${summary.reserved}`}
						/>
					)}
					{pct(summary.gateway) > 0 && (
						<div
							className="h-full bg-cyan-500/40 transition-all"
							style={{ width: `${pct(summary.gateway)}%` }}
							title={`Gateway: ${summary.gateway}`}
						/>
					)}
					{pct(summary.free) > 0 && (
						<div
							className="h-full bg-emerald-500/50 flex-1 transition-all"
							title={`Available: ${summary.free}`}
						/>
					)}
				</div>
			</div>

			{/* Drill-down view or overview grid */}
			{expandedBlock ? (
				<DrillDownGrid
					parentBlock={expandedBlock}
					poolStart={pool.start}
					reservedRanges={reservedRanges}
					allocationRanges={allocationRanges}
					tenantFilter={tenantFilter}
					typeFilter={typeFilter}
					onBack={() => setExpandedBlock(null)}
				/>
			) : (
				<>
					{/* Overview Grid */}
					<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 overflow-x-auto">
						{canDrillDown && (
							<div className="text-[10px] text-neutral-600 mb-2">Click a block to drill down into individual IPs</div>
						)}
						<div className="grid grid-cols-16 gap-0.5" role="img" aria-label={`IP address map for ${cidr}`}>
							{blocks.map((block, i) => {
								const style = STATUS_STYLES[block.status]
								const isDimmed = hasActiveFilter && !blockMatchesFilter(
									block.start, block.end, allocationRanges, tenantFilter, typeFilter,
								)

								return (
									<div
										key={i}
										className={cn(
											cellSize,
											'rounded-sm border transition-all duration-100',
											style.bg,
											style.border,
											canDrillDown && 'cursor-pointer',
											'hover:brightness-125 hover:scale-110 hover:z-10',
										)}
										style={isDimmed ? { opacity: 0.2 } : undefined}
										onClick={() => handleBlockClick(block)}
										onMouseEnter={(e) => handleMouseEnter(block, e)}
										onMouseLeave={handleMouseLeave}
										aria-label={`${block.label}: ${statusDisplayName(block.status)}`}
									/>
								)
							})}
						</div>
					</div>

					{/* Tooltip */}
					{tooltip && (
						<BlockTooltip block={tooltip.block} visible={true} x={tooltip.x} y={tooltip.y} />
					)}
				</>
			)}

			{/* Legend */}
			<div className="flex flex-wrap gap-x-5 gap-y-1.5">
				{(Object.keys(STATUS_LABELS) as BlockStatus[]).map(status => {
					const style = STATUS_STYLES[status]
					return (
						<div key={status} className="flex items-center gap-1.5">
							<div className={cn('w-3 h-3 rounded-sm border', style.bg, style.border)} />
							<span className="text-xs text-neutral-400">{STATUS_LABELS[status]}</span>
						</div>
					)
				})}
			</div>
		</div>
	)
}
