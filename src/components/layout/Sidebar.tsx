// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface NavItem {
	to: string
	label: string
	icon: React.ComponentType<{ className?: string }>
	end?: boolean
}

export function Sidebar() {
	const { mode, currentTeam, currentTeamDisplayName, buildPath, isAdminMode, canAccessAdmin, isTeamAdmin } = useTeamContext()
	const { user } = useAuth()
	const location = useLocation()
	const navigate = useNavigate()
	const isSettingsRoute = location.pathname.startsWith('/settings')

	// Settings sidebar
	if (isSettingsRoute) {
		return (
			<aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col flex-shrink-0">
				{/* Logo */}
				<div className="h-14 px-4 flex items-center border-b border-neutral-800">
					<NavLink to="/" className="flex items-center gap-3">
						<img
							src="/butlerlabs.png"
							alt="Butler"
							className="w-8 h-8 rounded-lg"
						/>
						<span className="text-lg font-semibold text-neutral-100">Butler</span>
					</NavLink>
				</div>

				{/* Settings Context Label */}
				<div className="px-4 py-3 border-b border-neutral-800">
					<p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
						Account
					</p>
					<p className="text-sm font-medium text-neutral-200 truncate">
						Settings
					</p>
				</div>

				{/* Settings Navigation */}
				<nav className="flex-1 p-3 space-y-1 overflow-y-auto">
					<NavLink
						to="/settings/profile"
						className={({ isActive }) =>
							cn(
								'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
								isActive
									? 'bg-green-600/20 text-green-400 border-l-2 border-green-500'
									: 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
							)
						}
					>
						<UserIcon className="w-5 h-5 flex-shrink-0" />
						Profile
					</NavLink>
					<NavLink
						to="/settings/preferences"
						className={({ isActive }) =>
							cn(
								'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
								isActive
									? 'bg-green-600/20 text-green-400 border-l-2 border-green-500'
									: 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
							)
						}
					>
						<SettingsIcon className="w-5 h-5 flex-shrink-0" />
						Preferences
					</NavLink>
				</nav>

				{/* Back button */}
				<div className="p-3 border-t border-neutral-800">
					<button
						onClick={() => navigate(-1)}
						className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors w-full"
					>
						<ArrowLeftIcon className="w-5 h-5" />
						Back
					</button>
				</div>
			</aside>
		)
	}

	// Check if we're on a legacy route (not /t/* or /admin/*)
	const isLegacyRoute = !location.pathname.startsWith('/t/') &&
		!location.pathname.startsWith('/admin') &&
		location.pathname !== '/overview'

	// For legacy routes, show admin nav if user is admin, otherwise show team nav for first team
	let navItems: NavItem[] = []
	let showTeamLabel = false
	let teamLabel = ''
	let effectiveAdminMode = isAdminMode

	if (mode === 'admin') {
		navItems = [
			{ to: '/admin', label: 'Overview', icon: DashboardIcon, end: true },
			{ to: '/admin/clusters', label: 'All Clusters', icon: ClustersIcon },
			{ to: '/admin/teams', label: 'Teams', icon: TeamsIcon },
			{ to: '/admin/users', label: 'Users', icon: UsersIcon },
			{ to: '/admin/providers', label: 'Providers', icon: ProvidersIcon },
		]
	} else if (mode === 'team' && currentTeam) {
		navItems = [
			{ to: buildPath(''), label: 'Dashboard', icon: DashboardIcon, end: true },
			{ to: buildPath('/clusters'), label: 'Clusters', icon: ClustersIcon },
			{ to: buildPath('/members'), label: 'Members', icon: UsersIcon },
		]
		showTeamLabel = true
		teamLabel = currentTeamDisplayName || currentTeam
	} else if (isLegacyRoute) {
		// On legacy routes - show admin nav (legacy routes are for admins)
		// Anyone viewing legacy routes should see admin nav to get back
		effectiveAdminMode = true
		navItems = [
			{ to: '/admin', label: 'Overview', icon: DashboardIcon, end: true },
			{ to: '/admin/clusters', label: 'All Clusters', icon: ClustersIcon },
			{ to: '/admin/teams', label: 'Teams', icon: TeamsIcon },
			{ to: '/admin/users', label: 'Users', icon: UsersIcon },
			{ to: '/admin/providers', label: 'Providers', icon: ProvidersIcon },
		]
	} else {
		// Fallback - show minimal nav to get to a team or admin
		const firstTeam = user?.teams?.[0]
		const teamName = firstTeam?.name || firstTeam?.metadata?.name
		if (teamName) {
			navItems = [
				{ to: `/t/${teamName}`, label: 'Dashboard', icon: DashboardIcon, end: true },
				{ to: `/t/${teamName}/clusters`, label: 'Clusters', icon: ClustersIcon },
			]
			showTeamLabel = true
			teamLabel = firstTeam?.displayName || firstTeam?.spec?.displayName || teamName
		} else if (canAccessAdmin) {
			effectiveAdminMode = true
			navItems = [
				{ to: '/admin', label: 'Overview', icon: DashboardIcon, end: true },
				{ to: '/admin/clusters', label: 'All Clusters', icon: ClustersIcon },
			]
		}
	}

	// Accent color:
	// - Purple for platform admin mode
	// - Teal for team admin
	// - Green for regular team member
	const accentClass = effectiveAdminMode
		? 'bg-violet-600/20 text-violet-400 border-l-2 border-violet-500'
		: isTeamAdmin
			? 'bg-teal-600/20 text-teal-400 border-l-2 border-teal-500'
			: 'bg-green-600/20 text-green-400 border-l-2 border-green-500'

	return (
		<aside className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col flex-shrink-0">
			{/* Logo */}
			<div className="h-14 px-4 flex items-center border-b border-neutral-800">
				<NavLink to={effectiveAdminMode ? '/admin' : '/overview'} className="flex items-center gap-3">
					<img
						src="/butlerlabs.png"
						alt="Butler"
						className="w-8 h-8 rounded-lg"
					/>
					<span className="text-lg font-semibold text-neutral-100">Butler</span>
				</NavLink>
			</div>

			{/* Current Context Label */}
			{showTeamLabel && (
				<div className="px-4 py-3 border-b border-neutral-800">
					<p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
						Team
					</p>
					<p className="text-sm font-medium text-neutral-200 truncate">
						{teamLabel}
					</p>
				</div>
			)}

			{/* Primary Navigation */}
			<nav className="flex-1 p-3 space-y-1 overflow-y-auto">
				{navItems.map((item) => (
					<NavLink
						key={item.to}
						to={item.to}
						end={item.end}
						className={({ isActive }) =>
							cn(
								'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
								isActive
									? accentClass
									: 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
							)
						}
					>
						<item.icon className="w-5 h-5 flex-shrink-0" />
						{item.label}
					</NavLink>
				))}
			</nav>

			{/* Settings at bottom */}
			<div className="p-3 border-t border-neutral-800">
				<NavLink
					to={effectiveAdminMode ? '/admin/settings' : buildPath('/settings')}
					className={({ isActive }) =>
						cn(
							'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
							isActive
								? accentClass
								: 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
						)
					}
				>
					<SettingsIcon className="w-5 h-5 flex-shrink-0" />
					Settings
				</NavLink>
			</div>
		</aside>
	)
}

// Icons
function DashboardIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
			/>
		</svg>
	)
}

function ClustersIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
			/>
		</svg>
	)
}

function TeamsIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
			/>
		</svg>
	)
}

function UsersIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
			/>
		</svg>
	)
}

function ProvidersIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
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

function ArrowLeftIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M10 19l-7-7m0 0l7-7m-7 7h18"
			/>
		</svg>
	)
}
