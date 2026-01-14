// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ToastContext } from './ToastContext'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
	id: string
	type: ToastType
	title: string
	message?: string
}

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([])

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}, [])

	const addToast = useCallback(
		(type: ToastType, title: string, message?: string, duration = 5000) => {
			const id = Math.random().toString(36).substring(2, 9)
			setToasts((prev) => [...prev, { id, type, title, message }])
			if (duration > 0) setTimeout(() => removeToast(id), duration)
		},
		[removeToast]
	)

	const success = useCallback(
		(title: string, message?: string) => addToast('success', title, message),
		[addToast]
	)
	const error = useCallback(
		(title: string, message?: string) => addToast('error', title, message, 8000),
		[addToast]
	)
	const warning = useCallback(
		(title: string, message?: string) => addToast('warning', title, message),
		[addToast]
	)
	const info = useCallback(
		(title: string, message?: string) => addToast('info', title, message),
		[addToast]
	)

	return (
		<ToastContext.Provider value={{ success, error, warning, info }}>
			{children}
			{toasts.length > 0 &&
				createPortal(
					<div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
						{toasts.map((toast) => (
							<ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
						))}
					</div>,
					document.body
				)}
		</ToastContext.Provider>
	)
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
	const styles: Record<ToastType, string> = {
		success: 'bg-green-500/10 border-green-500/20',
		error: 'bg-red-500/10 border-red-500/20',
		warning: 'bg-yellow-500/10 border-yellow-500/20',
		info: 'bg-blue-500/10 border-blue-500/20',
	}

	const icons: Record<ToastType, ReactNode> = {
		success: (
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
		),
		error: (
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
		),
		warning: (
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
			/>
		),
		info: (
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		),
	}

	const colors: Record<ToastType, string> = {
		success: 'text-green-400',
		error: 'text-red-400',
		warning: 'text-yellow-400',
		info: 'text-blue-400',
	}

	return (
		<div
			className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm ${styles[toast.type]}`}
		>
			<svg
				className={`w-5 h-5 flex-shrink-0 ${colors[toast.type]}`}
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				{icons[toast.type]}
			</svg>
			<div className="flex-1 min-w-0">
				<p className="font-medium text-neutral-100">{toast.title}</p>
				{toast.message && <p className="text-sm text-neutral-400 mt-1">{toast.message}</p>}
			</div>
			<button
				onClick={onClose}
				className="flex-shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors"
			>
				<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>
	)
}
