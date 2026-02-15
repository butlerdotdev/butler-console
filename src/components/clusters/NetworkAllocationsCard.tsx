// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, StatusBadge } from '@/components/ui'
import { networksApi } from '@/api/networks'
import type { IPAllocation } from '@/types/networks'

interface NetworkAllocationsCardProps {
	clusterName: string
	clusterNamespace: string
}

export function NetworkAllocationsCard({ clusterName, clusterNamespace }: NetworkAllocationsCardProps) {
	const [allocations, setAllocations] = useState<IPAllocation[]>([])
	const [loaded, setLoaded] = useState(false)

	useEffect(() => {
		const load = async () => {
			try {
				const data = await networksApi.listAllAllocations()
				const filtered = (data.allocations || []).filter(
					(a) => a.spec.tenantClusterRef?.name === clusterName &&
						a.spec.tenantClusterRef?.namespace === clusterNamespace
				)
				setAllocations(filtered)
			} catch {
				// Silently handle - card is optional
			} finally {
				setLoaded(true)
			}
		}
		load()
	}, [clusterName, clusterNamespace])

	if (!loaded || allocations.length === 0) return null

	return (
		<Card className="p-5">
			<h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-4">
				Network Allocations
			</h3>
			<div className="space-y-3">
				{allocations.map((alloc) => {
					const phase = alloc.status?.phase || 'Pending'
					const startAddr = alloc.status?.startAddress || '-'
					const endAddr = alloc.status?.endAddress || '-'
					const poolName = alloc.spec.poolRef?.name || 'N/A'
					const poolNs = alloc.spec.poolRef?.namespace || alloc.metadata.namespace

					return (
						<div key={alloc.metadata.uid || alloc.metadata.name} className="flex items-center justify-between py-2 border-b border-neutral-800 last:border-0">
							<div className="flex items-center gap-3">
								<span className="px-2 py-0.5 text-xs font-medium bg-purple-500/10 text-purple-400 rounded capitalize">
									{alloc.spec.type || 'nodes'}
								</span>
								<span className="text-sm text-neutral-200 font-mono">
									{startAddr} - {endAddr}
								</span>
							</div>
							<div className="flex items-center gap-3">
								<Link
									to={`/admin/networks/${poolNs}/${poolName}`}
									className="text-xs text-blue-400 hover:text-blue-300"
								>
									{poolName}
								</Link>
								<StatusBadge status={phase} />
							</div>
						</div>
					)
				})}
			</div>
		</Card>
	)
}
