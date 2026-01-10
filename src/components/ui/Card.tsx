// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement>

export function Card({ className, children, ...props }: CardProps) {
	return (
		<div
			className={cn(
				'bg-neutral-900 border border-neutral-800 rounded-lg',
				className
			)}
			{...props}
		>
			{children}
		</div>
	)
}
