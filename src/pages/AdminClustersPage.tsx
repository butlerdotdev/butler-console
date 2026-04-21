// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useEnvContext } from '@/hooks/useEnvContext'
import { useAuth } from '@/hooks/useAuth'
import { clustersApi, type Cluster } from '@/api'
import { ENVIRONMENT_LABEL } from '@/types/environments'
import { Card, StatusBadge, Spinner, FadeIn, Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@/components/ui'
import { envAccent, NEUTRAL_ACCENT, type EnvAccent } from '@/lib/envColor'
import { cn } from '@/lib/utils'

interface ManagementClusterInfo {
	kubernetesVersion: string
	phase: string
	nodes: { ready: number; total: number }
	tenantClusters: number
}

interface Team {
	name: string
	displayName: string
	description?: string
	phase: string
	namespace?: string
	clusterCount: number
	memberCount: number
}

type SortField = 'name' | 'namespace' | 'phase' | 'workers' | 'createdAt'
type SortDirection = 'asc' | 'desc'

type AdminViewMode = 'flat' | 'env' | 'team'

const VIEW_STORAGE_KEY = 'butler-console.admin-clusters.view'

function loadViewMode(): AdminViewMode {
	try {
		const raw = localStorage.getItem(VIEW_STORAGE_KEY)
		if (raw === 'flat' || raw === 'env' || raw === 'team') return raw
	} catch {
		// Fall through to default.
	}
	return 'flat'
}

function saveViewMode(mode: AdminViewMode) {
	try {
		localStorage.setItem(VIEW_STORAGE_KEY, mode)
	} catch {
		// localStorage unavailable; the feature degrades to session-only.
	}
}

export function AdminClustersPage() {
	useDocumentTitle('All Clusters')
	const { buildPath } = useTeamContext()
	const { currentEnv } = useEnvContext()
	const { user } = useAuth()
	const navigate = useNavigate()

	const [management, setManagement] = useState<ManagementClusterInfo | null>(null)
	const [clusters, setClusters] = useState<Cluster[]>([])
	const [teams, setTeams] = useState<Team[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [teamFilter, setTeamFilter] = useState<string>('')
	const [statusFilter, setStatusFilter] = useState<string>('')
	// Sort state - setters will be used when sorting UI is implemented
	const [sortField] = useState<SortField>('createdAt')
	const [sortDirection] = useState<SortDirection>('desc')

	// Create cluster modal state
	const [showCreateModal, setShowCreateModal] = useState(false)
	const [selectedTeam, setSelectedTeam] = useState<string>('')

	// View mode: flat | env | team. Persisted in localStorage so the
	// operator's layout preference survives navigation and reload.
	const [viewMode, setViewModeState] = useState<AdminViewMode>(() => loadViewMode())
	const setViewMode = useCallback((mode: AdminViewMode) => {
		setViewModeState(mode)
		saveViewMode(mode)
	}, [])

	// Permission check - platform admin or team admin
	const isAdmin = user?.isPlatformAdmin || user?.teams?.some(t => t.role === 'admin') || false

	const fetchTeams = useCallback(async () => {
		try {
			const response = await fetch('/api/teams', {
				credentials: 'include',
			})
			if (!response.ok) {
				throw new Error('Failed to fetch teams')
			}
			const data = await response.json()
			setTeams(data.teams || [])
		} catch (err) {
			console.error('Failed to fetch teams:', err)
			// Don't set error state - teams are optional for the main view
		}
	}, [])

	useEffect(() => {
		async function fetchData() {
			try {
				// Fetch management and all tenant clusters
				const [mgmt, tenantsResponse] = await Promise.all([
					clustersApi.getManagement().catch(() => null),
					clustersApi.list()
				])

				setManagement(mgmt)
				setClusters(tenantsResponse.clusters || [])
			} catch (err) {
				console.error('Failed to fetch clusters:', err)
				setError(err instanceof Error ? err.message : 'Failed to fetch clusters')
			} finally {
				setLoading(false)
			}
		}

		fetchData()
		fetchTeams()
	}, [fetchTeams])

	// Get unique namespaces for filter dropdown (from clusters)
	const namespaces = useMemo(() => {
		const unique = [...new Set(clusters.map((c) => c.metadata.namespace))]
		return unique.sort()
	}, [clusters])

	// Show the ENV column when an env is selected OR at least one
	// cluster in the result set carries the env label. Matches
	// ClustersPage behavior and the CLI's conditional-by-default shape.
	// In grouped views the section header carries env / team identity
	// so the per-card column is redundant.
	const showEnvColumn = useMemo(() => {
		if (viewMode !== 'flat') return false
		if (currentEnv) return true
		return clusters.some((c) => !!c.metadata.labels?.[ENVIRONMENT_LABEL])
	}, [viewMode, currentEnv, clusters])

	// Team namespace -> display name lookup for the "By team" grouping
	// section headers. Falls back to the namespace itself when no team
	// matches (can happen for clusters created outside the team flow).
	const teamsByNamespace = useMemo(() => {
		const m = new Map<string, Team>()
		for (const t of teams) {
			if (t.namespace) m.set(t.namespace, t)
			m.set(t.name, t)
		}
		return m
	}, [teams])

	// Get unique statuses for filter dropdown
	const statuses = useMemo(() => {
		const unique = [...new Set(clusters.map((c) => c.status?.phase || 'Unknown'))]
		return unique.sort()
	}, [clusters])

	// Filter and sort clusters
	const filteredClusters = useMemo(() => {
		let result = [...clusters]

		// Search filter
		if (search) {
			const lowerSearch = search.toLowerCase()
			result = result.filter(
				(c) =>
					c.metadata.name.toLowerCase().includes(lowerSearch) ||
					c.metadata.namespace.toLowerCase().includes(lowerSearch)
			)
		}

		// Namespace/team filter
		if (teamFilter) {
			result = result.filter((c) => c.metadata.namespace === teamFilter)
		}

		// Status filter
		if (statusFilter) {
			result = result.filter((c) => (c.status?.phase || 'Unknown') === statusFilter)
		}

		// Sort
		result.sort((a, b) => {
			let aVal: string | number
			let bVal: string | number

			switch (sortField) {
				case 'name':
					aVal = a.metadata.name
					bVal = b.metadata.name
					break
				case 'namespace':
					aVal = a.metadata.namespace
					bVal = b.metadata.namespace
					break
				case 'phase':
					aVal = a.status?.phase || 'Unknown'
					bVal = b.status?.phase || 'Unknown'
					break
				case 'workers':
					aVal = a.spec.workers?.replicas || 0
					bVal = b.spec.workers?.replicas || 0
					break
				case 'createdAt':
					aVal = a.metadata.creationTimestamp || ''
					bVal = b.metadata.creationTimestamp || ''
					break
				default:
					return 0
			}

			if (typeof aVal === 'string') {
				aVal = aVal.toLowerCase()
				bVal = (bVal as string).toLowerCase()
			}

			if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
			if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
			return 0
		})

		return result
	}, [clusters, search, teamFilter, statusFilter, sortField, sortDirection])

	// Grouped-by-env: section per env-label value plus a "no environment"
	// section for unlabeled clusters. Cross-team, so we group on the raw
	// label value rather than any single Team's spec.environments[];
	// quota bars intentionally absent because caps are per-team.
	const envGroupSections = useMemo(() => {
		if (viewMode !== 'env') return null
		const byEnv = new Map<string, Cluster[]>()
		for (const c of filteredClusters) {
			const envLabel = c.metadata?.labels?.[ENVIRONMENT_LABEL] || ''
			const key = envLabel
			if (!byEnv.has(key)) byEnv.set(key, [])
			byEnv.get(key)!.push(c)
		}
		const namedKeys = [...byEnv.keys()].filter((k) => k !== '').sort()
		const sections: { key: string; label: string; accent: EnvAccent; clusters: Cluster[] }[] = []
		for (const k of namedKeys) {
			sections.push({ key: k, label: k, accent: envAccent(k), clusters: byEnv.get(k) || [] })
		}
		if (byEnv.has('')) {
			sections.push({ key: '__unlabeled__', label: '(no environment)', accent: NEUTRAL_ACCENT, clusters: byEnv.get('') || [] })
		}
		return sections
	}, [viewMode, filteredClusters])

	// Grouped-by-team: section per team namespace. Uses the team
	// display name when the lookup resolves, otherwise the raw
	// namespace so clusters in adopted/legacy namespaces still render.
	const teamGroupSections = useMemo(() => {
		if (viewMode !== 'team') return null
		const byTeam = new Map<string, Cluster[]>()
		for (const c of filteredClusters) {
			const key = c.metadata?.namespace || ''
			if (!byTeam.has(key)) byTeam.set(key, [])
			byTeam.get(key)!.push(c)
		}
		const keys = [...byTeam.keys()].sort()
		return keys.map((k) => {
			const team = teamsByNamespace.get(k)
			const display = team?.displayName || team?.name || k || '(no team)'
			return { key: k || '__no-team__', label: display, namespace: k, clusters: byTeam.get(k) || [] }
		})
	}, [viewMode, filteredClusters, teamsByNamespace])

	// Handle create cluster navigation
	// Handle create cluster navigation
	const handleCreateCluster = () => {
		if (selectedTeam) {
			navigate(`/t/${selectedTeam}/clusters/new`)
			setShowCreateModal(false)
			setSelectedTeam('')
		}
	}

	// TODO: Wire up sorting UI
	// When implementing column header sorting, use:
	// - setSortField(field) to change sort column
	// - setSortDirection('asc' | 'desc') to change direction

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	if (error) {
		return (
			<Card className="p-4 border-red-500/20">
				<p className="text-red-400">{error}</p>
			</Card>
		)
	}

	const totalCount = clusters.length + (management ? 1 : 0)

	return (
		<FadeIn>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">All Clusters</h1>
						<p className="text-neutral-400 mt-1">
							View and manage clusters across all teams
						</p>
					</div>
					{isAdmin && (
						<Button onClick={() => setShowCreateModal(true)}>
							<svg
								className="w-4 h-4 mr-2"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 4v16m8-8H4"
								/>
							</svg>
							Create Cluster
						</Button>
					)}
				</div>

				{/* Filters */}
				<div className="flex flex-wrap items-center gap-4">
					{/* Search */}
					<div className="relative flex-1 min-w-[200px] max-w-md">
						<svg
							className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
						<input
							type="text"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search clusters..."
							className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
						/>
					</div>

					{/* Namespace Filter */}
					<select
						value={teamFilter}
						onChange={(e) => setTeamFilter(e.target.value)}
						className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
					>
						<option value="">All Teams</option>
						{namespaces.map((ns) => (
							<option key={ns} value={ns}>
								{ns}
							</option>
						))}
					</select>

					{/* Status Filter */}
					<select
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
						className="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
					>
						<option value="">All Statuses</option>
						{statuses.map((status) => (
							<option key={status} value={status}>
								{status}
							</option>
						))}
					</select>

					{/* Clear Filters */}
					{(search || teamFilter || statusFilter) && (
						<button
							onClick={() => {
								setSearch('')
								setTeamFilter('')
								setStatusFilter('')
							}}
							className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
						>
							Clear filters
						</button>
					)}
				</div>

				{/* Results Count + View Toggle */}
				<div className="flex items-center justify-between gap-4 flex-wrap">
					<p className="text-sm text-neutral-500">
						Showing {filteredClusters.length} of {totalCount} clusters
					</p>
					<div
						role="group"
						aria-label="Cluster list view mode"
						className="flex gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg"
					>
						{([
							{ key: 'flat' as const, label: 'Flat' },
							{ key: 'env' as const, label: 'By environment' },
							{ key: 'team' as const, label: 'By team' },
						]).map((opt) => {
							const active = viewMode === opt.key
							return (
								<button
									key={opt.key}
									type="button"
									onClick={() => setViewMode(opt.key)}
									aria-pressed={active}
									className={cn(
										'px-3 py-1 text-xs font-medium rounded transition-colors',
										active
											? 'bg-violet-500/20 text-violet-300'
											: 'text-neutral-400 hover:text-neutral-200'
									)}
								>
									{opt.label}
								</button>
							)
						})}
					</div>
				</div>

				{/* Management Cluster Card */}
				{management && !search && !teamFilter && !statusFilter && (
					<Link to={buildPath('/management')}>
						<Card className="p-5 hover:bg-neutral-800/50 transition-colors cursor-pointer border-violet-500/20">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-4">
									<div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
										<svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
										</svg>
									</div>
									<div>
										<div className="flex items-center gap-2">
											<p className="font-medium text-neutral-50">Management Cluster</p>
											<span className="px-2 py-0.5 text-xs font-medium bg-violet-500/10 text-violet-400 rounded">
												Management
											</span>
										</div>
										<p className="text-sm text-neutral-400">butler-system</p>
									</div>
								</div>
								<div className="flex items-center gap-8">
									<div className="text-right">
										<p className="text-xs text-neutral-500 uppercase tracking-wide">Nodes</p>
										<p className="text-sm text-neutral-200">{management.nodes.ready}/{management.nodes.total}</p>
									</div>
									<div className="text-right">
										<p className="text-xs text-neutral-500 uppercase tracking-wide">Version</p>
										<p className="text-sm text-neutral-200">{management.kubernetesVersion}</p>
									</div>
									<div className="text-right">
										<p className="text-xs text-neutral-500 uppercase tracking-wide">Tenants</p>
										<p className="text-sm text-neutral-200">{management.tenantClusters}</p>
									</div>
									<StatusBadge status={management.phase} />
								</div>
							</div>
						</Card>
					</Link>
				)}

				{/* Tenant Clusters */}
				{viewMode === 'flat' && (
					<div className="space-y-3">
						{filteredClusters.map((cluster) => (
							<AdminClusterCard
								key={`${cluster.metadata.namespace}/${cluster.metadata.name}`}
								cluster={cluster}
								buildPath={buildPath}
								showEnv={showEnvColumn}
							/>
						))}
					</div>
				)}

				{viewMode === 'env' && envGroupSections && (
					<div className="space-y-6">
						{envGroupSections.map((section) => (
							<AdminGroupSection
								key={section.key}
								label={section.label}
								sublabel={`${section.clusters.length} ${section.clusters.length === 1 ? 'cluster' : 'clusters'}`}
								accentDot={section.accent.dot}
								tint={section.accent.headerTint}
								border={section.accent.border}
								clusters={section.clusters}
								buildPath={buildPath}
							/>
						))}
					</div>
				)}

				{viewMode === 'team' && teamGroupSections && (
					<div className="space-y-6">
						{teamGroupSections.map((section) => (
							<AdminGroupSection
								key={section.key}
								label={section.label}
								sublabel={`${section.namespace || 'no namespace'} · ${section.clusters.length} ${section.clusters.length === 1 ? 'cluster' : 'clusters'}`}
								accentDot="bg-violet-500"
								tint="bg-violet-500/5"
								border="border-l-violet-500"
								clusters={section.clusters}
								buildPath={buildPath}
							/>
						))}
					</div>
				)}

				{filteredClusters.length === 0 && !management && (
					<Card className="p-8 text-center">
						<p className="text-neutral-400">No clusters found</p>
					</Card>
				)}
			</div>

			{/* Create Cluster Modal */}
			<Modal isOpen={showCreateModal} onClose={() => {
				setShowCreateModal(false)
				setSelectedTeam('')
			}}>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">Create Cluster</h2>
				</ModalHeader>
				<ModalBody>
					{teams.length === 0 ? (
						<div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
							<p className="text-sm text-amber-400">
								No teams exist yet. Please create a team first before creating a cluster.
							</p>
							<Link
								to="/admin/teams"
								className="inline-block mt-2 text-sm text-violet-400 hover:text-violet-300"
								onClick={() => setShowCreateModal(false)}
							>
								Go to Teams â†’
							</Link>
						</div>
					) : (
						<div className="space-y-4">
							<p className="text-sm text-neutral-400">
								Select the team namespace where the cluster will be created:
							</p>
							<select
								value={selectedTeam}
								onChange={(e) => setSelectedTeam(e.target.value)}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
							>
								<option value="">Select a team...</option>
								{teams.map((team) => (
									<option key={team.name} value={team.namespace || team.name}>
										{team.displayName || team.name}
										{team.namespace && team.namespace !== team.name ? ` (${team.namespace})` : ''}
									</option>
								))}
							</select>
						</div>
					)}
				</ModalBody>
				{teams.length > 0 && (
					<ModalFooter>
						<Button
							variant="secondary"
							onClick={() => {
								setShowCreateModal(false)
								setSelectedTeam('')
							}}
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreateCluster}
							disabled={!selectedTeam}
						>
							Continue
						</Button>
					</ModalFooter>
				)}
			</Modal>
		</FadeIn>
	)
}

function AdminClusterCard({
	cluster,
	buildPath,
	showEnv,
	accentBorder,
}: {
	cluster: Cluster
	buildPath: (path: string) => string
	showEnv: boolean
	accentBorder?: string
}) {
	const name = cluster.metadata.name
	const namespace = cluster.metadata.namespace
	return (
		<Link
			key={`${namespace}/${name}`}
			to={buildPath(`/clusters/${namespace}/${name}`)}
		>
			<Card
				className={cn(
					'p-5 hover:bg-neutral-800/50 transition-colors cursor-pointer',
					accentBorder ? cn('border-l-4', accentBorder) : ''
				)}
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
							<svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
							</svg>
						</div>
						<div>
							<p className="font-medium text-neutral-50">{name}</p>
							<p className="text-sm text-neutral-400">{namespace}</p>
						</div>
					</div>
					<div className="flex items-center gap-8">
						<div className="text-right">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Provider</p>
							<p className="text-sm text-neutral-200">{cluster.spec.providerConfigRef?.name || 'Default'}</p>
						</div>
						{showEnv && (
							<div className="text-right">
								<p className="text-xs text-neutral-500 uppercase tracking-wide">Env</p>
								<p className="text-sm text-neutral-200">
									{cluster.metadata.labels?.[ENVIRONMENT_LABEL] || '-'}
								</p>
							</div>
						)}
						<div className="text-right">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Version</p>
							<p className="text-sm text-neutral-200">{cluster.spec.kubernetesVersion}</p>
						</div>
						<div className="text-right">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Workers</p>
							<p className="text-sm text-neutral-200">{cluster.spec.workers?.replicas || 0}</p>
						</div>
						<StatusBadge status={cluster.status?.phase || 'Unknown'} />
					</div>
				</div>
			</Card>
		</Link>
	)
}

function AdminGroupSection({
	label,
	sublabel,
	accentDot,
	tint,
	border,
	clusters,
	buildPath,
}: {
	label: string
	sublabel: string
	accentDot: string
	tint: string
	border: string
	clusters: Cluster[]
	buildPath: (path: string) => string
}) {
	return (
		<section className="space-y-3">
			<div
				className={cn(
					'sticky top-0 z-10 flex items-center gap-3 px-3 py-2 rounded-lg border border-neutral-800 backdrop-blur bg-neutral-900/90',
					tint
				)}
			>
				<span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', accentDot)} />
				<span className="text-sm font-semibold text-neutral-100">{label}</span>
				<span className="text-xs text-neutral-500">{sublabel}</span>
			</div>
			{clusters.length === 0 ? (
				<p className="text-sm text-neutral-500 italic pl-1">No clusters in this section.</p>
			) : (
				<div className="grid gap-3">
					{clusters.map((cluster) => (
						<AdminClusterCard
							key={`${cluster.metadata.namespace}/${cluster.metadata.name}`}
							cluster={cluster}
							buildPath={buildPath}
							showEnv={false}
							accentBorder={border}
						/>
					))}
				</div>
			)}
		</section>
	)
}
