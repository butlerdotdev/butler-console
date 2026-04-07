// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, useMemo } from 'react'
import { useDocumentTitle } from '@/hooks'
import { apiClient } from '@/api/client'
import { Card, Spinner, FadeIn } from '@/components/ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamInfo {
	name: string
}

interface MemberInfo {
	email: string
	name: string
	role: string
	source: string
	groupName?: string
}

interface GroupInfo {
	name: string
	role: string
	identityProvider: string
}

interface UserAccess {
	email: string
	name: string
	isPlatformAdmin: boolean
	teams: { name: string; role: string; source: string }[]
}

interface GroupAccess {
	name: string
	identityProvider: string
	teams: { name: string; role: string }[]
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export function RBACPage() {
	useDocumentTitle('Access Control')

	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [users, setUsers] = useState<UserAccess[]>([])
	const [groups, setGroups] = useState<GroupAccess[]>([])
	const [totalTeams, setTotalTeams] = useState(0)
	const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users')
	const [searchQuery, setSearchQuery] = useState('')

	useEffect(() => {
		loadAccessData()
	}, [])

	async function loadAccessData() {
		try {
			setLoading(true)
			setError(null)

			// Step 1: Fetch all teams and all users in parallel
			const [teamsResponse, usersResponse] = await Promise.all([
				apiClient.get<{ teams: Record<string, unknown>[] }>('/teams'),
				apiClient.get<{ users: { email: string; displayName: string; isPlatformAdmin?: boolean }[] }>('/users'),
			])

			const teams: TeamInfo[] = (teamsResponse.teams || []).map((t: Record<string, unknown>) => ({
				name: (t.name as string) || (t.metadata as Record<string, unknown>)?.name as string || '',
			}))
			setTotalTeams(teams.length)

			// Step 2: Fetch members for each team
			const memberResults = await Promise.all(
				teams.map(async (team) => {
					try {
						const [membersRes, groupsRes] = await Promise.all([
							apiClient.get<{ members: MemberInfo[]; groups: GroupInfo[] }>(`/teams/${team.name}/members`),
							apiClient.get<{ groups: GroupInfo[] }>(`/teams/${team.name}/groups`).catch(() => ({ groups: [] })),
						])
						// Merge: use groups from /groups endpoint (has identityProvider), fall back to /members groups
						const groups = groupsRes.groups.length > 0 ? groupsRes.groups : membersRes.groups || []
						return { team: team.name, members: membersRes.members || [], groups }
					} catch {
						return { team: team.name, members: [], groups: [] }
					}
				})
			)

			// Step 3: Build user access map
			const userMap = new Map<string, UserAccess>()

			// Seed from the users list
			for (const u of usersResponse.users || []) {
				userMap.set(u.email, {
					email: u.email,
					name: u.displayName || '',
					isPlatformAdmin: u.isPlatformAdmin === true,
					teams: [],
				})
			}

			// Add team memberships
			for (const result of memberResults) {
				for (const member of result.members) {
					let entry = userMap.get(member.email)
					if (!entry) {
						entry = {
							email: member.email,
							name: member.name || '',
							isPlatformAdmin: false,
							teams: [],
						}
						userMap.set(member.email, entry)
					}
					// Update name if not yet set
					if (!entry.name && member.name) {
						entry.name = member.name
					}
					entry.teams.push({
						name: result.team,
						role: member.role,
						source: member.source || 'direct',
					})
				}
			}

			// Step 4: Build group access map
			const groupMap = new Map<string, GroupAccess>()

			for (const result of memberResults) {
				for (const group of result.groups) {
					const key = `${group.name}::${group.identityProvider}`
					let entry = groupMap.get(key)
					if (!entry) {
						entry = {
							name: group.name,
							identityProvider: group.identityProvider,
							teams: [],
						}
						groupMap.set(key, entry)
					}
					entry.teams.push({
						name: result.team,
						role: group.role,
					})
				}
			}

			// Sort users: platform admins first, then alphabetically by email
			const sortedUsers = Array.from(userMap.values()).sort((a, b) => {
				if (a.isPlatformAdmin !== b.isPlatformAdmin) return a.isPlatformAdmin ? -1 : 1
				return a.email.localeCompare(b.email)
			})

			const sortedGroups = Array.from(groupMap.values()).sort((a, b) =>
				a.name.localeCompare(b.name)
			)

			setUsers(sortedUsers)
			setGroups(sortedGroups)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load access data')
		} finally {
			setLoading(false)
		}
	}

	// Computed stats
	const platformAdminCount = useMemo(
		() => users.filter((u) => u.isPlatformAdmin).length,
		[users]
	)

	const totalGroupSyncs = useMemo(
		() => groups.reduce((sum, g) => sum + g.teams.length, 0),
		[groups]
	)

	// Filtered data
	const filteredUsers = useMemo(() => {
		if (!searchQuery) return users
		const q = searchQuery.toLowerCase()
		return users.filter(
			(u) =>
				u.email.toLowerCase().includes(q) ||
				u.name.toLowerCase().includes(q)
		)
	}, [users, searchQuery])

	const filteredGroups = useMemo(() => {
		if (!searchQuery) return groups
		const q = searchQuery.toLowerCase()
		return groups.filter(
			(g) =>
				g.name.toLowerCase().includes(q) ||
				g.identityProvider.toLowerCase().includes(q)
		)
	}, [groups, searchQuery])

	const inputClass =
		'w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm'

	return (
		<FadeIn>
			<div className="space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">Access Control</h1>
					<p className="text-neutral-400 mt-1">
						Platform-wide user and group access overview
					</p>
				</div>

				{/* Loading */}
				{loading && (
					<div className="flex items-center justify-center h-64">
						<Spinner size="lg" />
					</div>
				)}

				{/* Error */}
				{!loading && error && (
					<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-red-400">{error}</p>
						<button
							onClick={loadAccessData}
							className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
						>
							Retry
						</button>
					</div>
				)}

				{/* Content */}
				{!loading && !error && (
					<>
						{/* Stats Bar */}
						<Card className="p-4">
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								<StatItem label="Total Users" value={users.length} />
								<StatItem label="Platform Admins" value={platformAdminCount} />
								<StatItem label="Total Teams" value={totalTeams} />
								<StatItem label="Group Syncs" value={totalGroupSyncs} />
							</div>
						</Card>

						{/* Tabs + Search */}
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
							<div className="flex gap-1 bg-neutral-800/50 rounded-lg p-1">
								<button
									onClick={() => { setActiveTab('users'); setSearchQuery('') }}
									className={tabClass(activeTab === 'users')}
								>
									Users
								</button>
								<button
									onClick={() => { setActiveTab('groups'); setSearchQuery('') }}
									className={tabClass(activeTab === 'groups')}
								>
									Groups
								</button>
							</div>
							<div className="w-full sm:w-72">
								<input
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder={activeTab === 'users' ? 'Search by email or name...' : 'Search by group or IdP...'}
									className={inputClass}
								/>
							</div>
						</div>

						{/* Empty State */}
						{users.length === 0 && groups.length === 0 && (
							<Card className="p-8 text-center">
								<div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
									<ShieldIcon className="w-6 h-6 text-neutral-500" />
								</div>
								<h3 className="text-lg font-medium text-neutral-200 mb-2">No Access Data</h3>
								<p className="text-neutral-400">
									No teams configured. Create teams and add members to see the access matrix.
								</p>
							</Card>
						)}

						{/* Users Tab */}
						{activeTab === 'users' && users.length > 0 && (
							<Card className="overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr className="border-b border-neutral-800">
												<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
													User
												</th>
												<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
													Platform Admin
												</th>
												<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
													Teams &amp; Roles
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-neutral-800">
											{filteredUsers.length === 0 && (
												<tr>
													<td colSpan={3} className="px-4 py-8 text-center text-neutral-500 text-sm">
														No users match the search query.
													</td>
												</tr>
											)}
											{filteredUsers.map((user) => (
												<tr key={user.email} className="hover:bg-neutral-800/30 transition-colors">
													<td className="px-4 py-3">
														<div>
															<p className="text-sm font-medium text-neutral-200 truncate max-w-[250px]" title={user.email}>
																{user.email}
															</p>
															{user.name && (
																<p className="text-xs text-neutral-500 truncate max-w-[250px]">
																	{user.name}
																</p>
															)}
														</div>
													</td>
													<td className="px-4 py-3">
														{user.isPlatformAdmin ? (
															<CheckIcon className="w-5 h-5 text-green-400" />
														) : (
															<span className="text-neutral-600">&mdash;</span>
														)}
													</td>
													<td className="px-4 py-3">
														<div className="flex flex-wrap gap-1.5">
															{user.teams.length === 0 && (
																<span className="text-xs text-neutral-600">No team memberships</span>
															)}
															{user.teams.map((t, i) => (
																<RoleBadge
																	key={`${t.name}-${i}`}
																	team={t.name}
																	role={t.role}
																	source={t.source}
																/>
															))}
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								{/* Summary footer */}
								<div className="px-4 py-3 border-t border-neutral-800">
									<span className="text-sm text-neutral-400">
										{filteredUsers.length} of {users.length} users
									</span>
								</div>
							</Card>
						)}

						{/* Groups Tab */}
						{activeTab === 'groups' && (
							<Card className="overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full">
										<thead>
											<tr className="border-b border-neutral-800">
												<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
													Group
												</th>
												<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
													Identity Provider
												</th>
												<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
													Teams &amp; Roles
												</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-neutral-800">
											{filteredGroups.length === 0 && (
												<tr>
													<td colSpan={3} className="px-4 py-8 text-center text-neutral-500 text-sm">
														{groups.length === 0
															? 'No group syncs configured across any team.'
															: 'No groups match the search query.'}
													</td>
												</tr>
											)}
											{filteredGroups.map((group, idx) => (
												<tr key={`${group.name}-${group.identityProvider}-${idx}`} className="hover:bg-neutral-800/30 transition-colors">
													<td className="px-4 py-3">
														<div className="flex items-center gap-2">
															<GroupIcon className="w-4 h-4 text-neutral-500 flex-shrink-0" />
															<span className="text-sm font-medium text-neutral-200 truncate max-w-[200px]" title={group.name}>
																{group.name}
															</span>
														</div>
													</td>
													<td className="px-4 py-3">
														<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400">
															{group.identityProvider}
														</span>
													</td>
													<td className="px-4 py-3">
														<div className="flex flex-wrap gap-1.5">
															{group.teams.map((t, i) => (
																<RoleBadge
																	key={`${t.name}-${i}`}
																	team={t.name}
																	role={t.role}
																	source="group"
																/>
															))}
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								{/* Summary footer */}
								<div className="px-4 py-3 border-t border-neutral-800">
									<span className="text-sm text-neutral-400">
										{filteredGroups.length} of {groups.length} groups
									</span>
								</div>
							</Card>
						)}
					</>
				)}
			</div>
		</FadeIn>
	)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatItem({ label, value }: { label: string; value: number }) {
	return (
		<div className="text-center">
			<p className="text-2xl font-bold text-neutral-100">{value}</p>
			<p className="text-xs text-neutral-500 mt-0.5">{label}</p>
		</div>
	)
}

interface RoleBadgeProps {
	team: string
	role: string
	source: string
}

function RoleBadge({ team, role, source }: RoleBadgeProps) {
	const roleColors: Record<string, { bg: string; text: string }> = {
		admin: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
		operator: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
		viewer: { bg: 'bg-neutral-500/10', text: 'text-neutral-400' },
	}

	const colors = roleColors[role] || roleColors.viewer

	return (
		<span
			className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
			title={`${team}: ${role} (${source})`}
		>
			{source === 'group' && <GroupIcon className="w-3 h-3" />}
			{team}: {role}
		</span>
	)
}

function tabClass(active: boolean): string {
	return active
		? 'px-4 py-2 text-sm font-medium rounded-md bg-neutral-700 text-neutral-100 transition-colors'
		: 'px-4 py-2 text-sm font-medium rounded-md text-neutral-400 hover:text-neutral-200 transition-colors'
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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

function CheckIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
		</svg>
	)
}

function GroupIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
			/>
		</svg>
	)
}
