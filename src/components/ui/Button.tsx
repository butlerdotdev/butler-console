// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
	size?: 'sm' | 'md' | 'lg'
}

export function Button({
	className,
	variant = 'primary',
	size = 'md',
	disabled,
	children,
	...props
}: ButtonProps) {
	const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed'

	const variants = {
		primary: 'bg-green-600 hover:bg-green-500 text-white focus:ring-green-500',
		secondary: 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 focus:ring-neutral-500',
		danger: 'bg-red-600 hover:bg-red-500 text-white focus:ring-red-500',
		ghost: 'hover:bg-neutral-800 text-neutral-300 focus:ring-neutral-500',
	}

	const sizes = {
		sm: 'px-3 py-1.5 text-sm',
		md: 'px-4 py-2 text-sm',
		lg: 'px-6 py-3 text-base',
	}

	return (
		<button
			className={cn(baseStyles, variants[variant], sizes[size], className)}
			disabled={disabled}
			{...props}
		>
			{children}
		</button>
	)
}
