// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function UserMenu() {
	const { user, logout } = useAuth()
	const navigate = useNavigate()
	const [isOpen, setIsOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)

	// Close menu when clicking outside
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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

	const handleLogout = async () => {
		setIsOpen(false)
		await logout()
		navigate('/login')
	}

	const initials = user?.name
		? user.name
			.split(' ')
			.map((n) => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2)
		: user?.email?.[0]?.toUpperCase() || 'U'

	const isAdmin = user?.role === 'admin' || user?.isAdmin

	return (
		<div className="relative" ref={menuRef}>
			{/* Trigger Button */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
			>
				<div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-medium">
					{initials}
				</div>
				<ChevronDownIcon
					className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''
						}`}
				/>
			</button>

			{/* Dropdown Menu */}
			{isOpen && (
				<div className="absolute right-0 mt-2 w-72 bg-neutral-900 border border-neutral-700 rounded-xl shadow-xl overflow-hidden z-50">
					{/* User Info Header */}
					<div className="px-4 py-3 border-b border-neutral-800">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-medium">
								{initials}
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-sm font-medium text-neutral-100 truncate">
									{user?.name || 'User'}
								</p>
								<p className="text-xs text-neutral-400 truncate">
									{user?.email}
								</p>
							</div>
							{isAdmin && (
								<span className="px-2 py-0.5 text-xs font-medium bg-violet-500/20 text-violet-400 rounded-full">
									Admin
								</span>
							)}
						</div>
					</div>

					{/* Menu Items */}
					<div className="py-2">
						<MenuItem
							icon={<UserIcon className="w-4 h-4" />}
							label="Profile"
							description="View and edit your profile"
							onClick={() => {
								setIsOpen(false)
								navigate('/settings/profile')
							}}
						/>
						<MenuItem
							icon={<SettingsIcon className="w-4 h-4" />}
							label="Preferences"
							description="Customize your experience"
							onClick={() => {
								setIsOpen(false)
								navigate('/settings/preferences')
							}}
						/>
						{isAdmin && (
							<MenuItem
								icon={<ShieldIcon className="w-4 h-4" />}
								label="Admin Settings"
								description="Platform configuration"
								onClick={() => {
									setIsOpen(false)
									navigate('/admin/settings')
								}}
							/>
						)}
					</div>

					{/* Theme Toggle */}
					<div className="px-4 py-2 border-t border-neutral-800">
						<div className="flex items-center justify-between">
							<span className="text-sm text-neutral-400">Theme</span>
							<div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1">
								<button
									className="p-1.5 rounded-md bg-neutral-700 text-neutral-200"
									title="Dark mode (active)"
								>
									<MoonIcon className="w-4 h-4" />
								</button>
								<button
									className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-300"
									title="Light mode (coming soon)"
									disabled
								>
									<SunIcon className="w-4 h-4" />
								</button>
							</div>
						</div>
					</div>

					{/* Logout */}
					<div className="py-2 border-t border-neutral-800">
						<button
							onClick={handleLogout}
							className="w-full flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-red-500/10 transition-colors"
						>
							<LogOutIcon className="w-4 h-4" />
							<span className="text-sm font-medium">Sign out</span>
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

interface MenuItemProps {
	icon: React.ReactNode
	label: string
	description?: string
	onClick: () => void
}

function MenuItem({ icon, label, description, onClick }: MenuItemProps) {
	return (
		<button
			onClick={onClick}
			className="w-full flex items-center gap-3 px-4 py-2 hover:bg-neutral-800 transition-colors text-left"
		>
			<span className="text-neutral-400">{icon}</span>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-neutral-200">{label}</p>
				{description && (
					<p className="text-xs text-neutral-500 truncate">{description}</p>
				)}
			</div>
		</button>
	)
}

// Icons
function UserIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
			/>
		</svg>
	)
}

function SettingsIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
			/>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
	)
}

function ShieldIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
			/>
		</svg>
	)
}

function LogOutIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
			/>
		</svg>
	)
}

function MoonIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
			/>
		</svg>
	)
}

function SunIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
			/>
		</svg>
	)
}

function ChevronDownIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
		</svg>
	)
}
