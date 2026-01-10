// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
	isOpen: boolean
	onClose: () => void
	children: ReactNode
	className?: string
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const sizeClasses = {
	sm: 'max-w-sm',
	md: 'max-w-md',
	lg: 'max-w-lg',
	xl: 'max-w-xl',
	full: 'max-w-4xl w-full',
}

export function Modal({ isOpen, onClose, children, className = '', size }: ModalProps) {
	const overlayRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isOpen) onClose()
		}
		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [isOpen, onClose])

	useEffect(() => {
		document.body.style.overflow = isOpen ? 'hidden' : ''
		return () => { document.body.style.overflow = '' }
	}, [isOpen])

	if (!isOpen) return null

	return createPortal(
		<div
			ref={overlayRef}
			onClick={(e) => e.target === overlayRef.current && onClose()}
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		>
			<div className={`relative bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl max-h-[90vh] overflow-auto ${size ? sizeClasses[size] : ''} ${className}`}>
				{children}
			</div>
		</div>,
		document.body
	)
}

export function ModalHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
	return <div className={`px-6 py-4 border-b border-neutral-800 ${className}`}>{children}</div>
}

export function ModalBody({ children, className = '' }: { children: ReactNode; className?: string }) {
	return <div className={`px-6 py-4 ${className}`}>{children}</div>
}

export function ModalFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
	return <div className={`px-6 py-4 border-t border-neutral-800 flex justify-end gap-3 ${className}`}>{children}</div>
}
