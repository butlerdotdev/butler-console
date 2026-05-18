// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { useToast } from '@/hooks/useToast'
import { policiesApi, type ClusterCreationPolicy } from '@/api/policies'
import { Card, Button, FadeIn, Spinner } from '@/components/ui'

function scopeLabel(p: ClusterCreationPolicy): string {
	const s = p.spec.scope
	if (s.teamAndEnvironment) return `team/${s.teamAndEnvironment.teamRef.name}/${s.teamAndEnvironment.environmentName}`
	if (s.team) return `team/${s.team.teamRef.name}`
	if (s.clusterWide) return 'cluster-wide'
	return '(invalid)'
}

function optionTypesLabel(p: ClusterCreationPolicy): string {
	const opts = p.spec.options || {}
	const keys = Object.keys(opts)
	return keys.length ? keys.join(', ') : '(none)'
}

function providersLabel(p: ClusterCreationPolicy): string {
	const tp = p.spec.targetProviders || []
	return tp.length ? tp.join(', ') : 'all'
}

export function PoliciesListPage() {
	useDocumentTitle('Cluster Creation Policies')
	const navigate = useNavigate()
	const toast = useToast()
	const [policies, setPolicies] = useState<ClusterCreationPolicy[]>([])
	const [loading, setLoading] = useState(true)

	async function load() {
		setLoading(true)
		try {
			const resp = await policiesApi.list()
			setPolicies(resp.policies || [])
		} catch (err) {
			toast.error('Failed to load policies', String(err))
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		void load()
	}, [])

	return (
		<FadeIn>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Cluster Creation Policies</h1>
						<p className="text-sm text-neutral-400 mt-1">
							Admin-curated defaults, pins, allow-lists, and recommendations for the create-cluster modal (ADR-018).
						</p>
					</div>
					<Button onClick={() => navigate('/admin/policies/new')}>New Policy</Button>
				</div>

				{loading ? (
					<div className="flex items-center justify-center h-32">
						<Spinner size="lg" />
					</div>
				) : policies.length === 0 ? (
					<Card className="p-8 text-center">
						<p className="text-neutral-400">No policies defined yet.</p>
						<p className="text-sm text-neutral-500 mt-2">
							Policies curate the create-cluster modal dropdowns. UI, GitOps, and kubectl all author the same resource.
						</p>
						<Button className="mt-4" onClick={() => navigate('/admin/policies/new')}>
							Create first policy
						</Button>
					</Card>
				) : (
					<Card className="overflow-hidden">
						<table className="w-full">
							<thead className="bg-neutral-800/50">
								<tr>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Name</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Scope</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Providers</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Option types</th>
									<th className="px-5 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Age</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-800">
								{policies.map(p => (
									<tr key={p.metadata.name} className="hover:bg-neutral-800/30">
										<td className="px-5 py-4">
											<Link to={`/admin/policies/${encodeURIComponent(p.metadata.name)}`} className="text-violet-400 hover:text-violet-300 font-mono text-sm">
												{p.metadata.name}
											</Link>
										</td>
										<td className="px-5 py-4 text-sm text-neutral-300 font-mono">{scopeLabel(p)}</td>
										<td className="px-5 py-4 text-sm text-neutral-300 font-mono">{providersLabel(p)}</td>
										<td className="px-5 py-4 text-sm text-neutral-300 font-mono">{optionTypesLabel(p)}</td>
										<td className="px-5 py-4 text-right text-xs text-neutral-500">{p.metadata.creationTimestamp || ''}</td>
									</tr>
								))}
							</tbody>
						</table>
					</Card>
				)}
			</div>
		</FadeIn>
	)
}
