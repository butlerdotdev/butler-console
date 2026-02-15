// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { networksApi } from '@/api/networks'
import { Card, Spinner, Button, FadeIn, StatusBadge } from '@/components/ui'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { PoolUsageBar } from '@/components/networks/PoolUsageBar'
import { IPAddressMap } from '@/components/networks/IPAddressMap'
import { useToast } from '@/hooks/useToast'
import type { NetworkPool, IPAllocation } from '@/types/networks'

export function NetworkPoolDetailPage() {
	const { namespace, name } = useParams<{ namespace: string; name: string }>()
	const navigate = useNavigate()
	const { success, error: showError } = useToast()

	useDocumentTitle(name ? `${name} - Network Pool` : 'Network Pool')

	const [pool, setPool] = useState<NetworkPool | null>(null)
	const [allocations, setAllocations] = useState<IPAllocation[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [releaseTarget, setReleaseTarget] = useState<IPAllocation | null>(null)
	const [releasing, setReleasing] = useState(false)

	const loadPool = useCallback(async () => {
		if (!namespace || !name) return
		try {
			setLoading(true)
			const data = await networksApi.getPool(namespace, name)
			setPool(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load network pool')
		} finally {
			setLoading(false)
		}
	}, [namespace, name])

	const loadAllocations = useCallback(async () => {
		if (!namespace || !name) return
		try {
			const data = await networksApi.listAllocations(namespace, name)
			setAllocations(data.allocations || [])
		} catch {
			// Silently handle
		}
	}, [namespace, name])

	useEffect(() => {
		if (namespace && name) {
			loadPool()
			loadAllocations()
		}
	}, [namespace, name, loadPool, loadAllocations])

	const handleRelease = async () => {
		if (!releaseTarget) return

		setReleasing(true)
		try {
			await networksApi.releaseAllocation(
				releaseTarget.metadata.namespace,
				releaseTarget.metadata.name
			)
			success('Allocation Released', `${releaseTarget.metadata.name} has been released`)
			setAllocations((prev) => prev.filter(
				(a) => a.metadata.uid !== releaseTarget.metadata.uid
			))
			setReleaseTarget(null)
			loadPool() // Refresh pool stats
		} catch (err) {
			showError('Release Failed', err instanceof Error ? err.message : 'Failed to release allocation')
		} finally {
			setReleasing(false)
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Spinner size="lg" />
			</div>
		)
	}

	if (error || !pool) {
		return (
			<div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
				<p className="text-red-400">{error || 'Network pool not found'}</p>
				<button
					onClick={() => navigate(-1)}
					className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
				>
					Go back
				</button>
			</div>
		)
	}

	const status = pool.status
	const totalIPs = status?.totalIPs || 0
	const allocatedIPs = status?.allocatedIPs || 0
	const availableIPs = status?.availableIPs || 0
	const fragmentation = status?.fragmentation || 0
	const largestFreeBlock = status?.largestFreeBlock || 0
	const allocationCount = status?.allocationCount || 0

	return (
		<FadeIn>
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4">
						<button
							onClick={() => navigate('/admin/networks')}
							className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
						>
							<svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<div>
							<div className="flex items-center gap-3">
								<h1 className="text-2xl font-semibold text-neutral-50">{pool.metadata.name}</h1>
								<span className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded font-mono">
									{pool.spec.cidr}
								</span>
							</div>
							<p className="text-neutral-400 mt-1">{pool.metadata.namespace}</p>
						</div>
					</div>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
					<StatCard label="Total IPs" value={totalIPs.toLocaleString()} />
					<StatCard label="Allocated" value={allocatedIPs.toLocaleString()} />
					<StatCard label="Available" value={availableIPs.toLocaleString()} />
					<StatCard
						label="Fragmentation"
						value={`${Math.round(fragmentation * 100)}%`}
					/>
					<StatCard label="Largest Free Block" value={largestFreeBlock.toLocaleString()} />
				</div>

				{/* Usage Bar */}
				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">Pool Utilization</h3>
					<PoolUsageBar allocated={allocatedIPs} total={totalIPs} />
					<p className="text-xs text-neutral-500 mt-2">
						{allocationCount} active allocation{allocationCount !== 1 ? 's' : ''}
					</p>
				</Card>

				{/* IP Address Map */}
				<Card className="p-5">
					<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Address Map</h3>
					<IPAddressMap
						cidr={pool.spec.cidr}
						reserved={pool.spec.reserved}
						allocations={allocations}
					/>
				</Card>

				{/* Allocations Table */}
				<Card className="overflow-hidden">
					<div className="px-5 py-4 border-b border-neutral-800">
						<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
							IP Allocations ({allocations.length})
						</h3>
					</div>
					{allocations.length === 0 ? (
						<div className="p-8 text-center">
							<p className="text-neutral-400">No allocations in this pool</p>
						</div>
					) : (
						<table className="w-full">
							<thead className="bg-neutral-800/50">
								<tr>
									<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Name</th>
									<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Cluster</th>
									<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Type</th>
									<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Phase</th>
									<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">IP Range</th>
									<th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Count</th>
									<th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-800">
								{allocations.map((alloc) => {
									const clusterRef = alloc.spec.tenantClusterRef
									const clusterName = clusterRef?.name || 'N/A'
									const clusterNs = clusterRef?.namespace || ''
									const phase = alloc.status?.phase || 'Pending'
									const startAddr = alloc.status?.startAddress || '-'
									const endAddr = alloc.status?.endAddress || '-'

									return (
										<tr key={alloc.metadata.uid || alloc.metadata.name} className="hover:bg-neutral-800/30">
											<td className="px-4 py-3 text-sm text-neutral-200 font-mono">{alloc.metadata.name}</td>
											<td className="px-4 py-3 text-sm">
												{clusterRef ? (
													<Link
														to={`/admin/clusters/${clusterNs}/${clusterName}`}
														className="text-green-400 hover:text-green-300"
													>
														{clusterName}
													</Link>
												) : (
													<span className="text-neutral-500">N/A</span>
												)}
											</td>
											<td className="px-4 py-3">
												<span className="px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-400 rounded capitalize">
													{alloc.spec.type || 'nodes'}
												</span>
											</td>
											<td className="px-4 py-3">
												<StatusBadge status={phase} />
											</td>
											<td className="px-4 py-3 text-sm text-neutral-400 font-mono">
												{startAddr} - {endAddr}
											</td>
											<td className="px-4 py-3 text-sm text-neutral-400">
												{alloc.spec.count || '-'}
											</td>
											<td className="px-4 py-3 text-right">
												<button
													onClick={() => setReleaseTarget(alloc)}
													className="text-xs text-neutral-500 hover:text-red-400 transition-colors"
												>
													Release
												</button>
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					)}
				</Card>

				{/* Conditions */}
				{pool.status?.conditions && pool.status.conditions.length > 0 && (
					<Card className="p-5">
						<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Conditions</h3>
						<div className="space-y-3">
							{pool.status.conditions.map((cond, i) => (
								<div key={i} className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
									<div className="flex items-center gap-3">
										<StatusBadge status={cond.status === 'True' ? 'Ready' : cond.status === 'False' ? 'Failed' : 'Pending'} />
										<span className="text-sm font-medium text-neutral-200">{cond.type}</span>
									</div>
									<div className="text-right">
										{cond.reason && <p className="text-xs text-neutral-400">{cond.reason}</p>}
										{cond.message && <p className="text-xs text-neutral-500">{cond.message}</p>}
									</div>
								</div>
							))}
						</div>
					</Card>
				)}

				{/* Pool Configuration */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Reserved Ranges */}
					<Card className="p-5">
						<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Reserved Ranges</h3>
						{(!pool.spec.reserved || pool.spec.reserved.length === 0) ? (
							<p className="text-sm text-neutral-500">No reserved ranges</p>
						) : (
							<div className="space-y-2">
								{pool.spec.reserved.map((r, i) => (
									<div key={i} className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
										<span className="text-sm text-neutral-200 font-mono">{r.cidr}</span>
										{r.description && (
											<span className="text-xs text-neutral-500">{r.description}</span>
										)}
									</div>
								))}
							</div>
						)}
					</Card>

					{/* Tenant Allocation Config */}
					<Card className="p-5">
						<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">Tenant Allocation Defaults</h3>
						{!pool.spec.tenantAllocation ? (
							<p className="text-sm text-neutral-500">No tenant allocation configuration</p>
						) : (
							<dl className="space-y-3">
								{pool.spec.tenantAllocation.start && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Start</dt>
										<dd className="text-neutral-50 font-mono">{pool.spec.tenantAllocation.start}</dd>
									</div>
								)}
								{pool.spec.tenantAllocation.end && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">End</dt>
										<dd className="text-neutral-50 font-mono">{pool.spec.tenantAllocation.end}</dd>
									</div>
								)}
								{pool.spec.tenantAllocation.defaults?.nodesPerTenant && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">Nodes per Tenant</dt>
										<dd className="text-neutral-50">{pool.spec.tenantAllocation.defaults.nodesPerTenant}</dd>
									</div>
								)}
								{pool.spec.tenantAllocation.defaults?.lbPoolPerTenant && (
									<div className="flex justify-between">
										<dt className="text-neutral-400">LB Pool per Tenant</dt>
										<dd className="text-neutral-50">{pool.spec.tenantAllocation.defaults.lbPoolPerTenant}</dd>
									</div>
								)}
							</dl>
						)}
					</Card>
				</div>
			</div>

			{/* Release Confirmation Modal */}
			<Modal isOpen={!!releaseTarget} onClose={() => !releasing && setReleaseTarget(null)}>
				<ModalHeader>
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
							<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</div>
						<div>
							<h2 className="text-lg font-semibold text-neutral-100">Release Allocation</h2>
							<p className="text-sm text-neutral-400">Return IPs to the pool</p>
						</div>
					</div>
				</ModalHeader>
				<ModalBody>
					<p className="text-neutral-300">
						Are you sure you want to release allocation{' '}
						<span className="font-mono font-semibold text-red-400">{releaseTarget?.metadata.name}</span>?
					</p>
					<p className="text-sm text-neutral-500 mt-2">
						The IP addresses will be returned to the pool and can be re-allocated.
					</p>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={() => setReleaseTarget(null)} disabled={releasing}>
						Cancel
					</Button>
					<Button variant="danger" onClick={handleRelease} disabled={releasing}>
						{releasing ? 'Releasing...' : 'Release Allocation'}
					</Button>
				</ModalFooter>
			</Modal>
		</FadeIn>
	)
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<Card className="p-4">
			<p className="text-xs text-neutral-500 uppercase tracking-wide">{label}</p>
			<p className="text-2xl font-semibold text-neutral-50 mt-1">{value}</p>
		</Card>
	)
}
