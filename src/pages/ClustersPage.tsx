// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { clustersApi, type ManagementClusterInfo } from '@/api'
import { Card, Spinner, StatusBadge, EmptyState, FadeIn, Button } from '@/components/ui'
import type { TenantCluster, ClusterPhase } from '@/types'

export function ClustersPage() {
	useDocumentTitle('Clusters')

	const [management, setManagement] = useState<ManagementClusterInfo | null>(null)
	const [clusters, setClusters] = useState<TenantCluster[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		loadClusters()
	}, [])

	const loadClusters = async () => {
		try {
			setLoading(true)
			const [mgmt, tenantsResponse] = await Promise.all([
				clustersApi.getManagement(),
				clustersApi.list()
			])
			setManagement(mgmt)
			setClusters(tenantsResponse.clusters || [])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load clusters')
		} finally {
			setLoading(false)
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	if (error) {
		return (
			<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
				<p className="text-red-400">{error}</p>
				<button
					onClick={loadClusters}
					className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
				>
					Retry
				</button>
			</div>
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
					<Link to="/clusters/create">
						<Button>
							<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
							</svg>
							Create Cluster
						</Button>
					</Link>
				</div>

				<div className="grid gap-4">
					{/* Management Cluster - Always First */}
					{management && <ManagementClusterCard info={management} />}

					{/* Tenant Clusters */}
					{clusters.map((cluster) => (
						<ClusterCard key={cluster.metadata.uid || cluster.metadata.name} cluster={cluster} />
					))}

					{clusters.length === 0 && (
						<Card className="p-6 text-center">
							<p className="text-neutral-400">No tenant clusters yet</p>
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
			<Card className="p-5 hover:bg-neutral-800/50 transition-colors cursor-pointer border-blue-500/20">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
							<svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
							</svg>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<p className="font-medium text-neutral-50">Management Cluster</p>
								<span className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded">
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

function ClusterCard({ cluster }: { cluster: TenantCluster }) {
	const name = cluster.metadata.name
	const namespace = cluster.metadata.namespace
	const phase = (cluster.status?.phase || 'Unknown') as ClusterPhase
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

	return (
		<Link to={`/clusters/${namespace}/${name}`}>
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
