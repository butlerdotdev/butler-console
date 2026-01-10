// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { cn } from '@/lib/utils'

interface SpinnerProps {
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
	const sizes = {
		sm: 'h-4 w-4',
		md: 'h-6 w-6',
		lg: 'h-8 w-8',
	}

	return (
		<div
			className={cn(
				'animate-spin rounded-full border-2 border-neutral-700 border-t-green-500',
				sizes[size],
				className
			)}
		/>
	)
}
