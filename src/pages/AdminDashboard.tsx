// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { clustersApi, type Cluster } from '@/api'
import { Card, StatusBadge, FadeIn, Spinner } from '@/components/ui'

interface ManagementClusterInfo {
	kubernetesVersion: string
	phase: string
	nodes: { ready: number; total: number }
	tenantClusters: number
}

// Flexible team interface to handle various API response shapes
interface Team {
	metadata?: {
		name?: string
		namespace?: string
		creationTimestamp?: string
	}
	spec?: {
		displayName?: string
		description?: string
	}
	status?: {
		phase?: string
	}
	name?: string
	displayName?: string
	phase?: string
}

interface PlatformStats {
	totalTeams: number
	totalClusters: number
	totalUsers: number
	readyClusters: number
	provisioningClusters: number
	failedClusters: number
}

// Helper to safely get team name
function getTeamName(team: Team): string {
	return team.metadata?.name || team.name || 'unknown'
}

function getTeamDisplayName(team: Team): string {
	return team.spec?.displayName || team.displayName || team.metadata?.name || team.name || 'Unknown'
}

function getTeamPhase(team: Team): string {
	return team.status?.phase || team.phase || 'Ready'
}

export function AdminDashboard() {
	useDocumentTitle('Admin Overview')
	const [management, setManagement] = useState<ManagementClusterInfo | null>(null)
	const [clusters, setClusters] = useState<Cluster[]>([])
	const [teams, setTeams] = useState<Team[]>([])
	const [userCount, setUserCount] = useState(0)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		async function fetchData() {
			try {
				// Fetch all data in parallel
				const [mgmt, clustersResponse, teamsResponse, usersResponse] = await Promise.all([
					clustersApi.getManagement().catch(() => null),
					clustersApi.list().catch(() => ({ clusters: [] })),
					fetch('/api/teams', { credentials: 'include' })
						.then(r => r.ok ? r.json() : { teams: [] })
						.catch(() => ({ teams: [] })),
					fetch('/api/users', { credentials: 'include' })
						.then(r => r.ok ? r.json() : { users: [] })
						.catch(() => ({ users: [] })),
				])

				setManagement(mgmt)
				setClusters(clustersResponse.clusters || [])
				// Filter out any undefined/null teams
				const validTeams = (teamsResponse.teams || []).filter((t: Team) => t && (t.metadata?.name || t.name))
				setTeams(validTeams)
				setUserCount((usersResponse.users || []).length)
			} catch (error) {
				console.error('Failed to fetch admin data:', error)
			} finally {
				setLoading(false)
			}
		}

		fetchData()
	}, [])

	// Calculate stats
	const stats = useMemo<PlatformStats>(() => {
		const totalClusters = clusters.length + (management ? 1 : 0)
		const readyClusters = clusters.filter((c) => c.status?.phase === 'Ready').length + (management?.phase === 'Ready' ? 1 : 0)
		const provisioningClusters = clusters.filter((c) =>
			['Provisioning', 'Pending', 'Scaling'].includes(c.status?.phase || '')
		).length
		const failedClusters = clusters.filter((c) => c.status?.phase === 'Failed').length

		return {
			totalTeams: teams.length,
			totalClusters,
			totalUsers: userCount,
			readyClusters,
			provisioningClusters,
			failedClusters,
		}
	}, [clusters, teams, userCount, management])

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	return (
		<FadeIn>
			<div className="space-y-6">
				{/* Header */}
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">
						Platform Overview
					</h1>
					<p className="text-neutral-400 mt-1">
						Monitor and manage all teams and resources
					</p>
				</div>

				{/* Stats Grid */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{/* Total Teams */}
					<Card className="p-5">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-neutral-400">Total Teams</p>
								<p className="text-3xl font-bold text-neutral-100 mt-1">
									{stats.totalTeams}
								</p>
							</div>
							<div className="w-12 h-12 bg-violet-500/20 rounded-lg flex items-center justify-center">
								<svg
									className="w-6 h-6 text-violet-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
									/>
								</svg>
							</div>
						</div>
					</Card>

					{/* Total Clusters */}
					<Card className="p-5">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-neutral-400">Total Clusters</p>
								<p className="text-3xl font-bold text-neutral-100 mt-1">
									{stats.totalClusters}
								</p>
							</div>
							<div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
								<svg
									className="w-6 h-6 text-green-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
									/>
								</svg>
							</div>
						</div>
					</Card>

					{/* Total Users */}
					<Card className="p-5">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-neutral-400">Total Users</p>
								<p className="text-3xl font-bold text-neutral-100 mt-1">
									{stats.totalUsers}
								</p>
							</div>
							<div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
								<svg
									className="w-6 h-6 text-blue-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
									/>
								</svg>
							</div>
						</div>
					</Card>

					{/* Cluster Health */}
					<Card className="p-5">
						<div className="flex items-center justify-between mb-3">
							<p className="text-sm text-neutral-400">Cluster Health</p>
						</div>
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-1.5">
								<span className="w-3 h-3 rounded-full bg-green-500" />
								<span className="text-lg font-bold text-green-400">
									{stats.readyClusters}
								</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="w-3 h-3 rounded-full bg-yellow-500" />
								<span className="text-lg font-bold text-yellow-400">
									{stats.provisioningClusters}
								</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="w-3 h-3 rounded-full bg-red-500" />
								<span className="text-lg font-bold text-red-400">
									{stats.failedClusters}
								</span>
							</div>
						</div>
					</Card>
				</div>

				{/* Teams Overview */}
				<Card className="overflow-hidden">
					<div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
						<h2 className="text-lg font-medium text-neutral-100">Teams</h2>
						<Link
							to="/admin/teams"
							className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
						>
							View all →
						</Link>
					</div>

					{teams.length === 0 ? (
						<div className="px-5 py-8 text-center text-neutral-500">
							No teams created yet
						</div>
					) : (
						<div className="divide-y divide-neutral-800">
							{teams.slice(0, 5).map((team) => {
								const teamName = getTeamName(team)
								const displayName = getTeamDisplayName(team)
								const phase = getTeamPhase(team)

								return (
									<Link
										key={teamName}
										to={`/admin/teams/${teamName}`}
										className="flex items-center justify-between px-5 py-4 hover:bg-neutral-800/50 transition-colors"
									>
										<div className="flex items-center gap-3">
											{/* Team Avatar */}
											<div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
												<span className="text-green-400 font-bold">
													{displayName.charAt(0).toUpperCase()}
												</span>
											</div>
											<div>
												<p className="font-medium text-neutral-200">
													{displayName}
												</p>
												<p className="text-xs text-neutral-500">@{teamName}</p>
											</div>
										</div>

										<div className="flex items-center gap-6">
											{/* Status */}
											<StatusBadge status={phase} />

											{/* Arrow */}
											<svg
												className="w-5 h-5 text-neutral-600"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 5l7 7-7 7"
												/>
											</svg>
										</div>
									</Link>
								)
							})}
						</div>
					)}
				</Card>

				{/* Quick Actions */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Link
						to="/admin/teams"
						className="flex items-center gap-3 p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-violet-500/50 transition-colors"
					>
						<div className="w-10 h-10 bg-violet-500/20 rounded-lg flex items-center justify-center">
							<svg
								className="w-5 h-5 text-violet-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 4v16m8-8H4"
								/>
							</svg>
						</div>
						<div>
							<p className="font-medium text-neutral-200">Create Team</p>
							<p className="text-xs text-neutral-500">Add a new team</p>
						</div>
					</Link>

					<Link
						to="/admin/users"
						className="flex items-center gap-3 p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-violet-500/50 transition-colors"
					>
						<div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
							<svg
								className="w-5 h-5 text-blue-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
								/>
							</svg>
						</div>
						<div>
							<p className="font-medium text-neutral-200">Invite User</p>
							<p className="text-xs text-neutral-500">Add users to platform</p>
						</div>
					</Link>

					<Link
						to="/admin/providers"
						className="flex items-center gap-3 p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-violet-500/50 transition-colors"
					>
						<div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
							<svg
								className="w-5 h-5 text-green-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
								/>
							</svg>
						</div>
						<div>
							<p className="font-medium text-neutral-200">Manage Providers</p>
							<p className="text-xs text-neutral-500">Configure infrastructure</p>
						</div>
					</Link>
				</div>
			</div>
		</FadeIn>
	)
}
