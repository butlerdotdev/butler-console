// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useToast } from '@/hooks/useToast'
import { TeamSwitcher } from './TeamSwitcher'

export function Header() {
	const { user, logout, refreshPermissions } = useAuth()
	const { isConnected } = useWebSocket()
	const { isAdminMode } = useTeamContext()
	const toast = useToast()
	const [showUserMenu, setShowUserMenu] = useState(false)
	const [showHelpMenu, setShowHelpMenu] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)
	const helpMenuRef = useRef<HTMLDivElement>(null)

	// Close menus on outside click
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setShowUserMenu(false)
			}
			if (helpMenuRef.current && !helpMenuRef.current.contains(event.target as Node)) {
				setShowHelpMenu(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const handleLogout = async () => {
		setShowUserMenu(false)
		await logout()
	}

	const handleRefreshPermissions = async () => {
		setIsRefreshing(true)
		try {
			const result = await refreshPermissions()
			if (result.success) {
				toast.success('Permissions Refreshed', 'Your permissions have been updated.')
			} else {
				toast.error('Refresh Failed', result.message || 'Failed to refresh permissions.')
			}
		} catch {
			toast.error('Refresh Failed', 'An error occurred while refreshing permissions.')
		} finally {
			setIsRefreshing(false)
			setShowUserMenu(false)
		}
	}

	const initials = (user?.name || user?.email || 'U').charAt(0).toUpperCase()

	return (
		<header
			className={`
				h-14 px-6 flex items-center justify-between border-b flex-shrink-0
				${isAdminMode
					? 'bg-neutral-900 border-violet-500/20'
					: 'bg-neutral-900 border-neutral-800'
				}
			`}
		>
			{/* Left side - Connection status */}
			<div className="flex items-center gap-3">
				<span
					className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-neutral-500'
						}`}
				/>
				<span className="text-sm text-neutral-400">
					{isConnected ? 'Connected' : 'Disconnected'}
				</span>
			</div>

			{/* Right side - Help, Team switcher and user menu */}
			<div className="flex items-center gap-3">
				{/* Help Menu - Icon only */}
				<div ref={helpMenuRef} className="relative">
					<button
						onClick={() => setShowHelpMenu(!showHelpMenu)}
						className="p-2 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
						title="Help & Resources"
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
								d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</button>

					{showHelpMenu && (
						<div className="absolute right-0 mt-2 w-52 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
							<div className="p-2 space-y-1">
								<a
									href="https://docs.butlerlabs.dev/"
									target="_blank"
									rel="noopener noreferrer"
									onClick={() => setShowHelpMenu(false)}
									className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
								>
									<svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
										/>
									</svg>
									Documentation
								</a>
								<a
									href="https://github.com/butlerdotdev/"
									target="_blank"
									rel="noopener noreferrer"
									onClick={() => setShowHelpMenu(false)}
									className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
								>
									<svg className="w-4 h-4 text-neutral-400" fill="currentColor" viewBox="0 0 24 24">
										<path
											fillRule="evenodd"
											d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
											clipRule="evenodd"
										/>
									</svg>
									GitHub
								</a>
								<a
									href="https://discord.gg/cAzWG9qz3K"
									target="_blank"
									rel="noopener noreferrer"
									onClick={() => setShowHelpMenu(false)}
									className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
								>
									<svg className="w-4 h-4 text-neutral-400" fill="currentColor" viewBox="0 0 24 24">
										<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
									</svg>
									Discord Community
								</a>
								<div className="border-t border-neutral-700 my-1" />
								<a
									href="https://github.com/butlerdotdev/butler/releases"
									target="_blank"
									rel="noopener noreferrer"
									onClick={() => setShowHelpMenu(false)}
									className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
								>
									<svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
										/>
									</svg>
									What's New
								</a>
								<button
									onClick={() => {
										setShowHelpMenu(false)
										// TODO: Open keyboard shortcuts modal
										alert('Keyboard shortcuts coming soon!\n\nPlanned shortcuts:\n? - Open help\n/ - Focus search\nk - Open command palette')
									}}
									className="w-full flex items-center gap-3 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
								>
									<svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
										/>
									</svg>
									Keyboard Shortcuts
									<span className="ml-auto text-xs text-neutral-500">?</span>
								</button>
							</div>
						</div>
					)}
				</div>

				{/* Team Switcher */}
				<TeamSwitcher />

				{/* User Menu */}
				<div ref={menuRef} className="relative">
					<button
						onClick={() => setShowUserMenu(!showUserMenu)}
						className="flex items-center gap-2 p-1 rounded-lg hover:bg-neutral-800 transition-colors"
					>
						{user?.picture ? (
							<img
								src={user.picture}
								alt=""
								className="w-8 h-8 rounded-full"
							/>
						) : (
							<div
								className={`
									w-8 h-8 rounded-full flex items-center justify-center
									${isAdminMode ? 'bg-violet-600' : 'bg-green-600'}
								`}
							>
								<span className="text-white text-sm font-medium">{initials}</span>
							</div>
						)}
						<svg
							className={`w-4 h-4 text-neutral-400 transition-transform ${showUserMenu ? 'rotate-180' : ''
								}`}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</button>

					{/* User Dropdown */}
					{showUserMenu && (
						<div className="absolute right-0 mt-2 w-64 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50 overflow-hidden">
							{/* User Info */}
							<div className="px-4 py-3 border-b border-neutral-700">
								<div className="flex items-center gap-3">
									{user?.picture ? (
										<img
											src={user.picture}
											alt=""
											className="w-10 h-10 rounded-full"
										/>
									) : (
										<div
											className={`
												w-10 h-10 rounded-full flex items-center justify-center
												${isAdminMode ? 'bg-violet-600' : 'bg-green-600'}
											`}
										>
											<span className="text-white font-medium">{initials}</span>
										</div>
									)}
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-neutral-100 truncate">
											{user?.name || 'User'}
										</p>
										<p className="text-xs text-neutral-400 truncate">
											{user?.email}
										</p>
									</div>
								</div>
							</div>

							{/* Teams Summary */}
							{user?.teams && user.teams.length > 0 && (
								<div className="px-4 py-2 border-b border-neutral-700">
									<p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
										Your Teams ({user.teams.length})
									</p>
									<div className="space-y-1 max-h-32 overflow-y-auto">
										{user.teams.slice(0, 5).map((team) => (
											<div
												key={team.name}
												className="flex items-center justify-between text-sm"
											>
												<span className="text-neutral-300 truncate">
													{team.displayName || team.name}
												</span>
												<span
													className={`text-xs px-1.5 py-0.5 rounded ${team.role === 'admin'
														? 'bg-violet-500/20 text-violet-400'
														: 'bg-neutral-700 text-neutral-400'
														}`}
												>
													{team.role}
												</span>
											</div>
										))}
										{user.teams.length > 5 && (
											<p className="text-xs text-neutral-500">
												+{user.teams.length - 5} more
											</p>
										)}
									</div>
								</div>
							)}

							{/* Actions */}
							<div className="p-2 space-y-1">
								<a
									href="/settings/profile"
									onClick={() => setShowUserMenu(false)}
									className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
								>
									<svg
										className="w-4 h-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
										/>
									</svg>
									Profile
								</a>
								<a
									href="/settings/preferences"
									onClick={() => setShowUserMenu(false)}
									className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
								>
									<svg
										className="w-4 h-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
										/>
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
									Preferences
								</a>
								<button
									onClick={handleRefreshPermissions}
									disabled={isRefreshing}
									className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
								>
									{isRefreshing ? (
										<svg
											className="w-4 h-4 animate-spin"
											fill="none"
											viewBox="0 0 24 24"
										>
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
											<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
										</svg>
									) : (
										<svg
											className="w-4 h-4"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
											/>
										</svg>
									)}
									{isRefreshing ? 'Refreshing...' : 'Refresh Permissions'}
								</button>
								<div className="border-t border-neutral-700 my-1" />
								<button
									onClick={handleLogout}
									className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
								>
									<svg
										className="w-4 h-4"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
										/>
									</svg>
									Sign out
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</header>
	)
}
