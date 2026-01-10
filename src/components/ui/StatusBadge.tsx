// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { cn } from '@/lib/utils'

interface StatusBadgeProps {
	status: string
	className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
	const statusLower = status?.toLowerCase() || 'unknown'

	const statusConfig: Record<string, { bg: string; text: string; pulse?: boolean }> = {
		ready: { bg: 'bg-green-500/10', text: 'text-green-400' },
		running: { bg: 'bg-green-500/10', text: 'text-green-400' },
		healthy: { bg: 'bg-green-500/10', text: 'text-green-400' },
		provisioning: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', pulse: true },
		pending: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', pulse: true },
		updating: { bg: 'bg-blue-500/10', text: 'text-blue-400', pulse: true },
		installing: { bg: 'bg-blue-500/10', text: 'text-blue-400', pulse: true },
		deleting: { bg: 'bg-orange-500/10', text: 'text-orange-400', pulse: true },
		failed: { bg: 'bg-red-500/10', text: 'text-red-400' },
		error: { bg: 'bg-red-500/10', text: 'text-red-400' },
		notready: { bg: 'bg-red-500/10', text: 'text-red-400' },
		unknown: { bg: 'bg-neutral-500/10', text: 'text-neutral-400' },
	}

	const config = statusConfig[statusLower] || statusConfig.unknown

	return (
		<span
			className={cn(
				'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
				config.bg,
				config.text,
				className
			)}
		>
			{config.pulse && (
				<span className="relative flex h-2 w-2 mr-1.5">
					<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
					<span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
				</span>
			)}
			{status || 'Unknown'}
		</span>
	)
}
