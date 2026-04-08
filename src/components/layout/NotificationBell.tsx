// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useToast } from '@/hooks/useToast'
import type { Notification } from '@/types/notifications'

function getNavigationPath(notification: Notification): string | null {
	const ref = notification.resourceRef
	if (!ref) return null
	switch (ref.kind) {
		case 'TenantCluster':
			if (ref.team) return `/t/${ref.team}/clusters/${ref.namespace}/${ref.name}`
			if (ref.namespace) return `/admin/clusters/${ref.namespace}/${ref.name}`
			return null
		case 'Team': return `/admin/teams/${ref.name}`
		case 'ProviderConfig': return '/admin/providers'
		case 'NetworkPool':
			if (ref.namespace) return `/admin/networks/${ref.namespace}/${ref.name}`
			return '/admin/networks'
		case 'ImageSync': return '/admin/images'
		case 'User': return '/admin/users'
		default: return null
	}
}

function severityDotColor(severity: string): string {
	switch (severity) {
		case 'success': return 'bg-green-500'
		case 'warning': return 'bg-amber-500'
		case 'error': return 'bg-red-500'
		case 'info': return 'bg-blue-500'
		default: return 'bg-neutral-500'
	}
}

function formatRelativeTime(timestamp: string): string {
	const now = Date.now()
	const then = new Date(timestamp).getTime()
	const diffSeconds = Math.floor((now - then) / 1000)

	if (diffSeconds < 60) return 'just now'
	if (diffSeconds < 3600) {
		const mins = Math.floor(diffSeconds / 60)
		return `${mins}m ago`
	}
	if (diffSeconds < 86400) {
		const hours = Math.floor(diffSeconds / 3600)
		return `${hours}h ago`
	}
	const days = Math.floor(diffSeconds / 86400)
	return `${days}d ago`
}

export function NotificationBell() {
	const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useWebSocket()
	const toast = useToast()
	const navigate = useNavigate()
	const [isOpen, setIsOpen] = useState(false)
	const bellRef = useRef<HTMLDivElement>(null)
	const prevCountRef = useRef(0)

	// Close on outside click
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
				setIsOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	// Close on escape
	useEffect(() => {
		function handleEscape(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setIsOpen(false)
			}
		}
		document.addEventListener('keydown', handleEscape)
		return () => document.removeEventListener('keydown', handleEscape)
	}, [])

	// Toast on new notification when dropdown is closed
	useEffect(() => {
		if (unreadCount > prevCountRef.current && !isOpen && notifications.length > 0) {
			const latest = notifications[0]
			if (latest.severity === 'error') {
				toast.error(latest.title, latest.message)
			} else if (latest.severity === 'warning') {
				toast.warning(latest.title, latest.message)
			} else {
				toast.success(latest.title, latest.message)
			}
		}
		prevCountRef.current = unreadCount
	}, [unreadCount]) // eslint-disable-line react-hooks/exhaustive-deps

	function handleNotificationClick(notification: Notification) {
		markAsRead(notification.id)
		const path = getNavigationPath(notification)
		if (path) {
			navigate(path)
		}
		setIsOpen(false)
	}

	return (
		<div ref={bellRef} className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors relative"
				title="Notifications"
			>
				<svg
					className="w-5 h-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
					/>
				</svg>
				{unreadCount > 0 && (
					<span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
						{unreadCount > 99 ? '99+' : unreadCount}
					</span>
				)}
			</button>

			{isOpen && (
				<div className="absolute right-0 mt-2 w-96 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
					{/* Header */}
					<div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
						<h3 className="text-sm font-semibold text-neutral-100">Notifications</h3>
						<div className="flex items-center gap-2">
							{unreadCount > 0 && (
								<button
									onClick={markAllAsRead}
									className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
								>
									Mark all read
								</button>
							)}
							{notifications.length > 0 && (
								<>
									{unreadCount > 0 && (
										<span className="text-neutral-600">|</span>
									)}
									<button
										onClick={clearNotifications}
										className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
									>
										Clear
									</button>
								</>
							)}
						</div>
					</div>

					{/* Notification list */}
					{notifications.length > 0 ? (
						<div className="max-h-96 overflow-y-auto divide-y divide-neutral-800">
							{notifications.map((notification) => (
								<button
									key={notification.id}
									onClick={() => handleNotificationClick(notification)}
									className={`w-full text-left px-4 py-3 hover:bg-neutral-800 transition-colors ${
										!notification.read ? 'bg-neutral-800/50' : ''
									}`}
								>
									<div className="flex items-start gap-3">
										<span
											className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${severityDotColor(notification.severity)}`}
										/>
										<div className="flex-1 min-w-0">
											<p className="font-medium text-sm text-neutral-100 truncate">
												{notification.title}
											</p>
											<p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">
												{notification.message}
											</p>
											<p className="text-xs text-neutral-500 mt-1">
												{formatRelativeTime(notification.timestamp)}
											</p>
										</div>
									</div>
								</button>
							))}
						</div>
					) : (
						<div className="px-4 py-12 text-center">
							<svg
								className="w-8 h-8 text-neutral-600 mx-auto mb-3"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
									d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
								/>
							</svg>
							<p className="text-sm text-neutral-500">No notifications</p>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
