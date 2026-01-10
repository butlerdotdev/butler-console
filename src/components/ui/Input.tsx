// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label?: string
	error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
	({ className, label, error, id, ...props }, ref) => {
		return (
			<div className="space-y-1">
				{label && (
					<label htmlFor={id} className="block text-sm font-medium text-neutral-300">
						{label}
					</label>
				)}
				<input
					id={id}
					ref={ref}
					className={cn(
						'block w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500',
						'focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent',
						'disabled:opacity-50 disabled:cursor-not-allowed',
						error && 'border-red-500',
						className
					)}
					{...props}
				/>
				{error && <p className="text-sm text-red-400">{error}</p>}
			</div>
		)
	}
)

Input.displayName = 'Input'
