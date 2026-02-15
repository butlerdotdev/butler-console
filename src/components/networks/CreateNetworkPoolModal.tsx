// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button, Input } from '@/components/ui'
import { networksApi } from '@/api/networks'
import { useToast } from '@/hooks/useToast'
import type { CreateNetworkPoolRequest } from '@/types/networks'

interface CreateNetworkPoolModalProps {
	isOpen: boolean
	onClose: () => void
	onCreated: () => void
}

export function CreateNetworkPoolModal({ isOpen, onClose, onCreated }: CreateNetworkPoolModalProps) {
	const { success, error: showError } = useToast()
	const [creating, setCreating] = useState(false)

	const [name, setName] = useState('')
	const [namespace, setNamespace] = useState('butler-system')
	const [cidr, setCidr] = useState('')
	const [reserved, setReserved] = useState<Array<{ cidr: string; description: string }>>([])
	const [allocStart, setAllocStart] = useState('')
	const [allocEnd, setAllocEnd] = useState('')
	const [nodesPerTenant, setNodesPerTenant] = useState('')
	const [lbPoolPerTenant, setLbPoolPerTenant] = useState('')

	const resetForm = () => {
		setName('')
		setNamespace('butler-system')
		setCidr('')
		setReserved([])
		setAllocStart('')
		setAllocEnd('')
		setNodesPerTenant('')
		setLbPoolPerTenant('')
	}

	const handleClose = () => {
		if (!creating) {
			resetForm()
			onClose()
		}
	}

	const handleSubmit = async () => {
		if (!name || !cidr) return

		setCreating(true)
		try {
			const req: CreateNetworkPoolRequest = {
				name,
				namespace,
				cidr,
			}

			if (reserved.length > 0) {
				req.reserved = reserved.filter(r => r.cidr)
			}

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
			}

			await networksApi.createPool(req)
			success('Network Pool Created', `${name} has been created`)
			resetForm()
			onCreated()
		} catch (err) {
			showError('Create Failed', err instanceof Error ? err.message : 'Failed to create network pool')
		} finally {
			setCreating(false)
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
				<h2 className="text-lg font-semibold text-neutral-100">Create Network Pool</h2>
				<p className="text-sm text-neutral-400 mt-1">Define an IP address pool for tenant cluster networking</p>
			</ModalHeader>
			<ModalBody>
				<div className="space-y-5">
					{/* Basic fields */}
					<div className="grid grid-cols-2 gap-4">
						<Input
							label="Name"
							id="pool-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="production-pool"
						/>
						<Input
							label="Namespace"
							id="pool-namespace"
							value={namespace}
							onChange={(e) => setNamespace(e.target.value)}
							placeholder="butler-system"
						/>
					</div>

					<Input
						label="CIDR"
						id="pool-cidr"
						value={cidr}
						onChange={(e) => setCidr(e.target.value)}
						placeholder="10.40.0.0/16"
					/>

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
								id="alloc-start"
								value={allocStart}
								onChange={(e) => setAllocStart(e.target.value)}
								placeholder="10.40.1.0"
							/>
							<Input
								label="End IP"
								id="alloc-end"
								value={allocEnd}
								onChange={(e) => setAllocEnd(e.target.value)}
								placeholder="10.40.255.254"
							/>
							<Input
								label="Nodes per Tenant"
								id="nodes-per-tenant"
								type="number"
								value={nodesPerTenant}
								onChange={(e) => setNodesPerTenant(e.target.value)}
								placeholder="3"
							/>
							<Input
								label="LB Pool per Tenant"
								id="lb-pool-per-tenant"
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
				<Button variant="secondary" onClick={handleClose} disabled={creating}>
					Cancel
				</Button>
				<Button onClick={handleSubmit} disabled={creating || !name || !cidr}>
					{creating ? 'Creating...' : 'Create Pool'}
				</Button>
			</ModalFooter>
		</Modal>
	)
}
