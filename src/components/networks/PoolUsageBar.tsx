// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { cn } from '@/lib/utils'

interface PoolUsageBarProps {
	allocated: number
	total: number
	className?: string
}

export function PoolUsageBar({ allocated, total, className }: PoolUsageBarProps) {
	const pct = total > 0 ? Math.round((allocated / total) * 100) : 0

	const barColor = pct >= 90
		? 'bg-red-500'
		: pct >= 80
			? 'bg-amber-500'
			: 'bg-green-500'

	return (
		<div className={cn('space-y-1', className)}>
			<div className="flex justify-between text-xs">
				<span className="text-neutral-400">{allocated} / {total} IPs</span>
				<span className={cn(
					pct >= 90 ? 'text-red-400' : pct >= 80 ? 'text-amber-400' : 'text-neutral-400'
				)}>
					{pct}%
				</span>
			</div>
			<div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
				<div
					className={cn('h-full rounded-full transition-all', barColor)}
					style={{ width: `${Math.min(pct, 100)}%` }}
				/>
			</div>
		</div>
	)
}
