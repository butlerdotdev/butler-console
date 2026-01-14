// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useTeamContext } from '@/hooks/useTeamContext'
import { clustersApi, type Cluster } from '@/api'
import { Card, StatusBadge, Spinner, FadeIn } from '@/components/ui'

interface ManagementClusterInfo {
	kubernetesVersion: string
	phase: string
	nodes: { ready: number; total: number }
	tenantClusters: number
}

type SortField = 'name' | 'namespace' | 'phase' | 'workers' | 'createdAt'
type SortDirection = 'asc' | 'desc'

export function AdminClustersPage() {
	useDocumentTitle('All Clusters')
	const { buildPath } = useTeamContext()

	const [management, setManagement] = useState<ManagementClusterInfo | null>(null)
	const [clusters, setClusters] = useState<Cluster[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [teamFilter, setTeamFilter] = useState<string>('')
	const [statusFilter, setStatusFilter] = useState<string>('')
	// Sort state - setters will be used when sorting UI is implemented
	const [sortField] = useState<SortField>('createdAt')
	const [sortDirection] = useState<SortDirection>('desc')

	useEffect(() => {
		async function fetchClusters() {
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

		fetchClusters()
	}, [])

	// Get unique namespaces for filter dropdown
	const namespaces = useMemo(() => {
		const unique = [...new Set(clusters.map((c) => c.metadata.namespace))]
		return unique.sort()
	}, [clusters])

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
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">All Clusters</h1>
					<p className="text-neutral-400 mt-1">
						View and manage clusters across all teams
					</p>
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

				{/* Results Count */}
				<p className="text-sm text-neutral-500">
					Showing {filteredClusters.length} of {totalCount} clusters
				</p>

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
				<div className="space-y-3">
					{filteredClusters.map((cluster) => (
						<Link
							key={`${cluster.metadata.namespace}/${cluster.metadata.name}`}
							to={buildPath(`/clusters/${cluster.metadata.namespace}/${cluster.metadata.name}`)}
						>
							<Card className="p-5 hover:bg-neutral-800/50 transition-colors cursor-pointer">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-4">
										<div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
											<svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
											</svg>
										</div>
										<div>
											<p className="font-medium text-neutral-50">{cluster.metadata.name}</p>
											<p className="text-sm text-neutral-400">{cluster.metadata.namespace}</p>
										</div>
									</div>
									<div className="flex items-center gap-8">
										<div className="text-right">
											<p className="text-xs text-neutral-500 uppercase tracking-wide">Provider</p>
											<p className="text-sm text-neutral-200">{cluster.spec.providerConfigRef?.name || 'Default'}</p>
										</div>
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
					))}

					{filteredClusters.length === 0 && !management && (
						<Card className="p-8 text-center">
							<p className="text-neutral-400">No clusters found</p>
						</Card>
					)}
				</div>
			</div>
		</FadeIn>
	)
}
