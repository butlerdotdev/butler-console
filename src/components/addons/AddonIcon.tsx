// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { cn } from '@/lib/utils'

interface AddonIconProps {
	name: string
	icon?: string
	iconData?: string
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

const SIZE_CLASSES = {
	sm: { container: 'w-6 h-6', img: 'w-4 h-4', text: 'text-sm' },
	md: { container: 'w-10 h-10', img: 'w-6 h-6', text: 'text-xl' },
	lg: { container: 'w-12 h-12', img: 'w-8 h-8', text: 'text-2xl' },
}

export function AddonIcon({ name, icon, iconData, size = 'md', className }: AddonIconProps) {
	const s = SIZE_CLASSES[size]
	const hasIcon = !!iconData

	return (
		<div className={cn(s.container, 'rounded-lg flex items-center justify-center flex-shrink-0', hasIcon ? 'bg-white' : 'bg-neutral-800', className)}>
			{hasIcon ? (
				<img
					src={`data:image/svg+xml;base64,${iconData}`}
					alt={name}
					className={s.img}
				/>
			) : (
				<span className={s.text}>{icon || '📦'}</span>
			)}
		</div>
	)
}
