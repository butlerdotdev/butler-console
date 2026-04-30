// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface AddonIconProps {
	name: string
	icon?: string
	size?: 'sm' | 'md' | 'lg'
	className?: string
}

const SIZE_CLASSES = {
	sm: { container: 'w-6 h-6', img: 'w-4 h-4', text: 'text-sm' },
	md: { container: 'w-10 h-10', img: 'w-6 h-6', text: 'text-xl' },
	lg: { container: 'w-12 h-12', img: 'w-8 h-8', text: 'text-2xl' },
}

export function AddonIcon({ name, icon, size = 'md', className }: AddonIconProps) {
	const [svgFailed, setSvgFailed] = useState(false)
	const s = SIZE_CLASSES[size]

	return (
		<div className={cn(s.container, 'rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0', className)}>
			{!svgFailed ? (
				<img
					src={`/addon-icons/${name}.svg`}
					alt=""
					className={s.img}
					onError={() => setSvgFailed(true)}
				/>
			) : (
				<span className={s.text}>{icon || '📦'}</span>
			)}
		</div>
	)
}
