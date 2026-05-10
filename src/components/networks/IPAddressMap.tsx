// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { ipToInt, intToIp, parseCIDR } from '@/lib/ip-math'
import { computeRangeBreakdown } from '@/lib/network-pool'
import type { NetworkPoolSpec, InfrastructureAllocation, IPAllocation } from '@/types/networks'
import type { PoolRange, PoolRangeKind } from '@/lib/network-pool'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

type BlockStatus = 'free' | 'reserved' | 'reserved-infra' | 'allocated-nodes' | 'allocated-lb' | 'mixed' | 'gateway'

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
	tenantAllocation?: NetworkPoolSpec['tenantAllocation']
	allocations: Array<{
		metadata: { name: string; uid?: string; namespace: string }
		spec: {
			poolRef: { name: string; namespace?: string }
			tenantClusterRef?: { name: string; namespace?: string }
			type?: string
			count?: number
		}
		status?: {
			phase?: string
			startAddress?: string
			endAddress?: string
		}
	}>
	infrastructureAllocations?: InfrastructureAllocation[]
}

// ----------------------------------------------------------------------------
// Styling
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
	'reserved-infra': {
		bg: 'bg-indigo-500/40',
		border: 'border-indigo-400/50',
		text: 'text-indigo-300',
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
	'reserved-infra': 'Infrastructure',
	'allocated-nodes': 'Nodes',
	'allocated-lb': 'Load Balancer',
	mixed: 'Mixed',
	gateway: 'Gateway',
}

const RANGE_KIND_STYLES: Record<PoolRangeKind, { dot: string; text: string; label: string }> = {
	gateway: { dot: 'bg-cyan-500', text: 'text-cyan-400', label: 'Gateway' },
	reserved: { dot: 'bg-neutral-500', text: 'text-neutral-300', label: 'Reserved' },
	tenant: { dot: 'bg-blue-500', text: 'text-blue-400', label: 'Tenant' },
	unassigned: { dot: 'bg-neutral-700', text: 'text-neutral-500', label: 'Unassigned' },
}

// ----------------------------------------------------------------------------
// IP classification (reused in sub-grid)
// ----------------------------------------------------------------------------

interface ParsedInfraAllocation {
	ip: number
	source: string
	serviceName: string
	serviceNamespace: string
}

interface ParsedAllocationRange {
	start: number
	end: number
	name: string
	clusterName?: string
	type?: string
}

function classifyIP(
	ip: number,
	poolStart: number,
	reservedRanges: Array<{ start: number; end: number; description?: string }>,
	allocationRanges: ParsedAllocationRange[],
	infraAllocations: ParsedInfraAllocation[],
): Block {
	const label = intToIp(ip)

	if (ip === poolStart) {
		return { start: ip, end: ip, label, status: 'gateway', description: 'Network/Gateway address' }
	}

	const infraMatch = infraAllocations.find(a => a.ip === ip)
	if (infraMatch) {
		return {
			start: ip, end: ip, label, status: 'reserved-infra',
			description: `${infraMatch.source} (${infraMatch.serviceNamespace}/${infraMatch.serviceName})`,
		}
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
// Tooltip
// ----------------------------------------------------------------------------

function BlockTooltip({ block, x, y }: { block: Block; x: number; y: number }) {
	return (
		<div
			className="fixed z-50 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 shadow-xl pointer-events-none"
			style={{ left: x, top: y, transform: 'translate(-50%, -100%) translateY(-8px)' }}
		>
			<div className="text-xs space-y-0.5 whitespace-nowrap">
				<div className="text-neutral-100 font-mono font-medium">{block.label}</div>
				<div className="text-neutral-400">
					Status: <span className={STATUS_STYLES[block.status].text}>{STATUS_LABELS[block.status]}</span>
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
// IP Sub-Grid (16 columns, shown when a range is expanded)
// ----------------------------------------------------------------------------

function IPSubGrid({
	range,
	poolStart,
	reservedRanges,
	allocationRanges,
	infraAllocations,
}: {
	range: PoolRange
	poolStart: number
	reservedRanges: Array<{ start: number; end: number; description?: string }>
	allocationRanges: ParsedAllocationRange[]
	infraAllocations: ParsedInfraAllocation[]
}) {
	const [tooltip, setTooltip] = useState<{ block: Block; x: number; y: number } | null>(null)

	const ips = useMemo(() => {
		const result: Block[] = []
		const count = ((range.endIP - range.startIP + 1) >>> 0)
		for (let i = 0; i < count; i++) {
			const ip = (range.startIP + i) >>> 0
			result.push(classifyIP(ip, poolStart, reservedRanges, allocationRanges, infraAllocations))
		}
		return result
	}, [range, poolStart, reservedRanges, allocationRanges, infraAllocations])

	const handleMouseEnter = (block: Block, e: React.MouseEvent) => {
		const rect = (e.target as HTMLElement).getBoundingClientRect()
		setTooltip({ block, x: rect.left + rect.width / 2, y: rect.top })
	}

	return (
		<div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 overflow-x-auto">
			{/* Column headers */}
			<div className="grid grid-cols-[auto_repeat(16,1fr)] gap-0.5 mb-1">
				<div className="w-24" />
				{Array.from({ length: 16 }, (_, i) => (
					<div key={i} className="text-[9px] text-neutral-600 text-center font-mono">
						.{i}
					</div>
				))}
			</div>

			{/* IP rows */}
			{Array.from({ length: Math.ceil(ips.length / 16) }, (_, row) => {
				const rowStart = row * 16
				const firstIP = ips[rowStart]
				const baseOctets = intToIp(firstIP.start).split('.')
				const lastOctet = parseInt(baseOctets[3], 10)
				const rowLabel = `${baseOctets[0]}.${baseOctets[1]}.${baseOctets[2]}.${lastOctet - (lastOctet % 16)}`

				return (
					<div key={row} className="grid grid-cols-[auto_repeat(16,1fr)] gap-0.5">
						<div className="w-24 text-[9px] text-neutral-600 font-mono flex items-center justify-end pr-2 truncate">
							{rowLabel}
						</div>
						{Array.from({ length: 16 }, (_, col) => {
							const idx = rowStart + col
							if (idx >= ips.length) return <div key={col} />
							const ip = ips[idx]
							const style = STATUS_STYLES[ip.status]
							return (
								<div
									key={col}
									className={cn(
										'w-full aspect-square rounded-[2px] border transition-all duration-100',
										style.bg, style.border,
										'hover:brightness-150 hover:scale-125 hover:z-10',
									)}
									onMouseEnter={(e) => handleMouseEnter(ip, e)}
									onMouseLeave={() => setTooltip(null)}
									aria-label={`${ip.label}: ${STATUS_LABELS[ip.status]}`}
								/>
							)
						})}
					</div>
				)
			})}

			{tooltip && <BlockTooltip block={tooltip.block} x={tooltip.x} y={tooltip.y} />}
		</div>
	)
}

// ----------------------------------------------------------------------------
// Range Row
// ----------------------------------------------------------------------------

function RangeRow({
	range,
	expanded,
	onToggle,
	poolStart,
	reservedRanges,
	allocationRanges,
	infraAllocations,
}: {
	range: PoolRange
	expanded: boolean
	onToggle: () => void
	poolStart: number
	reservedRanges: Array<{ start: number; end: number; description?: string }>
	allocationRanges: ParsedAllocationRange[]
	infraAllocations: ParsedInfraAllocation[]
}) {
	const kindStyle = RANGE_KIND_STYLES[range.kind]
	const canExpand = range.kind !== 'unassigned' && range.totalIPs <= 1024
	const utilizationPct = range.totalIPs > 0 ? (range.consumedIPs / range.totalIPs) * 100 : 0

	return (
		<div className="border border-neutral-800 rounded-lg overflow-hidden">
			{/* Row header */}
			<button
				onClick={canExpand ? onToggle : undefined}
				className={cn(
					'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
					canExpand ? 'hover:bg-neutral-800/50 cursor-pointer' : 'cursor-default',
					range.kind === 'unassigned' && 'opacity-60',
				)}
			>
				{/* Expand chevron */}
				<div className="w-4 flex-shrink-0">
					{canExpand && (
						<svg
							className={cn('w-4 h-4 text-neutral-500 transition-transform', expanded && 'rotate-90')}
							fill="none" stroke="currentColor" viewBox="0 0 24 24"
						>
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
						</svg>
					)}
				</div>

				{/* Color dot + kind label */}
				<div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', kindStyle.dot)} />
				<span className={cn('text-xs font-medium w-20 flex-shrink-0', kindStyle.text)}>
					{kindStyle.label}
				</span>

				{/* Range notation */}
				<span className="text-sm text-neutral-200 font-mono flex-1 min-w-0 truncate">
					{range.label}
				</span>

				{/* Description */}
				{range.description && (
					<span className="text-xs text-neutral-500 hidden md:block flex-shrink-0">
						{range.description}
					</span>
				)}

				{/* Mini utilization bar */}
				{range.kind !== 'gateway' && range.kind !== 'unassigned' && (
					<div className="w-24 h-2 bg-neutral-800 rounded-full overflow-hidden flex-shrink-0 hidden sm:block">
						<div
							className={cn(
								'h-full rounded-full transition-all',
								range.kind === 'reserved' ? 'bg-indigo-500/60' : 'bg-blue-500/60',
							)}
							style={{ width: `${Math.min(utilizationPct, 100)}%` }}
						/>
					</div>
				)}

				{/* IP count summary */}
				<span className="text-xs text-neutral-400 font-mono flex-shrink-0 w-32 text-right">
					{range.kind === 'gateway' ? (
						'1 IP'
					) : range.kind === 'unassigned' ? (
						`${range.totalIPs.toLocaleString()} IPs`
					) : (
						`${range.consumedIPs}/${range.totalIPs} used`
					)}
				</span>
			</button>

			{/* Expanded content */}
			{expanded && (
				<div className="px-4 pb-4 space-y-3">
					{/* Detail summary for reserved ranges */}
					{range.kind === 'reserved' && range.infraDetails.length > 0 && (
						<div className="text-xs text-neutral-400 px-1">
							{range.infraDetails.length} infrastructure service{range.infraDetails.length !== 1 ? 's' : ''} allocated,{' '}
							{range.freeIPs} IP{range.freeIPs !== 1 ? 's' : ''} unused
						</div>
					)}

					{/* Detail summary for tenant ranges */}
					{range.kind === 'tenant' && range.tenantDetails.length > 0 && (
						<div className="space-y-1 px-1">
							{range.tenantDetails.map((td, i) => (
								<div key={i} className="flex items-center gap-2 text-xs">
									<div className={cn(
										'w-2 h-2 rounded-full flex-shrink-0',
										td.type === 'loadbalancer' ? 'bg-purple-500' : 'bg-blue-500',
									)} />
									<span className="text-neutral-300">{td.clusterName}</span>
									<span className="text-neutral-500 capitalize">{td.type === 'loadbalancer' ? 'LB' : td.type}</span>
									<span className="text-neutral-500 font-mono">
										{intToIp(td.start)}{td.start !== td.end ? ` - ${intToIp(td.end)}` : ''}
									</span>
									<span className="text-neutral-500">({td.count} IP{td.count !== 1 ? 's' : ''})</span>
								</div>
							))}
							{range.freeIPs > 0 && (
								<div className="text-xs text-neutral-500 mt-1">
									{range.freeIPs} IP{range.freeIPs !== 1 ? 's' : ''} available
								</div>
							)}
						</div>
					)}

					{/* IP sub-grid */}
					<IPSubGrid
						range={range}
						poolStart={poolStart}
						reservedRanges={reservedRanges}
						allocationRanges={allocationRanges}
						infraAllocations={infraAllocations}
					/>
				</div>
			)}
		</div>
	)
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export function IPAddressMap({ cidr, reserved = [], tenantAllocation, allocations, infrastructureAllocations = [] }: IPAddressMapProps) {
	const ranges = useMemo(
		() => computeRangeBreakdown(
			cidr,
			reserved,
			tenantAllocation,
			allocations as IPAllocation[],
			infrastructureAllocations,
		),
		[cidr, reserved, tenantAllocation, allocations, infrastructureAllocations],
	)

	const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set())

	const toggleExpanded = (idx: number) => {
		setExpandedSet(prev => {
			const next = new Set(prev)
			if (next.has(idx)) {
				next.delete(idx)
			} else {
				next.add(idx)
			}
			return next
		})
	}

	// Pre-parse ranges for sub-grid classification
	const poolStart = useMemo(() => parseCIDR(cidr).start, [cidr])

	const reservedRanges = useMemo(() =>
		reserved.map(r => {
			const parsed = parseCIDR(r.cidr)
			return { start: parsed.start, end: parsed.end, description: r.description }
		}),
		[reserved],
	)

	const allocationRanges: ParsedAllocationRange[] = useMemo(() =>
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

	const infraAllocations: ParsedInfraAllocation[] = useMemo(() =>
		infrastructureAllocations.map(a => ({
			ip: ipToInt(a.ip),
			source: a.source,
			serviceName: a.serviceRef.name,
			serviceNamespace: a.serviceRef.namespace,
		})),
		[infrastructureAllocations],
	)

	// Summary stats
	const summary = useMemo(() => {
		let totalReserved = 0, totalInfra = 0, totalTenant = 0, totalTenantUsed = 0, totalUnassigned = 0
		for (const r of ranges) {
			if (r.kind === 'reserved') {
				totalReserved += r.totalIPs
				totalInfra += r.infraDetails.length
			} else if (r.kind === 'tenant') {
				totalTenant += r.totalIPs
				totalTenantUsed += r.consumedIPs
			} else if (r.kind === 'unassigned') {
				totalUnassigned += r.totalIPs
			}
		}
		return { totalReserved, totalInfra, totalTenant, totalTenantUsed, totalUnassigned }
	}, [ranges])

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-baseline justify-between">
				<h3 className="text-sm font-medium text-neutral-200">IP Address Map</h3>
				<span className="text-xs text-neutral-500">
					{ranges.length} range{ranges.length !== 1 ? 's' : ''} &middot;{' '}
					{summary.totalInfra > 0 && `${summary.totalInfra} infra &middot; `}
					{summary.totalTenantUsed}/{summary.totalTenant} tenant IPs used
				</span>
			</div>

			{/* Range list */}
			<div className="space-y-1.5">
				{ranges.map((range, i) => (
					<RangeRow
						key={i}
						range={range}
						expanded={expandedSet.has(i)}
						onToggle={() => toggleExpanded(i)}
						poolStart={poolStart}
						reservedRanges={reservedRanges}
						allocationRanges={allocationRanges}
						infraAllocations={infraAllocations}
					/>
				))}
			</div>

			{/* Legend */}
			<div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-2">
				{(Object.keys(STATUS_LABELS) as BlockStatus[]).map(status => {
					if (status === 'reserved-infra') return null
					if (status === 'mixed') return null
					const style = STATUS_STYLES[status]
					return (
						<div key={status} className="flex items-center gap-1.5">
							<div className={cn('w-3 h-3 rounded-sm border', style.bg, style.border)} />
							<span className="text-xs text-neutral-400">{STATUS_LABELS[status]}</span>
							{status === 'reserved' && (
								<>
									<div className={cn('w-3 h-3 rounded-sm border', STATUS_STYLES['reserved-infra'].bg, STATUS_STYLES['reserved-infra'].border)} />
									<span className="text-xs text-indigo-400">Infra</span>
								</>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
