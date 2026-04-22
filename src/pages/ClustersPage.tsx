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
import { envAccent, NEUTRAL_ACCENT, type EnvAccent } from '@/lib/envColor'
import { cn } from '@/lib/utils'

// Owner is written as an annotation by the controller (or falls back
// to the creator-email annotation the server/CLI stamps). Exposed as
// a conditional column in the cluster list, same pattern as ENV.
const OWNER_ANNOTATION = 'butler.butlerlabs.dev/owner'
const CREATOR_EMAIL_ANNOTATION = 'butler.butlerlabs.dev/creator-email'

function clusterOwner(c: Cluster): string {
	const a = c.metadata?.annotations
	return a?.[OWNER_ANNOTATION] || a?.[CREATOR_EMAIL_ANNOTATION] || ''
}

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

// localStorage key scoped per team so collapse preferences persist
// across navigation and reload but do not leak between teams.
function collapseStorageKey(team: string | null): string {
	return `butler-console.clusters.collapse.${team ?? 'global'}`
}

function loadCollapsedSections(team: string | null): Set<string> {
	try {
		const raw = localStorage.getItem(collapseStorageKey(team))
		if (!raw) return new Set()
		const arr = JSON.parse(raw)
		if (Array.isArray(arr)) return new Set(arr.filter((v): v is string => typeof v === 'string'))
	} catch {
		// Ignore parse errors; fall back to an empty set (all expanded).
	}
	return new Set()
}

function saveCollapsedSections(team: string | null, collapsed: Set<string>) {
	try {
		localStorage.setItem(collapseStorageKey(team), JSON.stringify([...collapsed]))
	} catch {
		// Quota or privacy mode; the feature degrades to session-only.
	}
}

export function ClustersPage() {
	const { currentTeam, currentTeamDisplayName, buildPath, isAdminMode, isTeamAdmin, canAccessAdmin } = useTeamContext()
	const { currentEnv, availableEnvs } = useEnvContext()
	useDocumentTitle(currentTeamDisplayName ? `${currentTeamDisplayName} Clusters` : 'Clusters')

	const [management, setManagement] = useState<ManagementClusterInfo | null>(null)
	const [clusters, setClusters] = useState<Cluster[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [phaseFilter, setPhaseFilter] = useState<Set<string>>(new Set())
	const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsedSections(currentTeam))

	// Re-hydrate collapse state when the active team changes so each
	// team carries its own layout preference.
	useEffect(() => {
		setCollapsed(loadCollapsedSections(currentTeam))
	}, [currentTeam])

	const toggleCollapsed = useCallback(
		(key: string) => {
			setCollapsed((prev) => {
				const next = new Set(prev)
				if (next.has(key)) next.delete(key)
				else next.add(key)
				saveCollapsedSections(currentTeam, next)
				return next
			})
		},
		[currentTeam]
	)

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

	// Only advertise phase filter options that actually exist in the
	// pre-phase result set, so the control never shows a chip that
	// would match nothing.
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
				if (!byEnv.has(envLabel)) byEnv.set(envLabel, [])
				byEnv.get(envLabel)!.push(c)
			} else {
				unlabeled.push(c)
			}
		}
		const sections: {
			key: string
			env?: TeamEnvironment
			label: string
			clusters: Cluster[]
			accent: EnvAccent
			kind: 'env' | 'orphan' | 'unlabeled'
		}[] = []
		for (const env of envSorted) {
			sections.push({
				key: env.name,
				env,
				label: env.name,
				clusters: byEnv.get(env.name) || [],
				accent: envAccent(env.name),
				kind: 'env',
			})
		}
		for (const [name, list] of byEnv) {
			if (envSorted.some((e) => e.name === name)) continue
			sections.push({
				key: `orphan:${name}`,
				label: name,
				clusters: list,
				accent: envAccent(name),
				kind: 'orphan',
			})
		}
		if (unlabeled.length > 0) {
			sections.push({
				key: UNLABELED_SECTION_KEY,
				label: 'No environment',
				clusters: unlabeled,
				accent: NEUTRAL_ACCENT,
				kind: 'unlabeled',
			})
		}
		return sections
	}, [shouldGroup, availableEnvs, visibleClusters])

	const showManagement = management && isAdminMode
	const hasAnyFilter = search.trim() !== '' || phaseFilter.size > 0
	const resultsLabel = hasAnyFilter
		? `Showing ${visibleClusters.length} of ${clusters.length} clusters`
		: null

	// Conditional ENV column for flat layouts only. The grouped layout
	// already surfaces env identity via section header + card accent.
	const showEnvColumnInFlat = useMemo(() => {
		if (shouldGroup) return false
		if (currentEnv) return true
		return clusters.some((c) => !!c.metadata?.labels?.[ENVIRONMENT_LABEL])
	}, [shouldGroup, currentEnv, clusters])

	// Conditional Owner column: appears when at least one cluster in
	// the result set carries the owner/creator annotation. Mirrors the
	// ENV column shape.
	const showOwnerColumn = useMemo(() => {
		return clusters.some((c) => clusterOwner(c) !== '')
	}, [clusters])

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

	const flatActiveEnvAccent = currentEnv ? envAccent(currentEnv) : null

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
					<div className="flex items-center gap-2">
						{(isTeamAdmin || canAccessAdmin) && availableEnvs.length > 0 && (
							<Link
								to={buildPath('/environments')}
								className="px-3 py-2 rounded-lg text-sm font-medium border border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-neutral-100 transition-colors flex items-center gap-2"
							>
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								Manage environments
							</Link>
						)}
						<Link to={buildPath(currentEnv ? `/clusters/new?env=${encodeURIComponent(currentEnv)}` : '/clusters/new')}>
							<Button>
								<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
								</svg>
								Create Cluster
							</Button>
						</Link>
					</div>
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

				<div className="space-y-6">
					{showManagement && <ManagementClusterCard info={management} />}

					{groupSections ? (
						groupSections.map((section) => (
							<GroupSection
								key={section.key}
								section={section}
								buildPath={buildPath}
								collapsed={collapsed.has(section.key)}
								onToggle={() => toggleCollapsed(section.key)}
							/>
						))
					) : (
						<div className="grid gap-4">
							{visibleClusters.map((cluster) => (
								<ClusterCard
									key={cluster.metadata.uid || `${cluster.metadata.namespace}/${cluster.metadata.name}`}
									cluster={cluster}
									buildPath={buildPath}
									showEnv={showEnvColumnInFlat}
									showOwner={showOwnerColumn}
									accent={flatActiveEnvAccent ?? undefined}
								/>
							))}
						</div>
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

// Inline quota bar sized for a section header. Uses the same color
// bands as ResourceUsageBar (green / amber / red at 80 / 90 %).
function QuotaBar({ used, limit }: { used: number; limit: number }) {
	const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
	const barColor =
		pct >= 90 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
	const textColor =
		pct >= 90 ? 'text-red-300' : pct >= 80 ? 'text-amber-300' : 'text-neutral-400'
	return (
		<div className="flex items-center gap-2 min-w-[140px]">
			<div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
				<div
					className={cn('h-full rounded-full transition-all', barColor)}
					style={{ width: `${Math.min(pct, 100)}%` }}
				/>
			</div>
			<span className={cn('text-xs font-mono tabular-nums', textColor)}>
				{used}/{limit}
			</span>
		</div>
	)
}

function GroupSection({
	section,
	buildPath,
	collapsed,
	onToggle,
}: {
	section: {
		key: string
		env?: TeamEnvironment
		label: string
		clusters: Cluster[]
		accent: EnvAccent
		kind: 'env' | 'orphan' | 'unlabeled'
	}
	buildPath: (path: string) => string
	collapsed: boolean
	onToggle: () => void
}) {
	const { env, label, clusters, accent, kind } = section
	const count = clusters.length
	const maxClusters = env?.limits?.maxClusters
	const maxPerMember = env?.limits?.maxClustersPerMember
	return (
		<section className="space-y-3">
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={!collapsed}
				className={cn(
					'w-full sticky top-0 z-10 flex items-center gap-3 px-3 py-2 rounded-lg border border-neutral-800 backdrop-blur',
					'bg-neutral-900/90 hover:bg-neutral-900',
					'transition-colors text-left',
					accent.headerTint
				)}
			>
				<svg
					className={cn(
						'w-4 h-4 text-neutral-500 transition-transform',
						collapsed ? '-rotate-90' : ''
					)}
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
				<span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', accent.dot)} />
				<span className="text-sm font-semibold text-neutral-100">{label}</span>
				<span className="text-xs text-neutral-500">
					{count} {count === 1 ? 'cluster' : 'clusters'}
				</span>
				{maxPerMember ? (
					<span className={cn('px-2 py-0.5 rounded text-xs', accent.pillBg, accent.pillText)}>
						{maxPerMember} per member
					</span>
				) : null}
				{kind === 'orphan' ? (
					<span className="px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-300 border border-amber-500/20">
						stale label
					</span>
				) : null}
				{kind === 'unlabeled' ? (
					<span className="px-2 py-0.5 rounded text-xs bg-neutral-800 text-neutral-400">
						pre-migration
					</span>
				) : null}
				<div className="flex-1" />
				{maxClusters ? <QuotaBar used={count} limit={maxClusters} /> : null}
			</button>

			{!collapsed && (
				count === 0 ? (
					kind === 'env' && env ? (
						<Card className="p-4 text-center border-dashed border-neutral-800 bg-neutral-900/30">
							<p className="text-sm text-neutral-400 mb-2">
								No clusters in <span className="text-neutral-200 font-medium">{env.name}</span> yet.
							</p>
							<Link
								to={buildPath(`/clusters/new?env=${encodeURIComponent(env.name)}`)}
								className={cn(
									'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium',
									accent.pillBg,
									accent.pillText,
									'hover:opacity-90 transition-opacity'
								)}
							>
								<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
								</svg>
								Create cluster in {env.name}
							</Link>
						</Card>
					) : (
						<p className="text-sm text-neutral-500 italic pl-1">
							No clusters in this section.
						</p>
					)
				) : (
					<div className="grid gap-3">
						{clusters.map((cluster) => (
							<ClusterCard
								key={cluster.metadata.uid || `${cluster.metadata.namespace}/${cluster.metadata.name}`}
								cluster={cluster}
								buildPath={buildPath}
								showEnv={false}
								showOwner={clusters.some((c) => clusterOwner(c) !== '')}
								accent={accent}
							/>
						))}
					</div>
				)
			)}
		</section>
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
	showOwner,
	accent,
}: {
	cluster: Cluster
	buildPath: (path: string) => string
	showEnv: boolean
	showOwner?: boolean
	accent?: EnvAccent
}) {
	const name = cluster.metadata.name
	const namespace = cluster.metadata.namespace
	const phase = cluster.status?.phase || 'Unknown'
	const version = cluster.spec.kubernetesVersion || 'Unknown'
	const workers = cluster.spec.workers?.replicas || 0
	const provider = cluster.spec.providerConfigRef?.name || 'Default'
	const envLabel = cluster.metadata.labels?.[ENVIRONMENT_LABEL] || '-'
	const owner = clusterOwner(cluster) || '-'

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
			<Card
				className={cn(
					'p-5 hover:bg-neutral-800/50 transition-colors cursor-pointer',
					accent ? cn('border-l-4', accent.border) : ''
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
							<p className="text-sm text-neutral-200">{provider}</p>
						</div>
						{showEnv && (
							<div className="text-right">
								<p className="text-xs text-neutral-500 uppercase tracking-wide">Env</p>
								<p className="text-sm text-neutral-200">{envLabel}</p>
							</div>
						)}
						{showOwner && (
							<div className="text-right max-w-[180px]">
								<p className="text-xs text-neutral-500 uppercase tracking-wide">Owner</p>
								<p className="text-sm text-neutral-200 truncate" title={owner}>{owner}</p>
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
