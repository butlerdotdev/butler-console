// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useEnvContext } from '@/hooks/useEnvContext'
import { useDocumentTitle } from '@/hooks'
import { clustersApi, type Cluster } from '@/api'
import { ENVIRONMENT_LABEL, type TeamEnvironment } from '@/types/environments'
import { Card, Spinner, StatusBadge, FadeIn, Button } from '@/components/ui'

interface ManagementClusterInfo {
	kubernetesVersion: string
	phase: string
	nodes: { ready: number; total: number }
	tenantClusters: number
}

// Stable render order for the phase filter control. "Unknown" captures
// any cluster whose status.phase has not populated yet.
const PHASE_ORDER = ['Pending', 'Provisioning', 'Installing', 'Ready', 'Failed', 'Unknown'] as const

const UNLABELED_SECTION_KEY = '__unlabeled__'

export function ClustersPage() {
	const { currentTeam, currentTeamDisplayName, buildPath, isAdminMode } = useTeamContext()
	const { currentEnv, availableEnvs } = useEnvContext()
	useDocumentTitle(currentTeamDisplayName ? `${currentTeamDisplayName} Clusters` : 'Clusters')

	const [management, setManagement] = useState<ManagementClusterInfo | null>(null)
	const [clusters, setClusters] = useState<Cluster[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [phaseFilter, setPhaseFilter] = useState<Set<string>>(new Set())

	const loadClusters = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)
			const [mgmt, tenantsResponse] = await Promise.all([
				clustersApi.getManagement().catch(() => null),
				clustersApi.list({ team: currentTeam ?? undefined })
			])
			setManagement(mgmt)
			setClusters(tenantsResponse.clusters || [])
		} catch (err) {
			console.error('Failed to load clusters:', err)
			setError(err instanceof Error ? err.message : 'Failed to load clusters')
		} finally {
			setLoading(false)
		}
	}, [currentTeam])

	useEffect(() => {
		loadClusters()
	}, [loadClusters])

	// Filter pipeline. The EnvSwitcher scopes the list: when currentEnv
	// is set, only same-env clusters are visible. When the EnvSwitcher
	// is "All environments" (currentEnv null), the list includes every
	// cluster the user has access to and we render grouped sections below.
	const envFilteredClusters = useMemo(() => {
		if (!currentEnv) return clusters
		return clusters.filter((c) => c.metadata?.labels?.[ENVIRONMENT_LABEL] === currentEnv)
	}, [clusters, currentEnv])

	const searchFilteredClusters = useMemo(() => {
		const q = search.trim().toLowerCase()
		if (!q) return envFilteredClusters
		return envFilteredClusters.filter((c) => {
			const name = (c.metadata?.name || '').toLowerCase()
			const namespace = (c.metadata?.namespace || '').toLowerCase()
			return name.includes(q) || namespace.includes(q)
		})
	}, [envFilteredClusters, search])

	const visibleClusters = useMemo(() => {
		if (phaseFilter.size === 0) return searchFilteredClusters
		return searchFilteredClusters.filter((c) => phaseFilter.has(c.status?.phase || 'Unknown'))
	}, [searchFilteredClusters, phaseFilter])

	// Available phase options (only phases actually present in the
	// result set before the phase filter applies, so the control does
	// not advertise options that would match nothing).
	const availablePhases = useMemo(() => {
		const present = new Set<string>()
		for (const c of searchFilteredClusters) {
			present.add(c.status?.phase || 'Unknown')
		}
		return PHASE_ORDER.filter((p) => present.has(p))
	}, [searchFilteredClusters])

	// Group clusters by env when the team has envs defined AND the
	// EnvSwitcher is on "All environments". When the switcher already
	// scopes to a single env, the flat list is more readable than a
	// one-section group render.
	const shouldGroup = availableEnvs.length > 0 && !currentEnv

	const groupSections = useMemo(() => {
		if (!shouldGroup) return null
		const envSorted = [...availableEnvs].sort((a, b) => a.name.localeCompare(b.name))
		const byEnv = new Map<string, Cluster[]>()
		for (const env of envSorted) byEnv.set(env.name, [])
		const unlabeled: Cluster[] = []
		for (const c of visibleClusters) {
			const envLabel = c.metadata?.labels?.[ENVIRONMENT_LABEL]
			if (envLabel && byEnv.has(envLabel)) {
				byEnv.get(envLabel)!.push(c)
			} else if (envLabel) {
				// Cluster carries an env label that is not in the team spec
				// (stale after env deletion, or race during migration).
				// Thread it into its own section so it does not vanish.
				if (!byEnv.has(envLabel)) byEnv.set(envLabel, [])
				byEnv.get(envLabel)!.push(c)
			} else {
				unlabeled.push(c)
			}
		}
		const sections: { key: string; env?: TeamEnvironment; label: string; clusters: Cluster[] }[] = []
		for (const env of envSorted) {
			sections.push({ key: env.name, env, label: env.name, clusters: byEnv.get(env.name) || [] })
		}
		// Any orphan labels (not in the team env spec) render below the
		// defined envs with a "stale" tag via the env prop left undefined.
		for (const [name, list] of byEnv) {
			if (envSorted.some((e) => e.name === name)) continue
			sections.push({ key: `orphan:${name}`, label: name, clusters: list })
		}
		if (unlabeled.length > 0) {
			sections.push({ key: UNLABELED_SECTION_KEY, label: 'No environment', clusters: unlabeled })
		}
		return sections
	}, [shouldGroup, availableEnvs, visibleClusters])

	const showManagement = management && isAdminMode
	const hasAnyFilter = search.trim() !== '' || phaseFilter.size > 0
	const resultsLabel = hasAnyFilter
		? `Showing ${visibleClusters.length} of ${clusters.length} clusters`
		: null

	// Conditional ENV column for the flat layouts (ungrouped-team OR
	// env-scoped). The grouped layout renders env via the section header
	// and hides the per-card ENV column for readability.
	const showEnvColumnInFlat = useMemo(() => {
		if (shouldGroup) return false
		if (currentEnv) return true
		return clusters.some((c) => !!c.metadata?.labels?.[ENVIRONMENT_LABEL])
	}, [shouldGroup, currentEnv, clusters])

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
				<button
					onClick={loadClusters}
					className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
				>
					Retry
				</button>
			</Card>
		)
	}

	return (
		<FadeIn>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Clusters</h1>
						<p className="text-neutral-400 mt-1">
							{currentEnv
								? <>Scoped to environment <span className="text-neutral-200 font-medium">{currentEnv}</span>. Clear the environment picker to view all.</>
								: 'Manage your Kubernetes clusters'}
						</p>
					</div>
					<Link to={buildPath('/clusters/new')}>
						<Button>
							<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
							</svg>
							Create Cluster
						</Button>
					</Link>
				</div>

				{(clusters.length > 0 || showManagement) && (
					<ClusterListToolbar
						search={search}
						onSearchChange={setSearch}
						phaseFilter={phaseFilter}
						onPhaseFilterChange={setPhaseFilter}
						availablePhases={availablePhases}
						resultsLabel={resultsLabel}
					/>
				)}

				<div className="grid gap-4">
					{showManagement && <ManagementClusterCard info={management} />}

					{groupSections ? (
						groupSections.length === 0 ? null : (
							groupSections.map((section) => (
								<GroupSection
									key={section.key}
									label={section.label}
									env={section.env}
									clusters={section.clusters}
									buildPath={buildPath}
								/>
							))
						)
					) : (
						visibleClusters.map((cluster) => (
							<ClusterCard
								key={cluster.metadata.uid || `${cluster.metadata.namespace}/${cluster.metadata.name}`}
								cluster={cluster}
								buildPath={buildPath}
								showEnv={showEnvColumnInFlat}
							/>
						))
					)}

					{!showManagement && clusters.length === 0 && (
						<Card className="p-8 text-center">
							<svg
								className="mx-auto h-12 w-12 text-neutral-600 mb-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
									d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
								/>
							</svg>
							<p className="text-neutral-400 mb-4">No clusters yet</p>
							<Link to={buildPath('/clusters/new')}>
								<Button>Create Cluster</Button>
							</Link>
						</Card>
					)}

					{clusters.length > 0 && visibleClusters.length === 0 && (
						<Card className="p-6 text-center">
							<p className="text-neutral-400">
								No clusters match the current filters.
							</p>
							<button
								onClick={() => {
									setSearch('')
									setPhaseFilter(new Set())
								}}
								className="mt-2 text-sm text-blue-400 hover:text-blue-300 underline"
							>
								Clear filters
							</button>
						</Card>
					)}
				</div>
			</div>
		</FadeIn>
	)
}

function ClusterListToolbar({
	search,
	onSearchChange,
	phaseFilter,
	onPhaseFilterChange,
	availablePhases,
	resultsLabel,
}: {
	search: string
	onSearchChange: (v: string) => void
	phaseFilter: Set<string>
	onPhaseFilterChange: (s: Set<string>) => void
	availablePhases: readonly string[]
	resultsLabel: string | null
}) {
	const togglePhase = (phase: string) => {
		const next = new Set(phaseFilter)
		if (next.has(phase)) next.delete(phase)
		else next.add(phase)
		onPhaseFilterChange(next)
	}
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-col md:flex-row gap-3">
				<div className="flex-1 relative">
					<svg
						className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<input
						type="text"
						value={search}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder="Search clusters by name or namespace"
						className="w-full pl-10 pr-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
					/>
				</div>
				<div className="flex items-center gap-2 flex-wrap">
					{availablePhases.length === 0 ? (
						<span className="text-sm text-neutral-500">No phases to filter</span>
					) : (
						availablePhases.map((phase) => {
							const active = phaseFilter.has(phase)
							return (
								<button
									key={phase}
									onClick={() => togglePhase(phase)}
									className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
										active
											? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
											: 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700'
									}`}
								>
									{phase}
								</button>
							)
						})
					)}
				</div>
			</div>
			{resultsLabel && (
				<div className="text-xs text-neutral-500">{resultsLabel}</div>
			)}
		</div>
	)
}

function GroupSection({
	label,
	env,
	clusters,
	buildPath,
}: {
	label: string
	env?: TeamEnvironment
	clusters: Cluster[]
	buildPath: (path: string) => string
}) {
	const count = clusters.length
	const maxClusters = env?.limits?.maxClusters
	const maxPerMember = env?.limits?.maxClustersPerMember
	const isUnlabeled = !env && label === 'No environment'
	const isOrphan = !env && !isUnlabeled
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between border-b border-neutral-800 pb-2">
				<div className="flex items-center gap-3">
					<h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
						{label}
					</h2>
					<span className="text-xs text-neutral-500">
						{count} {count === 1 ? 'cluster' : 'clusters'}
						{maxClusters ? ` of ${maxClusters}` : ''}
					</span>
					{maxPerMember ? (
						<span className="px-2 py-0.5 rounded text-xs bg-neutral-800 text-neutral-300">
							{maxPerMember} per member
						</span>
					) : null}
					{isOrphan ? (
						<span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">
							stale label
						</span>
					) : null}
					{isUnlabeled ? (
						<span className="px-2 py-0.5 rounded text-xs bg-neutral-800 text-neutral-400">
							pre-migration
						</span>
					) : null}
				</div>
			</div>
			{count === 0 ? (
				<p className="text-sm text-neutral-500 italic pl-1">
					No clusters in this environment.
				</p>
			) : (
				<div className="grid gap-3">
					{clusters.map((cluster) => (
						<ClusterCard
							key={cluster.metadata.uid || `${cluster.metadata.namespace}/${cluster.metadata.name}`}
							cluster={cluster}
							buildPath={buildPath}
							showEnv={false}
						/>
					))}
				</div>
			)}
		</div>
	)
}

function ManagementClusterCard({ info }: { info: ManagementClusterInfo }) {
	return (
		<Link to="/management">
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
							<p className="text-sm text-neutral-200">{info.nodes.ready}/{info.nodes.total}</p>
						</div>
						<div className="text-right">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Version</p>
							<p className="text-sm text-neutral-200">{info.kubernetesVersion}</p>
						</div>
						<div className="text-right">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Tenants</p>
							<p className="text-sm text-neutral-200">{info.tenantClusters}</p>
						</div>
						<StatusBadge status={info.phase} />
					</div>
				</div>
			</Card>
		</Link>
	)
}

function ClusterCard({
	cluster,
	buildPath,
	showEnv,
}: {
	cluster: Cluster
	buildPath: (path: string) => string
	showEnv: boolean
}) {
	const name = cluster.metadata.name
	const namespace = cluster.metadata.namespace
	const phase = cluster.status?.phase || 'Unknown'
	const version = cluster.spec.kubernetesVersion || 'Unknown'
	const workers = cluster.spec.workers?.replicas || 0
	const provider = cluster.spec.providerConfigRef?.name || 'Default'
	const envLabel = cluster.metadata.labels?.[ENVIRONMENT_LABEL] || '-'

	const createdAt = cluster.metadata.creationTimestamp
	let age = 'Unknown'
	if (createdAt) {
		const created = new Date(createdAt)
		const now = new Date()
		const diffMs = now.getTime() - created.getTime()
		const diffMins = Math.floor(diffMs / 60000)
		const diffHours = Math.floor(diffMins / 60)
		const diffDays = Math.floor(diffHours / 24)

		if (diffDays > 0) age = `${diffDays}d ago`
		else if (diffHours > 0) age = `${diffHours}h ago`
		else age = `${diffMins}m ago`
	}

	return (
		<Link to={buildPath(`/clusters/${namespace}/${name}`)}>
			<Card className="p-5 hover:bg-neutral-800/50 transition-colors cursor-pointer">
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
							<p className="text-sm text-neutral-200">{provider}</p>
						</div>
						{showEnv && (
							<div className="text-right">
								<p className="text-xs text-neutral-500 uppercase tracking-wide">Env</p>
								<p className="text-sm text-neutral-200">{envLabel}</p>
							</div>
						)}
						<div className="text-right">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Version</p>
							<p className="text-sm text-neutral-200">{version}</p>
						</div>
						<div className="text-right">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Workers</p>
							<p className="text-sm text-neutral-200">{workers}</p>
						</div>
						<div className="text-right">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Age</p>
							<p className="text-sm text-neutral-200">{age}</p>
						</div>
						<StatusBadge status={phase} />
					</div>
				</div>
			</Card>
		</Link>
	)
}
