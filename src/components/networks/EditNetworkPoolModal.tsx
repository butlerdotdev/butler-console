// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button, Input } from '@/components/ui'
import { networksApi } from '@/api/networks'
import { useToast } from '@/hooks/useToast'
import type { NetworkPool, UpdateNetworkPoolRequest } from '@/types/networks'

interface EditNetworkPoolModalProps {
	isOpen: boolean
	onClose: () => void
	onUpdated: () => void
	pool: NetworkPool
}

export function EditNetworkPoolModal({ isOpen, onClose, onUpdated, pool }: EditNetworkPoolModalProps) {
	const { success, error: showError } = useToast()
	const [saving, setSaving] = useState(false)

	const [reserved, setReserved] = useState<Array<{ cidr: string; description: string }>>([])
	const [allocStart, setAllocStart] = useState('')
	const [allocEnd, setAllocEnd] = useState('')
	const [nodesPerTenant, setNodesPerTenant] = useState('')
	const [lbPoolPerTenant, setLbPoolPerTenant] = useState('')

	// Initialize form from pool data when modal opens
	useEffect(() => {
		if (isOpen && pool) {
			setReserved(
				pool.spec.reserved?.map(r => ({ cidr: r.cidr, description: r.description || '' })) || []
			)
			setAllocStart(pool.spec.tenantAllocation?.start || '')
			setAllocEnd(pool.spec.tenantAllocation?.end || '')
			setNodesPerTenant(
				pool.spec.tenantAllocation?.defaults?.nodesPerTenant?.toString() || ''
			)
			setLbPoolPerTenant(
				pool.spec.tenantAllocation?.defaults?.lbPoolPerTenant?.toString() || ''
			)
		}
	}, [isOpen, pool])

	const handleClose = () => {
		if (!saving) {
			onClose()
		}
	}

	const handleSubmit = async () => {
		setSaving(true)
		try {
			const req: UpdateNetworkPoolRequest = {}

			// Always send reserved (empty array clears them)
			req.reserved = reserved.filter(r => r.cidr)

			const hasTenantAlloc = allocStart || allocEnd || nodesPerTenant || lbPoolPerTenant
			if (hasTenantAlloc) {
				req.tenantAllocation = {}
				if (allocStart) req.tenantAllocation.start = allocStart
				if (allocEnd) req.tenantAllocation.end = allocEnd
				if (nodesPerTenant || lbPoolPerTenant) {
					req.tenantAllocation.defaults = {}
					if (nodesPerTenant) req.tenantAllocation.defaults.nodesPerTenant = parseInt(nodesPerTenant)
					if (lbPoolPerTenant) req.tenantAllocation.defaults.lbPoolPerTenant = parseInt(lbPoolPerTenant)
				}
			} else {
				// Clear tenant allocation by sending empty object
				req.tenantAllocation = {}
			}

			await networksApi.updatePool(pool.metadata.namespace, pool.metadata.name, req)
			success('Network Pool Updated', `${pool.metadata.name} has been updated`)
			onUpdated()
		} catch (err) {
			showError('Update Failed', err instanceof Error ? err.message : 'Failed to update network pool')
		} finally {
			setSaving(false)
		}
	}

	const addReserved = () => {
		setReserved([...reserved, { cidr: '', description: '' }])
	}

	const updateReserved = (index: number, field: 'cidr' | 'description', value: string) => {
		const updated = [...reserved]
		updated[index] = { ...updated[index], [field]: value }
		setReserved(updated)
	}

	const removeReserved = (index: number) => {
		setReserved(reserved.filter((_, i) => i !== index))
	}

	return (
		<Modal isOpen={isOpen} onClose={handleClose} size="lg">
			<ModalHeader>
				<h2 className="text-lg font-semibold text-neutral-100">Edit Network Pool</h2>
				<p className="text-sm text-neutral-400 mt-1">
					Update reserved ranges and tenant allocation for{' '}
					<span className="font-mono text-neutral-300">{pool.metadata.name}</span>
				</p>
			</ModalHeader>
			<ModalBody>
				<div className="space-y-5">
					{/* Read-only info */}
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">Name</label>
							<p className="text-sm text-neutral-300 font-mono bg-neutral-800/50 px-3 py-2 rounded-lg border border-neutral-700/50">
								{pool.metadata.name}
							</p>
						</div>
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">CIDR</label>
							<p className="text-sm text-neutral-300 font-mono bg-neutral-800/50 px-3 py-2 rounded-lg border border-neutral-700/50">
								{pool.spec.cidr}
							</p>
						</div>
					</div>

					{/* Reserved Ranges */}
					<div>
						<div className="flex items-center justify-between mb-2">
							<label className="block text-sm font-medium text-neutral-300">Reserved Ranges</label>
							<button
								type="button"
								onClick={addReserved}
								className="text-xs text-green-400 hover:text-green-300"
							>
								+ Add Range
							</button>
						</div>
						{reserved.length === 0 ? (
							<p className="text-sm text-neutral-500">No reserved ranges</p>
						) : (
							<div className="space-y-2">
								{reserved.map((r, i) => (
									<div key={i} className="flex items-center gap-2">
										<input
											value={r.cidr}
											onChange={(e) => updateReserved(i, 'cidr', e.target.value)}
											placeholder="10.40.0.0/24"
											className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500"
										/>
										<input
											value={r.description}
											onChange={(e) => updateReserved(i, 'description', e.target.value)}
											placeholder="Description"
											className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 text-sm placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500"
										/>
										<button
											type="button"
											onClick={() => removeReserved(i)}
											className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
										>
											<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Tenant Allocation */}
					<div>
						<label className="block text-sm font-medium text-neutral-300 mb-2">Tenant Allocation</label>
						<div className="grid grid-cols-2 gap-4">
							<Input
								label="Start IP"
								id="edit-alloc-start"
								value={allocStart}
								onChange={(e) => setAllocStart(e.target.value)}
								placeholder="10.40.1.0"
							/>
							<Input
								label="End IP"
								id="edit-alloc-end"
								value={allocEnd}
								onChange={(e) => setAllocEnd(e.target.value)}
								placeholder="10.40.255.254"
							/>
							<Input
								label="Nodes per Tenant"
								id="edit-nodes-per-tenant"
								type="number"
								value={nodesPerTenant}
								onChange={(e) => setNodesPerTenant(e.target.value)}
								placeholder="3"
							/>
							<Input
								label="LB Pool per Tenant"
								id="edit-lb-pool-per-tenant"
								type="number"
								value={lbPoolPerTenant}
								onChange={(e) => setLbPoolPerTenant(e.target.value)}
								placeholder="5"
							/>
						</div>
					</div>
				</div>
			</ModalBody>
			<ModalFooter>
				<Button variant="secondary" onClick={handleClose} disabled={saving}>
					Cancel
				</Button>
				<Button onClick={handleSubmit} disabled={saving}>
					{saving ? 'Saving...' : 'Save Changes'}
				</Button>
			</ModalFooter>
		</Modal>
	)
}
