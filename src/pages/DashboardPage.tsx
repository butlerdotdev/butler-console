// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { clustersApi, type Cluster } from '@/api'
import { Card, Spinner, StatusBadge, FadeIn } from '@/components/ui'

export function DashboardPage() {
	useDocumentTitle('Dashboard')

	const [clusters, setClusters] = useState<Cluster[]>([])
	const [managementReady, setManagementReady] = useState(false)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		loadData()
	}, [])

	const loadData = async () => {
		try {
			setLoading(true)
			const [clustersResponse, mgmt] = await Promise.all([
				clustersApi.list(),
				clustersApi.getManagement()
			])
			setClusters(clustersResponse.clusters || [])
			setManagementReady(mgmt.phase === 'Ready')
		} catch {
			// Failed to load data
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

	const totalClusters = clusters.length + 1
	const readyClusters = clusters.filter(c => c.status?.phase === 'Ready').length + (managementReady ? 1 : 0)
	const provisioningClusters = clusters.filter(c =>
		c.status?.phase === 'Provisioning' || c.status?.phase === 'Pending'
	).length
	const failedClusters = clusters.filter(c => c.status?.phase === 'Failed').length

	return (
		<FadeIn>
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">Dashboard</h1>
					<p className="text-neutral-400 mt-1">Overview of your Kubernetes clusters</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<Card className="p-5">
						<p className="text-sm text-neutral-400">Total Clusters</p>
						<p className="text-3xl font-semibold text-neutral-50 mt-1">{totalClusters}</p>
					</Card>
					<Card className="p-5">
						<p className="text-sm text-neutral-400">Ready</p>
						<p className="text-3xl font-semibold text-green-500 mt-1">{readyClusters}</p>
					</Card>
					<Card className="p-5">
						<p className="text-sm text-neutral-400">Provisioning</p>
						<p className="text-3xl font-semibold text-yellow-500 mt-1">{provisioningClusters}</p>
					</Card>
					<Card className="p-5">
						<p className="text-sm text-neutral-400">Failed</p>
						<p className="text-3xl font-semibold text-red-500 mt-1">{failedClusters}</p>
					</Card>
				</div>

				<div>
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-medium text-neutral-50">Recent Clusters</h2>
						<Link to="/clusters" className="text-sm text-green-500 hover:text-green-400">
							View all →
						</Link>
					</div>
					<div className="space-y-3">
						{clusters.slice(0, 5).map((cluster) => (
							<ClusterRow key={cluster.metadata.uid || cluster.metadata.name} cluster={cluster} />
						))}
					</div>
				</div>
			</div>
		</FadeIn>
	)
}

function ClusterRow({ cluster }: { cluster: Cluster }) {
	const name = cluster.metadata.name
	const namespace = cluster.metadata.namespace
	const phase = cluster.status?.phase || 'Unknown'
	const version = cluster.spec.kubernetesVersion || 'Unknown'
	const workers = cluster.spec.workers?.replicas || 0

	return (
		<Link to={`/clusters/${namespace}/${name}`}>
			<Card className="p-4 hover:bg-neutral-800/50 transition-colors cursor-pointer">
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium text-neutral-50">{name}</p>
						<p className="text-sm text-neutral-400">{namespace}</p>
					</div>
					<div className="flex items-center gap-6">
						<div className="text-right">
							<p className="text-xs text-neutral-500">Version</p>
							<p className="text-sm text-neutral-200">{version}</p>
						</div>
						<div className="text-right">
							<p className="text-xs text-neutral-500">Workers</p>
							<p className="text-sm text-neutral-200">{workers}</p>
						</div>
						<StatusBadge status={phase} />
					</div>
				</div>
			</Card>
		</Link>
	)
}
