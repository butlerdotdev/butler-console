// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks'
import { networksApi } from '@/api/networks'
import { Card, Spinner, Button, FadeIn } from '@/components/ui'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { CreateNetworkPoolModal } from '@/components/networks/CreateNetworkPoolModal'
import { computePoolLayout } from '@/components/networks/NetworkLayoutBar'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils'
import { parseCIDR } from '@/lib/ip-math'
import type { NetworkPool } from '@/types/networks'

export function NetworkPoolsPage() {
	useDocumentTitle('Network Pools')
	const { success, error: showError } = useToast()

	const [pools, setPools] = useState<NetworkPool[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [showCreateModal, setShowCreateModal] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<NetworkPool | null>(null)
	const [deleting, setDeleting] = useState(false)

	useEffect(() => {
		loadPools()
	}, [])

	const loadPools = async () => {
		try {
			setLoading(true)
			const response = await networksApi.listPools()
			setPools(response.pools || [])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load network pools')
		} finally {
			setLoading(false)
		}
	}

	const handleDelete = async () => {
		if (!deleteTarget) return

		setDeleting(true)
		try {
			await networksApi.deletePool(deleteTarget.metadata.namespace, deleteTarget.metadata.name)
			success('Pool Deleted', `${deleteTarget.metadata.name} has been deleted`)
			setPools((prev) => prev.filter(
				(p) => p.metadata.uid !== deleteTarget.metadata.uid
			))
			setDeleteTarget(null)
		} catch (err) {
			showError('Delete Failed', err instanceof Error ? err.message : 'Failed to delete pool')
		} finally {
			setDeleting(false)
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
				<button onClick={loadPools} className="mt-2 text-sm text-red-400 hover:text-red-300 underline">
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
						<h1 className="text-2xl font-semibold text-neutral-50">Network Pools</h1>
						<p className="text-neutral-400 mt-1">IP address pools for tenant cluster IPAM</p>
					</div>
					<Button onClick={() => setShowCreateModal(true)}>
						<svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
						</svg>
						Create Pool
					</Button>
				</div>

				{pools.length === 0 ? (
					<Card className="p-8 text-center">
						<div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
							<NetworkPoolIcon className="w-6 h-6 text-neutral-500" />
						</div>
						<h3 className="text-lg font-medium text-neutral-200 mb-2">No Network Pools</h3>
						<p className="text-neutral-400 mb-4">Create your first IP address pool for tenant cluster networking.</p>
						<Button onClick={() => setShowCreateModal(true)}>Create Pool</Button>
					</Card>
				) : (
					<div className="grid gap-4">
						{pools.map((pool) => (
							<PoolCard
								key={pool.metadata.uid || `${pool.metadata.namespace}/${pool.metadata.name}`}
								pool={pool}
								onDelete={(e) => { e.stopPropagation(); setDeleteTarget(pool) }}
							/>
						))}
					</div>
				)}
			</div>

			{/* Create Modal */}
			<CreateNetworkPoolModal
				isOpen={showCreateModal}
				onClose={() => setShowCreateModal(false)}
				onCreated={() => { setShowCreateModal(false); loadPools() }}
			/>

			{/* Delete Confirmation Modal */}
			<Modal isOpen={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
				<ModalHeader>
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
							<svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</div>
						<div>
							<h2 className="text-lg font-semibold text-neutral-100">Delete Network Pool</h2>
							<p className="text-sm text-neutral-400">This action cannot be undone</p>
						</div>
					</div>
				</ModalHeader>
				<ModalBody>
					<p className="text-neutral-300">
						Are you sure you want to delete network pool{' '}
						<span className="font-mono font-semibold text-red-400">{deleteTarget?.metadata.name}</span>?
					</p>
					<p className="text-sm text-neutral-500 mt-2">
						This pool cannot be deleted if it has active IP allocations.
					</p>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
						Cancel
					</Button>
					<Button variant="danger" onClick={handleDelete} disabled={deleting}>
						{deleting ? 'Deleting...' : 'Delete Pool'}
					</Button>
				</ModalFooter>
			</Modal>
		</FadeIn>
	)
}

interface PoolCardProps {
	pool: NetworkPool
	onDelete: (e: React.MouseEvent) => void
}

const MINI_BAR_COLORS: Record<string, string> = {
	gateway: 'bg-cyan-500/30',
	reserved: 'bg-neutral-600/60',
	'tenant-allocated': 'bg-amber-500/50',
	'tenant-available': 'bg-emerald-500/50',
	unassigned: 'bg-neutral-800/60',
}

function PoolCard({ pool, onDelete }: PoolCardProps) {
	const { name, namespace, creationTimestamp } = pool.metadata
	const { cidr } = pool.spec
	const status = pool.status
	const tenantTotalIPs = status?.totalIPs || 0
	const allocatedIPs = status?.allocatedIPs || 0
	const allocationCount = status?.allocationCount || 0
	const pct = tenantTotalIPs > 0 ? Math.round((allocatedIPs / tenantTotalIPs) * 100) : 0
	const poolSize = parseCIDR(cidr).size

	const segments = useMemo(
		() => computePoolLayout(pool, allocatedIPs),
		[pool, allocatedIPs],
	)

	// Summarize segment sizes by kind for the legend
	const summary = useMemo(() => {
		const counts: Record<string, number> = {}
		for (const s of segments) {
			counts[s.kind] = (counts[s.kind] || 0) + s.size
		}
		return counts
	}, [segments])

	const reservedTotal = summary['reserved'] || 0
	const tenantAllocated = summary['tenant-allocated'] || 0
	const tenantAvailable = summary['tenant-available'] || 0
	const unassigned = summary['unassigned'] || 0

	const age = creationTimestamp
		? new Date(creationTimestamp).toLocaleDateString()
		: 'Unknown'

	return (
		<Link to={`/admin/networks/${namespace}/${name}`}>
			<Card className="p-5 cursor-pointer hover:bg-neutral-800/50 transition-colors space-y-3">
				{/* Top row: name, badge, meta, actions */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4 min-w-0">
						<div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
							<NetworkPoolIcon className="w-6 h-6 text-blue-400" />
						</div>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<p className="font-medium text-neutral-50">{name}</p>
								<span className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded font-mono">
									{cidr}
								</span>
								{pct >= 90 && (
									<span className="px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-400 rounded">
										Critical
									</span>
								)}
								{pct >= 80 && pct < 90 && (
									<span className="px-2 py-0.5 text-xs font-medium bg-amber-500/10 text-amber-400 rounded">
										Warning
									</span>
								)}
							</div>
							<p className="text-sm text-neutral-400">{namespace}</p>
						</div>
					</div>

					<div className="flex items-center gap-6">
						<div className="text-right hidden md:block">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Allocations</p>
							<p className="text-sm text-neutral-200">{allocationCount}</p>
						</div>
						<div className="text-right">
							<p className="text-xs text-neutral-500 uppercase tracking-wide">Age</p>
							<p className="text-sm text-neutral-200">{age}</p>
						</div>
						<button
							onClick={onDelete}
							className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
							title="Delete pool"
						>
							<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					</div>
				</div>

				{/* Layout bar */}
				<div className="h-3 bg-neutral-800 rounded-full overflow-hidden flex">
					{segments.map((seg, i) => {
						const widthPct = poolSize > 0 ? (seg.size / poolSize) * 100 : 0
						if (widthPct < 0.1) return null
						return (
							<div
								key={i}
								className={cn('h-full', MINI_BAR_COLORS[seg.kind])}
								style={{ width: `${widthPct}%` }}
							/>
						)
					})}
				</div>

				{/* Legend line */}
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
					<span className="text-neutral-400">
						{poolSize.toLocaleString()} IPs
					</span>
					{reservedTotal > 0 && (
						<span className="text-neutral-400">
							<span className="inline-block w-2 h-2 rounded-sm bg-neutral-600/60 mr-1 align-middle" />
							{reservedTotal} Reserved
						</span>
					)}
					{tenantTotalIPs > 0 && (
						<span className="text-neutral-400">
							<span className="inline-block w-2 h-2 rounded-sm bg-amber-500/50 mr-1 align-middle" />
							{tenantAllocated} of {tenantTotalIPs} Tenant Used
						</span>
					)}
					{tenantAvailable > 0 && (
						<span className="text-neutral-400">
							<span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/50 mr-1 align-middle" />
							{tenantAvailable} Tenant Free
						</span>
					)}
					{unassigned > 0 && (
						<span className="text-neutral-500">
							{unassigned} Unassigned
						</span>
					)}
				</div>
			</Card>
		</Link>
	)
}

function NetworkPoolIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
			/>
		</svg>
	)
}
