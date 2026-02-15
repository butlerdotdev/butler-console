// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { cn } from '@/lib/utils'

interface ResourceUsageBarProps {
	label: string
	used: number | string
	limit: number | string | null | undefined
	unit?: string
	className?: string
}

/**
 * Parses a Kubernetes resource.Quantity string (e.g., "48", "192Gi", "4800Gi")
 * into a numeric value. For simplicity, returns the base numeric value and
 * normalizes Gi/Mi/Ki suffixes.
 */
function parseQuantity(value: string | number): number {
	if (typeof value === 'number') return value
	const str = value.trim()
	if (!str) return 0

	// Try direct numeric parse first
	const direct = Number(str)
	if (!isNaN(direct)) return direct

	// Handle Kubernetes quantity suffixes
	const match = str.match(/^(\d+(?:\.\d+)?)\s*(Ki|Mi|Gi|Ti|Pi|k|M|G|T|P|m)?$/)
	if (!match) return 0

	const num = parseFloat(match[1])
	const suffix = match[2]

	switch (suffix) {
		case 'Ki': return num / 1024 / 1024 // Convert to Gi for display
		case 'Mi': return num / 1024 // Convert to Gi for display
		case 'Gi': return num
		case 'Ti': return num * 1024
		case 'Pi': return num * 1024 * 1024
		case 'k': return num / 1000 / 1000 // SI units
		case 'M': return num / 1000
		case 'G': return num
		case 'T': return num * 1000
		case 'P': return num * 1000 * 1000
		case 'm': return num / 1000 // millicores
		default: return num
	}
}

/**
 * Formats a quantity value for display with the appropriate unit.
 */
function formatQuantity(value: string | number, unit?: string): string {
	if (typeof value === 'number') {
		return unit ? `${value} ${unit}` : `${value}`
	}
	const str = value.trim()
	// If it has a unit suffix already, display as-is
	if (/[a-zA-Z]$/.test(str)) {
		return str
	}
	return unit ? `${str} ${unit}` : str
}

export function ResourceUsageBar({ label, used, limit, unit, className }: ResourceUsageBarProps) {
	const usedNum = parseQuantity(used)
	const hasLimit = limit !== null && limit !== undefined && limit !== '' && limit !== 0
	const limitNum = hasLimit ? parseQuantity(limit) : 0

	const pct = hasLimit && limitNum > 0 ? Math.round((usedNum / limitNum) * 100) : 0

	const barColor = pct >= 90
		? 'bg-red-500'
		: pct >= 80
			? 'bg-amber-500'
			: 'bg-green-500'

	const textColor = pct >= 90
		? 'text-red-400'
		: pct >= 80
			? 'text-amber-400'
			: 'text-neutral-400'

	const usedDisplay = formatQuantity(used, unit)
	const limitDisplay = hasLimit ? formatQuantity(limit!, unit) : null

	return (
		<div className={cn('space-y-1.5', className)}>
			<div className="flex justify-between items-baseline">
				<span className="text-sm text-neutral-300">{label}</span>
				<span className={cn('text-sm font-mono', hasLimit ? textColor : 'text-neutral-400')}>
					{usedDisplay}
					{limitDisplay ? (
						<span className="text-neutral-500"> / {limitDisplay}</span>
					) : (
						<span className="text-neutral-600 text-xs ml-1">No limit</span>
					)}
				</span>
			</div>
			<div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
				{hasLimit ? (
					<div
						className={cn('h-full rounded-full transition-all', barColor)}
						style={{ width: `${Math.min(pct, 100)}%` }}
					/>
				) : (
					<div
						className="h-full rounded-full bg-neutral-600/50 transition-all"
						style={{ width: usedNum > 0 ? '100%' : '0%' }}
					/>
				)}
			</div>
			{hasLimit && (
				<div className="text-right">
					<span className={cn('text-xs', textColor)}>{pct}%</span>
				</div>
			)}
		</div>
	)
}

export { parseQuantity }
