// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback, useRef } from 'react'
import { useDocumentTitle } from '@/hooks'
import { useToast } from '@/hooks/useToast'
import {
	addonsApi,
	type AddonDefinition,
	type AddonCategory,
	type CreateAddonDefinitionRequest,
	CATEGORY_INFO,
} from '@/api'
import {
	Card,
	Spinner,
	Button,
	FadeIn,
	Input,
	Modal,
	ModalHeader,
	ModalBody,
	ModalFooter,
	StatusBadge,
} from '@/components/ui'

const CATEGORIES: AddonCategory[] = [
	'cni', 'loadbalancer', 'storage', 'certmanager', 'ingress',
	'observability', 'backup', 'gitops', 'security', 'other',
]

export function AddonCatalogPage() {
	useDocumentTitle('Addon Catalog')
	const toast = useToast()
	const toastRef = useRef(toast)
	toastRef.current = toast

	const [addons, setAddons] = useState<AddonDefinition[]>([])
	const [loading, setLoading] = useState(true)
	const [showCreateModal, setShowCreateModal] = useState(false)
	const [editAddon, setEditAddon] = useState<AddonDefinition | null>(null)
	const [deleteAddon, setDeleteAddon] = useState<AddonDefinition | null>(null)
	const [saving, setSaving] = useState(false)
	const [deleting, setDeleting] = useState(false)

	const loadCatalog = useCallback(async () => {
		try {
			setLoading(true)
			const data = await addonsApi.getCatalog()
			setAddons(data.addons || [])
		} catch {
			toastRef.current.error('Error', 'Failed to load addon catalog')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		loadCatalog()
	}, [loadCatalog])

	const handleCreate = async (data: CreateAddonDefinitionRequest) => {
		setSaving(true)
		try {
			await addonsApi.createDefinition(data)
			toast.success('Created', `Addon definition "${data.displayName}" created`)
			setShowCreateModal(false)
			loadCatalog()
		} catch (err) {
			toast.error('Failed', err instanceof Error ? err.message : 'Failed to create addon definition')
		} finally {
			setSaving(false)
		}
	}

	const handleUpdate = async (data: CreateAddonDefinitionRequest) => {
		if (!editAddon) return
		setSaving(true)
		try {
			await addonsApi.updateDefinition(editAddon.name, data)
			toast.success('Updated', `Addon definition "${data.displayName}" updated`)
			setEditAddon(null)
			loadCatalog()
		} catch (err) {
			toast.error('Failed', err instanceof Error ? err.message : 'Failed to update addon definition')
		} finally {
			setSaving(false)
		}
	}

	const handleDelete = async () => {
		if (!deleteAddon) return
		setDeleting(true)
		try {
			await addonsApi.deleteDefinition(deleteAddon.name)
			toast.success('Deleted', `Addon definition "${deleteAddon.displayName}" deleted`)
			setDeleteAddon(null)
			loadCatalog()
		} catch (err) {
			toast.error('Failed', err instanceof Error ? err.message : 'Failed to delete addon definition')
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

	return (
		<FadeIn>
			<div className="space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-neutral-50">Addon Catalog</h1>
						<p className="text-neutral-400 mt-1">
							Manage addon definitions available for tenant clusters
						</p>
					</div>
					<Button onClick={() => setShowCreateModal(true)}>
						<svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
						</svg>
						Add Definition
					</Button>
				</div>

				{addons.length === 0 ? (
					<Card className="p-8 text-center">
						<p className="text-neutral-400">No addon definitions found</p>
					</Card>
				) : (
					<Card className="overflow-hidden">
						<table className="w-full">
							<thead className="bg-neutral-800/50">
								<tr>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Name</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Category</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Chart</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Version</th>
									<th className="px-5 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Source</th>
									<th className="px-5 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-800">
								{addons.map((addon) => (
									<tr key={addon.name} className="hover:bg-neutral-800/30">
										<td className="px-5 py-4">
											<div>
												<p className="text-neutral-200 font-medium">{addon.displayName || addon.name}</p>
												<p className="text-xs text-neutral-500 font-mono">{addon.name}</p>
											</div>
										</td>
										<td className="px-5 py-4">
											<span className="text-sm text-neutral-300">
												{CATEGORY_INFO[addon.category]?.displayName || addon.category}
											</span>
										</td>
										<td className="px-5 py-4 text-sm text-neutral-400 font-mono">
											{addon.chartName}
										</td>
										<td className="px-5 py-4 text-sm text-neutral-400 font-mono">
											{addon.defaultVersion}
										</td>
										<td className="px-5 py-4">
											<StatusBadge status={addon.source === 'builtin' ? 'Ready' : 'Custom'} />
										</td>
										<td className="px-5 py-4 text-right">
											{addon.source === 'builtin' ? (
												<span className="text-xs text-neutral-500">managed</span>
											) : (
												<div className="flex items-center justify-end gap-2">
													<button
														onClick={() => setEditAddon(addon)}
														className="text-sm text-violet-400 hover:text-violet-300"
													>
														Edit
													</button>
													<button
														onClick={() => setDeleteAddon(addon)}
														className="text-sm text-red-400 hover:text-red-300"
													>
														Delete
													</button>
												</div>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</Card>
				)}
			</div>

			<AddonDefinitionModal
				isOpen={showCreateModal}
				onClose={() => setShowCreateModal(false)}
				onSave={handleCreate}
				saving={saving}
				title="Create Addon Definition"
			/>

			{editAddon && (
				<AddonDefinitionModal
					isOpen={true}
					onClose={() => setEditAddon(null)}
					onSave={handleUpdate}
					saving={saving}
					title="Edit Addon Definition"
					initial={editAddon}
				/>
			)}

			<Modal isOpen={!!deleteAddon} onClose={() => setDeleteAddon(null)}>
				<ModalHeader>
					<h2 className="text-lg font-semibold text-neutral-100">Delete Addon Definition</h2>
				</ModalHeader>
				<ModalBody>
					<p className="text-neutral-400">
						Are you sure you want to delete{' '}
						<strong className="text-neutral-200">{deleteAddon?.displayName || deleteAddon?.name}</strong>?
					</p>
					<p className="text-sm text-neutral-500 mt-2">
						This will not affect clusters that already have this addon installed.
					</p>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={() => setDeleteAddon(null)}>Cancel</Button>
					<Button variant="danger" onClick={handleDelete} disabled={deleting}>
						{deleting ? 'Deleting...' : 'Delete'}
					</Button>
				</ModalFooter>
			</Modal>
		</FadeIn>
	)
}

function AddonDefinitionModal({
	isOpen,
	onClose,
	onSave,
	saving,
	title,
	initial,
}: {
	isOpen: boolean
	onClose: () => void
	onSave: (data: CreateAddonDefinitionRequest) => void
	saving: boolean
	title: string
	initial?: AddonDefinition
}) {
	const [form, setForm] = useState({
		name: '',
		displayName: '',
		description: '',
		category: 'other' as AddonCategory,
		chartRepository: '',
		chartName: '',
		defaultVersion: '',
		defaultNamespace: '',
		platform: false,
	})

	useEffect(() => {
		if (isOpen && initial) {
			setForm({
				name: initial.name,
				displayName: initial.displayName,
				description: initial.description,
				category: initial.category,
				chartRepository: initial.chartRepository,
				chartName: initial.chartName,
				defaultVersion: initial.defaultVersion,
				defaultNamespace: initial.defaultNamespace || '',
				platform: initial.platform,
			})
		} else if (isOpen) {
			setForm({
				name: '',
				displayName: '',
				description: '',
				category: 'other',
				chartRepository: '',
				chartName: '',
				defaultVersion: '',
				defaultNamespace: '',
				platform: false,
			})
		}
	}, [isOpen, initial])

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		onSave({
			name: initial ? initial.name : form.name,
			displayName: form.displayName,
			description: form.description,
			category: form.category,
			chartRepository: form.chartRepository,
			chartName: form.chartName,
			defaultVersion: form.defaultVersion,
			defaultNamespace: form.defaultNamespace || undefined,
			platform: form.platform,
		})
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalHeader>
				<h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
			</ModalHeader>
			<form onSubmit={handleSubmit}>
				<ModalBody className="space-y-4">
					{!initial && (
						<Input
							id="addonName"
							label="Name"
							value={form.name}
							onChange={(e) => setForm({ ...form, name: e.target.value })}
							placeholder="my-addon"
							required
						/>
					)}
					<Input
						id="displayName"
						label="Display Name"
						value={form.displayName}
						onChange={(e) => setForm({ ...form, displayName: e.target.value })}
						placeholder="My Addon"
						required
					/>
					<div>
						<label className="block text-sm font-medium text-neutral-300 mb-1">Description</label>
						<textarea
							value={form.description}
							onChange={(e) => setForm({ ...form, description: e.target.value })}
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm"
							rows={2}
							placeholder="Description of the addon"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-neutral-300 mb-1">Category</label>
						<select
							value={form.category}
							onChange={(e) => setForm({ ...form, category: e.target.value as AddonCategory })}
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
						>
							{CATEGORIES.map((cat) => (
								<option key={cat} value={cat}>{CATEGORY_INFO[cat].displayName}</option>
							))}
						</select>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<Input
							id="chartRepository"
							label="Chart Repository"
							value={form.chartRepository}
							onChange={(e) => setForm({ ...form, chartRepository: e.target.value })}
							placeholder="oci://ghcr.io/..."
							required
						/>
						<Input
							id="chartName"
							label="Chart Name"
							value={form.chartName}
							onChange={(e) => setForm({ ...form, chartName: e.target.value })}
							placeholder="my-chart"
							required
						/>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<Input
							id="defaultVersion"
							label="Default Version"
							value={form.defaultVersion}
							onChange={(e) => setForm({ ...form, defaultVersion: e.target.value })}
							placeholder="1.0.0"
						/>
						<Input
							id="defaultNamespace"
							label="Default Namespace"
							value={form.defaultNamespace}
							onChange={(e) => setForm({ ...form, defaultNamespace: e.target.value })}
							placeholder="kube-system"
						/>
					</div>
					<label className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer">
						<input
							type="checkbox"
							checked={form.platform}
							onChange={(e) => setForm({ ...form, platform: e.target.checked })}
							className="rounded border-neutral-700 bg-neutral-800 text-violet-500 focus:ring-violet-500"
						/>
						Platform addon (auto-installed on all clusters)
					</label>
				</ModalBody>
				<ModalFooter>
					<Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
					<Button type="submit" disabled={saving}>
						{saving ? 'Saving...' : initial ? 'Update' : 'Create'}
					</Button>
				</ModalFooter>
			</form>
		</Modal>
	)
}
