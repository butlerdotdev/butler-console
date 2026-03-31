// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect } from 'react'
import { ApiError } from '@/api/client'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui'
import { clustersApi, type Cluster, type UpdateClusterRequest, type FieldError } from '@/api'

interface EditClusterModalProps {
	isOpen: boolean
	onClose: () => void
	onSaved: () => void
	cluster: Cluster
	isAdmin: boolean
}

interface FormState {
	kubernetesVersion: string
	cpReplicas: number
	workerReplicas: number
	workerCPU: number
	workerMemory: string
	workerDiskSize: string
}

function formFromCluster(cluster: Cluster): FormState {
	return {
		kubernetesVersion: cluster.spec.kubernetesVersion || '',
		cpReplicas: cluster.spec.controlPlane?.replicas ?? 1,
		workerReplicas: cluster.spec.workers?.replicas ?? 1,
		workerCPU: cluster.spec.workers?.machineTemplate?.cpu ?? 4,
		workerMemory: cluster.spec.workers?.machineTemplate?.memory ?? '16Gi',
		workerDiskSize: cluster.spec.workers?.machineTemplate?.diskSize ?? '100Gi',
	}
}

function hasChanges(form: FormState, original: FormState): boolean {
	return (
		form.kubernetesVersion !== original.kubernetesVersion ||
		form.cpReplicas !== original.cpReplicas ||
		form.workerReplicas !== original.workerReplicas ||
		form.workerCPU !== original.workerCPU ||
		form.workerMemory !== original.workerMemory ||
		form.workerDiskSize !== original.workerDiskSize
	)
}

function buildRequest(form: FormState, original: FormState, resourceVersion: string): UpdateClusterRequest {
	const req: UpdateClusterRequest = { resourceVersion }

	if (form.kubernetesVersion !== original.kubernetesVersion) {
		req.kubernetesVersion = form.kubernetesVersion
	}
	if (form.cpReplicas !== original.cpReplicas) {
		req.controlPlane = { replicas: form.cpReplicas }
	}

	const workerChanges: Record<string, unknown> = {}
	if (form.workerReplicas !== original.workerReplicas) {
		if (!req.workers) req.workers = {}
		req.workers.replicas = form.workerReplicas
	}
	if (form.workerCPU !== original.workerCPU) workerChanges.cpu = form.workerCPU
	if (form.workerMemory !== original.workerMemory) workerChanges.memory = form.workerMemory
	if (form.workerDiskSize !== original.workerDiskSize) workerChanges.diskSize = form.workerDiskSize
	if (Object.keys(workerChanges).length > 0) {
		if (!req.workers) req.workers = {}
		req.workers.machineTemplate = workerChanges
	}

	return req
}

export function EditClusterModal({ isOpen, onClose, onSaved, cluster, isAdmin }: EditClusterModalProps) {
	const [original, setOriginal] = useState<FormState>(() => formFromCluster(cluster))
	const [form, setForm] = useState<FormState>(() => formFromCluster(cluster))
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [fieldErrors, setFieldErrors] = useState<FieldError[]>([])
	const [conflict, setConflict] = useState(false)
	const [ackDowngrade, setAckDowngrade] = useState(false)

	useEffect(() => {
		if (isOpen) {
			const snapshot = formFromCluster(cluster)
			setOriginal(snapshot)
			setForm(snapshot)
			setError(null)
			setFieldErrors([])
			setSaving(false)
			setConflict(false)
			setAckDowngrade(false)
		}
	}, [isOpen, cluster])

	const changed = hasChanges(form, original)
	const phase = cluster.status?.phase
	const needsDowngradeAck = original.cpReplicas === 3 && form.cpReplicas === 1

	const handleClose = () => {
		if (saving) return
		onClose()
	}

	const handleSave = async () => {
		if (!changed || saving) return
		if (needsDowngradeAck && !ackDowngrade) return
		const rv = cluster.metadata.resourceVersion
		if (!rv) {
			setError('Missing resourceVersion. Refresh and try again.')
			return
		}

		setSaving(true)
		setError(null)
		setFieldErrors([])

		try {
			const req = buildRequest(form, original, rv)
			if (ackDowngrade) req.acknowledgeDowngrade = true
			await clustersApi.update(cluster.metadata.namespace, cluster.metadata.name, req)
			onSaved()
			onClose()
		} catch (err: unknown) {
			if (err instanceof ApiError) {
				if (err.status === 409) {
					setConflict(true)
					setError('This cluster was modified by another user.')
				} else if (err.body?.errors) {
					setFieldErrors(err.body.errors as FieldError[])
				} else {
					setError(err.message)
				}
			} else {
				setError(err instanceof Error ? err.message : 'Failed to update cluster')
			}
		} finally {
			setSaving(false)
		}
	}

	const fieldError = (field: string) => fieldErrors.find(e => e.field === field)

	return (
		<Modal isOpen={isOpen} onClose={handleClose} className="w-full max-w-lg">
			<ModalHeader>
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
						<svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
						</svg>
					</div>
					<div>
						<h2 className="text-lg font-semibold text-neutral-100">Edit Cluster</h2>
						<p className="text-sm text-neutral-400">{cluster.metadata.name}</p>
					</div>
				</div>
			</ModalHeader>

			<ModalBody className="space-y-5">
				{/* Kubernetes Version */}
				<div>
					<label className="block text-sm font-medium text-neutral-300 mb-1">Kubernetes Version</label>
					<input
						type="text"
						value={form.kubernetesVersion}
						onChange={e => setForm(f => ({ ...f, kubernetesVersion: e.target.value }))}
						disabled={saving}
						placeholder="v1.32.0"
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 font-mono text-sm"
					/>
					{fieldError('spec.kubernetesVersion') && (
						<p className="text-xs text-red-400 mt-1">{fieldError('spec.kubernetesVersion')!.reason}</p>
					)}
				</div>

				{/* Control Plane Replicas */}
				{isAdmin && (
					<div>
						<label className="block text-sm font-medium text-neutral-300 mb-1">Control Plane Replicas</label>
						<div className="flex gap-2">
							{[1, 3].map(n => (
								<button
									key={n}
									onClick={() => setForm(f => ({ ...f, cpReplicas: n }))}
									disabled={saving}
									className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
										form.cpReplicas === n
											? 'bg-blue-600 text-white'
											: 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
									} disabled:opacity-50`}
								>
									{n}
								</button>
							))}
						</div>
						{needsDowngradeAck && (
							<label className="flex items-center gap-2 mt-2">
								<input
									type="checkbox"
									checked={ackDowngrade}
									onChange={e => setAckDowngrade(e.target.checked)}
									disabled={saving}
									className="rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-blue-500"
								/>
								<span className="text-xs text-amber-400">I understand reducing from 3 to 1 removes high availability</span>
							</label>
						)}
						{fieldError('spec.controlPlane.replicas') && (
							<p className="text-xs text-red-400 mt-1">{fieldError('spec.controlPlane.replicas')!.reason}</p>
						)}
					</div>
				)}

				{/* Workers */}
				<div className="space-y-3">
					<p className="text-sm font-medium text-neutral-300">Workers</p>
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="block text-xs text-neutral-500 mb-1">Replicas</label>
							<input
								type="number"
								min={1}
								max={100}
								value={form.workerReplicas}
								onChange={e => setForm(f => ({ ...f, workerReplicas: parseInt(e.target.value, 10) || 1 }))}
								disabled={saving}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
							/>
						</div>
						<div>
							<label className="block text-xs text-neutral-500 mb-1">CPU Cores</label>
							<input
								type="number"
								min={1}
								value={form.workerCPU}
								onChange={e => setForm(f => ({ ...f, workerCPU: parseInt(e.target.value, 10) || 1 }))}
								disabled={saving}
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
							/>
						</div>
						<div>
							<label className="block text-xs text-neutral-500 mb-1">Memory</label>
							<input
								type="text"
								value={form.workerMemory}
								onChange={e => setForm(f => ({ ...f, workerMemory: e.target.value }))}
								disabled={saving}
								placeholder="16Gi"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm font-mono"
							/>
						</div>
						<div>
							<label className="block text-xs text-neutral-500 mb-1">Disk Size</label>
							<input
								type="text"
								value={form.workerDiskSize}
								onChange={e => setForm(f => ({ ...f, workerDiskSize: e.target.value }))}
								disabled={saving}
								placeholder="100Gi"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm font-mono"
							/>
						</div>
					</div>
					{fieldError('spec.workers.replicas') && (
						<p className="text-xs text-red-400">{fieldError('spec.workers.replicas')!.reason}</p>
					)}
					{fieldError('spec.workers.machineTemplate.cpu') && (
						<p className="text-xs text-red-400">{fieldError('spec.workers.machineTemplate.cpu')!.reason}</p>
					)}
				</div>

				{/* Phase warning */}
				{(phase === 'Provisioning' || phase === 'Installing') && (
					<div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
						<p className="text-sm text-amber-400">Cluster is {phase?.toLowerCase()}. Changes will apply after the current operation completes.</p>
					</div>
				)}

				{/* Errors */}
				{error && (
					<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-sm text-red-400">{error}</p>
						{conflict && (
							<Button variant="secondary" size="sm" onClick={() => { onClose(); onSaved() }} className="mt-2">
								Refresh
							</Button>
						)}
					</div>
				)}
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={handleClose} disabled={saving}>
					Cancel
				</Button>
				<Button onClick={handleSave} disabled={!changed || saving || (needsDowngradeAck && !ackDowngrade)}>
					{saving ? 'Saving...' : 'Save Changes'}
				</Button>
			</ModalFooter>
		</Modal>
	)
}
