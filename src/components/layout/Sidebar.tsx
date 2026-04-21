// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useCallback } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

function useCollapsedSections() {
	const [collapsed, setCollapsed] = useState<Set<string>>(() => {
		try {
			const stored = localStorage.getItem('butler-sidebar-collapsed')
			return stored ? new Set(JSON.parse(stored)) : new Set()
		} catch {
			return new Set()
		}
	})

	const toggle = useCallback((label: string) => {
		setCollapsed(prev => {
			const next = new Set(prev)
			if (next.has(label)) next.delete(label)
			else next.add(label)
			localStorage.setItem('butler-sidebar-collapsed', JSON.stringify([...next]))
			return next
		})
	}, [])

	return { collapsed, toggle }
}

interface NavItem {
	to: string
	label: string
	icon: React.ComponentType<{ className?: string }>
	end?: boolean
}

interface NavSection {
	label?: string
	items: NavItem[]
}

export function Sidebar() {
	const { mode, currentTeam, currentTeamDisplayName, buildPath, isAdminMode, canAccessAdmin, isTeamAdmin } = useTeamContext()
	const { user } = useAuth()
	const location = useLocation()
	const navigate = useNavigate()
	const { collapsed, toggle: toggleSection } = useCollapsedSections()
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
	let navSections: NavSection[] = []
	let showTeamLabel = false
	let teamLabel = ''
	let effectiveAdminMode = isAdminMode

	const adminSections: NavSection[] = [
		{
			items: [
				{ to: '/admin', label: 'Overview', icon: DashboardIcon, end: true },
				{ to: '/admin/clusters', label: 'All Clusters', icon: ClustersIcon },
			],
		},
		{
			label: 'Organization',
			items: [
				{ to: '/admin/teams', label: 'Teams', icon: TeamsIcon },
				{ to: '/admin/users', label: 'Users', icon: UsersIcon },
			],
		},
		{
			label: 'Infrastructure',
			items: [
				{ to: '/admin/providers', label: 'Providers', icon: ProvidersIcon },
				{ to: '/admin/images', label: 'Images', icon: ImagesIcon },
				{ to: '/admin/networks', label: 'Network Pools', icon: NetworkPoolsIcon },
			],
		},
		{
			label: 'Platform',
			items: [
				{ to: '/admin/addons', label: 'Addon Catalog', icon: AddonsIcon },
				{ to: '/admin/identity-providers', label: 'Identity Providers', icon: IdentityProvidersIcon },
				{ to: '/admin/observability', label: 'Observability', icon: ObservabilityIcon },
			],
		},
		{
			label: 'Security',
			items: [
				{ to: '/admin/rbac', label: 'Access Control', icon: AccessControlIcon },
				{ to: '/admin/audit', label: 'Audit Log', icon: AuditLogIcon },
			],
		},
	]

	if (mode === 'admin') {
		navSections = adminSections
	} else if (mode === 'team' && currentTeam) {
		const teamItems: NavItem[] = [
			{ to: buildPath(''), label: 'Dashboard', icon: DashboardIcon, end: true },
			{ to: buildPath('/clusters'), label: 'Clusters', icon: ClustersIcon },
			{ to: buildPath('/providers'), label: 'Providers', icon: ProvidersIcon },
			{ to: buildPath('/members'), label: 'Members', icon: UsersIcon },
		]
		// Environments is a team-admin surface. Hidden from operators
		// and viewers; page itself also renders an access-denied card
		// if someone navigates directly.
		if (isTeamAdmin || canAccessAdmin) {
			teamItems.push({ to: buildPath('/environments'), label: 'Environments', icon: EnvironmentsIcon })
		}
		navSections = [{ items: teamItems }]
		showTeamLabel = true
		teamLabel = currentTeamDisplayName || currentTeam
	} else if (isLegacyRoute) {
		effectiveAdminMode = true
		navSections = adminSections
	} else {
		// Fallback - show minimal nav to get to a team or admin
		const firstTeam = user?.teams?.[0]
		const teamName = firstTeam?.name || firstTeam?.metadata?.name
		if (teamName) {
			navSections = [{
				items: [
					{ to: `/t/${teamName}`, label: 'Dashboard', icon: DashboardIcon, end: true },
					{ to: `/t/${teamName}/clusters`, label: 'Clusters', icon: ClustersIcon },
				],
			}]
			showTeamLabel = true
			teamLabel = firstTeam?.displayName || firstTeam?.spec?.displayName || teamName
		} else if (canAccessAdmin) {
			effectiveAdminMode = true
			navSections = [{
				items: [
					{ to: '/admin', label: 'Overview', icon: DashboardIcon, end: true },
					{ to: '/admin/clusters', label: 'All Clusters', icon: ClustersIcon },
				],
			}]
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
			<nav className="flex-1 px-3 py-2 overflow-y-auto">
				{navSections.map((section, sectionIdx) => {
					// Auto-expand sections containing the active route
					const containsActiveRoute = section.items.some(item =>
						item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
					)
					const isCollapsed = section.label ? (collapsed.has(section.label) && !containsActiveRoute) : false
					return (
					<div key={section.label || sectionIdx} className={sectionIdx > 0 ? 'mt-5' : ''}>
						{section.label && (
							<button
								onClick={() => toggleSection(section.label!)}
								className="w-full flex items-center justify-between px-3 py-1 mb-0.5 rounded hover:bg-neutral-800/30 group"
							>
								<span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider group-hover:text-neutral-400">
									{section.label}
								</span>
								<svg
									className={cn(
										'w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-transform duration-200',
										isCollapsed && '-rotate-90'
									)}
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
								</svg>
							</button>
						)}
						{!isCollapsed && (
						<div className="space-y-0.5">
							{section.items.map((item) => (
								<NavLink
									key={item.to}
									to={item.to}
									end={item.end}
									className={({ isActive }) =>
										cn(
											'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
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
						</div>
						)}
					</div>
					)
				})}
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

function NetworkPoolsIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
			/>
		</svg>
	)
}

function IdentityProvidersIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
			/>
		</svg>
	)
}

function ImagesIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
			/>
		</svg>
	)
}

function ObservabilityIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
			/>
		</svg>
	)
}

function AuditLogIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
			/>
		</svg>
	)
}

function AddonsIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
		</svg>
	)
}

function AccessControlIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
		</svg>
	)
}

function EnvironmentsIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4m0 0l-3-3m3 3l-3 3M5 21V5a2 2 0 012-2h10a2 2 0 012 2v10" />
		</svg>
	)
}
