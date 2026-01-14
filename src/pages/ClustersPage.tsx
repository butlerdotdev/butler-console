// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useDocumentTitle } from '@/hooks'
import { clustersApi, type Cluster } from '@/api'
import { Card, Spinner, StatusBadge, FadeIn, Button } from '@/components/ui'

interface ManagementClusterInfo {
	kubernetesVersion: string
	phase: string
	nodes: { ready: number; total: number }
	tenantClusters: number
}

export function ClustersPage() {
	const { currentTeam, currentTeamDisplayName, buildPath, isAdminMode } = useTeamContext()
	useDocumentTitle(currentTeamDisplayName ? `${currentTeamDisplayName} Clusters` : 'Clusters')

	const [management, setManagement] = useState<ManagementClusterInfo | null>(null)
	const [clusters, setClusters] = useState<Cluster[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const loadClusters = useCallback(async () => {
		try {
			setLoading(true)
			setError(null)

			// Fetch management cluster and tenant clusters
			// Pass team to filter clusters when in team context
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

	// Show management cluster only in admin mode
	const showManagement = management && isAdminMode

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
						<p className="text-neutral-400 mt-1">Manage your Kubernetes clusters</p>
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

				<div className="grid gap-4">
					{/* Management Cluster - Admin only */}
					{showManagement && <ManagementClusterCard info={management} />}

					{/* Tenant Clusters */}
					{clusters.map((cluster) => (
						<ClusterCard
							key={cluster.metadata.uid || `${cluster.metadata.namespace}/${cluster.metadata.name}`}
							cluster={cluster}
							buildPath={buildPath}
						/>
					))}

					{clusters.length === 0 && !showManagement && (
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
				</div>
			</div>
		</FadeIn>
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
	buildPath
}: {
	cluster: Cluster
	buildPath: (path: string) => string
}) {
	const name = cluster.metadata.name
	const namespace = cluster.metadata.namespace
	const phase = cluster.status?.phase || 'Unknown'
	const version = cluster.spec.kubernetesVersion || 'Unknown'
	const workers = cluster.spec.workers?.replicas || 0
	const provider = cluster.spec.providerConfigRef?.name || 'Default'

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

	// Link to cluster detail - include namespace in path
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
