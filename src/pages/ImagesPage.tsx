// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState, useCallback, useRef } from 'react'
import { useDocumentTitle } from '@/hooks'
import { imagesApi } from '@/api/images'
import { providersApi, type Provider } from '@/api/providers'
import { Card, Spinner, Button, FadeIn } from '@/components/ui'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useToast } from '@/hooks/useToast'
import type { ImageSync, CreateImageSyncRequest, UpdateImageSyncRequest, FactoryCatalogEntry } from '@/types/imagesync'

export function ImagesPage() {
	useDocumentTitle('Images')
	const { success, error: showError } = useToast()

	const [imageSyncs, setImageSyncs] = useState<ImageSync[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [showCreateModal, setShowCreateModal] = useState(false)
	const [deleteTarget, setDeleteTarget] = useState<ImageSync | null>(null)
	const [deleting, setDeleting] = useState(false)
	const [editTarget, setEditTarget] = useState<ImageSync | null>(null)

	// Auto-refresh
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const loadImages = useCallback(async () => {
		try {
			const response = await imagesApi.list()
			setImageSyncs(response.imageSyncs || [])
			setError(null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load images')
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		loadImages()
	}, [loadImages])

	// Poll every 10s when any ImageSync is in progress
	useEffect(() => {
		const hasInProgress = imageSyncs.some((img) => {
			const phase = img.status?.phase?.toLowerCase()
			return phase && phase !== 'ready' && phase !== 'failed'
		})

		if (hasInProgress) {
			pollRef.current = setInterval(loadImages, 10000)
		} else if (pollRef.current) {
			clearInterval(pollRef.current)
			pollRef.current = null
		}

		return () => {
			if (pollRef.current) {
				clearInterval(pollRef.current)
				pollRef.current = null
			}
		}
	}, [imageSyncs, loadImages])

	const handleDelete = async () => {
		if (!deleteTarget) return

		setDeleting(true)
		try {
			await imagesApi.delete(deleteTarget.metadata.namespace, deleteTarget.metadata.name)
			success('Image Sync Deleted', `${deleteTarget.metadata.name} has been deleted`)
			setImageSyncs((prev) =>
				prev.filter((i) => i.metadata.uid !== deleteTarget.metadata.uid)
			)
			setDeleteTarget(null)
		} catch (err) {
			showError('Delete Failed', err instanceof Error ? err.message : 'Failed to delete')
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
				<button
					onClick={loadImages}
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
						<h1 className="text-2xl font-semibold text-neutral-50">Images</h1>
						<p className="text-neutral-400 mt-1">
							Sync OS images from Butler Image Factory to infrastructure providers
						</p>
					</div>
					<Button onClick={() => setShowCreateModal(true)}>
						<svg
							className="w-4 h-4 mr-2"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 4v16m8-8H4"
							/>
						</svg>
						Sync Image
					</Button>
				</div>

				{imageSyncs.length === 0 ? (
					<Card className="p-8 text-center">
						<div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto mb-4">
							<ImageIcon className="w-6 h-6 text-neutral-500" />
						</div>
						<h3 className="text-lg font-medium text-neutral-200 mb-2">
							No Image Syncs
						</h3>
						<p className="text-neutral-400 mb-4">
							Sync your first OS image from Butler Image Factory to an
							infrastructure provider.
						</p>
						<Button onClick={() => setShowCreateModal(true)}>Sync Image</Button>
					</Card>
				) : (
					<Card className="overflow-hidden">
						<div className="overflow-x-auto">
							<table className="w-full">
								<thead>
									<tr className="border-b border-neutral-800">
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Name
										</th>
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Provider
										</th>
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Phase
										</th>
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Schematic
										</th>
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Version
										</th>
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Image Ref
										</th>
										<th className="text-left px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Age
										</th>
										<th className="text-right px-4 py-3 text-xs font-medium text-neutral-500 uppercase tracking-wide">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-neutral-800">
									{imageSyncs.map((img) => (
										<ImageSyncRow
											key={
												img.metadata.uid ||
												`${img.metadata.namespace}/${img.metadata.name}`
											}
											imageSync={img}
											onDelete={() => setDeleteTarget(img)}
											onEdit={() => setEditTarget(img)}
										/>
									))}
								</tbody>
							</table>
						</div>
					</Card>
				)}
			</div>

			{/* Create Modal */}
			<SyncImageModal
				isOpen={showCreateModal}
				onClose={() => setShowCreateModal(false)}
				onCreated={() => {
					setShowCreateModal(false)
					loadImages()
				}}
				existingImageSyncs={imageSyncs}
			/>

			{/* Delete Confirmation Modal */}
			<Modal isOpen={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)}>
				<ModalHeader>
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
							<svg
								className="w-5 h-5 text-red-500"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
								/>
							</svg>
						</div>
						<div>
							<h2 className="text-lg font-semibold text-neutral-100">
								Delete Image Sync
							</h2>
							<p className="text-sm text-neutral-400">
								This action cannot be undone
							</p>
						</div>
					</div>
				</ModalHeader>
				<ModalBody>
					<p className="text-neutral-300">
						Are you sure you want to delete image sync{' '}
						<span className="font-mono font-semibold text-red-400">
							{deleteTarget?.metadata.name}
						</span>
						?
					</p>
					{deleteTarget?.status?.providerImageRef && (
						<p className="text-sm text-neutral-500 mt-2">
							The synced image on the provider will not be removed.
						</p>
					)}
				</ModalBody>
				<ModalFooter>
					<Button
						variant="secondary"
						onClick={() => setDeleteTarget(null)}
						disabled={deleting}
					>
						Cancel
					</Button>
					<Button variant="danger" onClick={handleDelete} disabled={deleting}>
						{deleting ? 'Deleting...' : 'Delete'}
					</Button>
				</ModalFooter>
			</Modal>

			{/* Edit Modal */}
			{editTarget && (
				<EditImageSyncModal
					isOpen={!!editTarget}
					onClose={() => setEditTarget(null)}
					onUpdated={() => {
						setEditTarget(null)
						loadImages()
					}}
					imageSync={editTarget}
				/>
			)}
		</FadeIn>
	)
}

// ----------------------------------------------------------------------------
// Table Row
// ----------------------------------------------------------------------------

interface ImageSyncRowProps {
	imageSync: ImageSync
	onDelete: () => void
	onEdit: () => void
}

function ImageSyncRow({ imageSync, onDelete, onEdit }: ImageSyncRowProps) {
	const { metadata, spec, status } = imageSync
	const phase = status?.phase || 'Unknown'
	const factoryRef = spec.factoryRef
	const schematicShort = factoryRef?.schematicID
		? factoryRef.schematicID.substring(0, 8)
		: '-'

	const providerRef = spec.providerConfigRef
	const providerLabel = providerRef
		? providerRef.namespace
			? `${providerRef.namespace}/${providerRef.name}`
			: providerRef.name
		: '-'

	const age = metadata.creationTimestamp
		? formatAge(metadata.creationTimestamp)
		: '-'

	return (
		<tr className="hover:bg-neutral-800/30 transition-colors">
			<td className="px-4 py-3">
				<div className="flex items-center gap-3">
					<div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
						<ImageIcon className="w-4 h-4 text-blue-400" />
					</div>
					<div className="min-w-0">
						<p className="text-sm font-medium text-neutral-100 truncate">
							{spec.displayName || metadata.name}
						</p>
						{spec.displayName && (
							<p className="text-xs text-neutral-500 font-mono truncate">
								{metadata.name}
							</p>
						)}
					</div>
				</div>
			</td>
			<td className="px-4 py-3">
				<span className="text-sm text-neutral-300 font-mono">{providerLabel}</span>
			</td>
			<td className="px-4 py-3">
				<ImageSyncPhaseBadge phase={phase} />
			</td>
			<td className="px-4 py-3">
				<span
					className="text-sm text-neutral-300 font-mono"
					title={factoryRef?.schematicID}
				>
					{schematicShort}
				</span>
			</td>
			<td className="px-4 py-3">
				<span className="text-sm text-neutral-300">{factoryRef?.version}</span>
				{factoryRef?.arch && (
					<span className="ml-1.5 text-xs text-neutral-500">({factoryRef.arch})</span>
				)}
			</td>
			<td className="px-4 py-3">
				{status?.providerImageRef ? (
					<span
						className="text-sm text-neutral-300 font-mono truncate block max-w-[200px]"
						title={status.providerImageRef}
					>
						{status.providerImageRef}
					</span>
				) : (
					<span className="text-sm text-neutral-500">-</span>
				)}
			</td>
			<td className="px-4 py-3">
				<span className="text-sm text-neutral-400">{age}</span>
			</td>
			<td className="px-4 py-3 text-right">
				<div className="flex items-center justify-end gap-1">
					<button
						onClick={(e) => { e.stopPropagation(); onEdit() }}
						className="p-1.5 text-neutral-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
						title="Edit image sync"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
						</svg>
					</button>
					<button
						onClick={(e) => { e.stopPropagation(); onDelete() }}
						className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
						title="Delete image sync"
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
					</button>
				</div>
			</td>
		</tr>
	)
}

// ----------------------------------------------------------------------------
// Phase Badge
// ----------------------------------------------------------------------------

function ImageSyncPhaseBadge({ phase }: { phase: string }) {
	// Map ImageSync phases to StatusBadge-compatible status strings
	const phaseMap: Record<string, string> = {
		ready: 'ready',
		pending: 'pending',
		building: 'installing',
		downloading: 'installing',
		uploading: 'installing',
		failed: 'failed',
	}

	const mappedStatus = phaseMap[phase.toLowerCase()] || phase.toLowerCase()
	return <StatusBadge status={mappedStatus} className={undefined} />
}

// ----------------------------------------------------------------------------
// Sync Image Modal
// ----------------------------------------------------------------------------

interface SyncImageModalProps {
	isOpen: boolean
	onClose: () => void
	onCreated: () => void
	existingImageSyncs: ImageSync[]
}

function SyncImageModal({ isOpen, onClose, onCreated, existingImageSyncs }: SyncImageModalProps) {
	const { success, error: showError } = useToast()

	const [providers, setProviders] = useState<Provider[]>([])
	const [loadingProviders, setLoadingProviders] = useState(false)
	const [creating, setCreating] = useState(false)
	const [formError, setFormError] = useState<string | null>(null)

	// Catalog browser state
	const [catalog, setCatalog] = useState<FactoryCatalogEntry[]>([])
	const [loadingCatalog, setLoadingCatalog] = useState(false)
	const [catalogError, setCatalogError] = useState<string | null>(null)
	const [selectedOS, setSelectedOS] = useState<FactoryCatalogEntry | null>(null)
	const [useManualEntry, setUseManualEntry] = useState(false)

	const [form, setForm] = useState<CreateImageSyncRequest>({
		schematicID: '',
		version: '',
		arch: 'amd64',
		platform: '',
		providerConfig: '',
		format: '',
		transferMode: 'direct',
		displayName: '',
	})

	// Load providers when modal opens
	useEffect(() => {
		if (!isOpen) return
		const fetchProviders = async () => {
			setLoadingProviders(true)
			try {
				const response = await providersApi.list()
				setProviders(response.providers || [])
			} catch {
				// Non-critical - user can type provider ref manually
			} finally {
				setLoadingProviders(false)
			}
		}
		fetchProviders()
	}, [isOpen])

	// Load catalog when modal opens
	useEffect(() => {
		if (!isOpen) return
		const fetchCatalog = async () => {
			setLoadingCatalog(true)
			setCatalogError(null)
			try {
				const entries = await imagesApi.getFactoryCatalog()
				setCatalog(entries)
			} catch {
				setCatalogError('Failed to load image catalog')
			} finally {
				setLoadingCatalog(false)
			}
		}
		fetchCatalog()
	}, [isOpen])

	// Reset form when modal opens
	useEffect(() => {
		if (isOpen) {
			setForm({
				schematicID: '',
				version: '',
				arch: 'amd64',
				platform: '',
				providerConfig: '',
				format: '',
				transferMode: 'direct',
				displayName: '',
			})
			setFormError(null)
			setSelectedOS(null)
			setUseManualEntry(false)
		}
	}, [isOpen])

	const handleSelectOS = (entry: FactoryCatalogEntry) => {
		setSelectedOS(entry)
		// Auto-fill schematic ID from existing ImageSyncs that match this OS by platform
		const existingSync = existingImageSyncs.find(img =>
			img.spec.factoryRef?.platform?.toLowerCase() === entry.os.toLowerCase()
		)
		setForm(prev => ({
			...prev,
			version: '',
			platform: entry.os.toLowerCase(),
			schematicID: existingSync?.spec.factoryRef?.schematicID || prev.schematicID,
			format: entry.formats.length === 1 ? entry.formats[0] : prev.format,
		}))
	}

	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target
		setForm((prev) => ({ ...prev, [name]: value }))
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setFormError(null)

		if (!form.schematicID) {
			setFormError('Schematic ID is required')
			return
		}
		if (!form.version) {
			setFormError('Version is required')
			return
		}
		if (!form.providerConfig) {
			setFormError('Provider is required')
			return
		}

		setCreating(true)
		try {
			// Build request, omitting empty optional fields
			const request: CreateImageSyncRequest = {
				schematicID: form.schematicID,
				version: form.version,
				providerConfig: form.providerConfig,
			}
			if (form.arch) request.arch = form.arch
			if (form.platform) request.platform = form.platform
			if (form.format) request.format = form.format
			if (form.transferMode) request.transferMode = form.transferMode
			if (form.displayName) request.displayName = form.displayName

			await imagesApi.create(request)
			success('Image Sync Created', 'Image sync has been started')
			onCreated()
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Failed to create image sync'
			setFormError(message)
			showError('Creation Failed', message)
		} finally {
			setCreating(false)
		}
	}

	const inputClass =
		'w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm'
	const labelClass = 'block text-sm font-medium text-neutral-400 mb-1'

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg">
			<form onSubmit={handleSubmit}>
				<ModalHeader>
					<div className="flex items-center gap-3">
						<div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
							<ImageIcon className="w-5 h-5 text-blue-400" />
						</div>
						<div>
							<h2 className="text-lg font-semibold text-neutral-100">
								Sync Image
							</h2>
							<p className="text-sm text-neutral-400">
								Sync an OS image from Butler Image Factory to a provider
							</p>
						</div>
					</div>
				</ModalHeader>
				<ModalBody className="space-y-4">
					{/* Catalog Browser or Manual Entry */}
					{!useManualEntry ? (
						<>
							{/* OS Selection from Catalog */}
							<div>
								<div className="flex items-center justify-between mb-2">
									<label className={labelClass}>OS Image *</label>
									<button
										type="button"
										onClick={() => setUseManualEntry(true)}
										className="text-xs text-green-400 hover:text-green-300"
									>
										Enter schematic ID manually
									</button>
								</div>
								{loadingCatalog ? (
									<div className="flex items-center gap-2 p-4 text-neutral-400">
										<Spinner size="sm" />
										<span className="text-sm">Loading catalog...</span>
									</div>
								) : catalogError ? (
									<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
										<p className="text-red-400 text-sm">{catalogError}</p>
										<button
											type="button"
											onClick={() => setUseManualEntry(true)}
											className="text-xs text-neutral-400 hover:text-neutral-300 mt-1"
										>
											Switch to manual entry
										</button>
									</div>
								) : (
									<div className="grid grid-cols-3 gap-2">
										{catalog.map((entry) => (
											<button
												key={entry.os}
												type="button"
												onClick={() => handleSelectOS(entry)}
												className={`p-3 rounded-lg border text-left transition-all ${
													selectedOS?.os === entry.os
														? 'border-green-500/50 bg-green-500/5'
														: 'border-neutral-700/50 bg-neutral-800/50 hover:border-neutral-600'
												}`}
											>
												<p className="text-sm font-medium text-neutral-100">{entry.os}</p>
												<p className="text-xs text-neutral-500 mt-0.5">{entry.versions.length} version{entry.versions.length !== 1 ? 's' : ''}</p>
											</button>
										))}
									</div>
								)}
							</div>

							{/* Version + Arch (catalog-driven) */}
							{selectedOS && (
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className={labelClass}>Version *</label>
										<select
											name="version"
											value={form.version}
											onChange={handleChange}
											className={inputClass}
										>
											<option value="">Select version...</option>
											{selectedOS.versions.map((v) => (
												<option key={v} value={v}>{v}</option>
											))}
										</select>
									</div>
									<div>
										<label className={labelClass}>Architecture</label>
										<select
											name="arch"
											value={form.arch}
											onChange={handleChange}
											className={inputClass}
										>
											<option value="amd64">amd64</option>
											<option value="arm64">arm64</option>
										</select>
									</div>
								</div>
							)}

							{/* Schematic ID (still required, shown after OS selection) */}
							{selectedOS && (
								<div>
									<label className={labelClass}>Schematic ID *</label>
									<input
										type="text"
										name="schematicID"
										value={form.schematicID}
										onChange={handleChange}
										placeholder="ce4c980550dd2ab1b17bbf2b08801c7eb59418ea..."
										className={inputClass}
									/>
									<p className="text-xs text-neutral-500 mt-1">
										Content-addressable schematic hash from Image Factory
									</p>
								</div>
							)}
						</>
					) : (
						<>
							{/* Manual Entry */}
							<div>
								<div className="flex items-center justify-between mb-2">
									<label className={labelClass}>Schematic ID *</label>
									{catalog.length > 0 && (
										<button
											type="button"
											onClick={() => setUseManualEntry(false)}
											className="text-xs text-green-400 hover:text-green-300"
										>
											Browse catalog instead
										</button>
									)}
								</div>
								<input
									type="text"
									name="schematicID"
									value={form.schematicID}
									onChange={handleChange}
									placeholder="ce4c980550dd2ab1b17bbf2b08801c7eb59418ea..."
									className={inputClass}
								/>
								<p className="text-xs text-neutral-500 mt-1">
									Content-addressable schematic hash from Image Factory
								</p>
							</div>

							{/* Version + Arch (manual) */}
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className={labelClass}>Version *</label>
									<input
										type="text"
										name="version"
										value={form.version}
										onChange={handleChange}
										placeholder="v1.9.5"
										className={inputClass}
									/>
								</div>
								<div>
									<label className={labelClass}>Architecture</label>
									<select
										name="arch"
										value={form.arch}
										onChange={handleChange}
										className={inputClass}
									>
										<option value="amd64">amd64</option>
										<option value="arm64">arm64</option>
									</select>
								</div>
							</div>

							{/* Platform (manual) */}
							<div>
								<label className={labelClass}>Platform</label>
								<input
									type="text"
									name="platform"
									value={form.platform}
									onChange={handleChange}
									placeholder="talos, kairos, flatcar, bottlerocket"
									className={inputClass}
								/>
								<p className="text-xs text-neutral-500 mt-1">
									OS platform name used by Image Factory
								</p>
							</div>
						</>
					)}

					{/* Provider */}
					<div>
						<label className={labelClass}>Provider *</label>
						{loadingProviders ? (
							<div className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center">
								<Spinner size="sm" className="mr-2" />
								<span className="text-neutral-400">Loading providers...</span>
							</div>
						) : providers.length > 0 ? (
							<select
								name="providerConfig"
								value={form.providerConfig}
								onChange={handleChange}
								className={inputClass}
							>
								<option value="">Select provider...</option>
								{providers.map((p) => (
									<option
										key={p.metadata.uid || p.metadata.name}
										value={`${p.metadata.namespace}/${p.metadata.name}`}
									>
										{p.metadata.name} ({p.spec.provider})
									</option>
								))}
							</select>
						) : (
							<input
								type="text"
								name="providerConfig"
								value={form.providerConfig}
								onChange={handleChange}
								placeholder="butler-system/my-provider"
								className={inputClass}
							/>
						)}
						<p className="text-xs text-neutral-500 mt-1">
							Target provider in namespace/name format
						</p>
					</div>

					{/* Format + Transfer Mode */}
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className={labelClass}>Format</label>
							<select
								name="format"
								value={form.format}
								onChange={handleChange}
								className={inputClass}
							>
								<option value="">Auto-detect</option>
								{(selectedOS?.formats || ['raw', 'qcow2', 'iso', 'ova', 'vhd', 'vmdk']).map((fmt) => (
									<option key={fmt} value={fmt}>{fmt}</option>
								))}
							</select>
						</div>
						<div>
							<label className={labelClass}>Transfer Mode</label>
							<select
								name="transferMode"
								value={form.transferMode}
								onChange={handleChange}
								className={inputClass}
							>
								<option value="direct">Direct</option>
								<option value="proxy">Proxy</option>
							</select>
						</div>
					</div>

					{/* Display Name */}
					<div>
						<label className={labelClass}>Display Name</label>
						<input
							type="text"
							name="displayName"
							value={form.displayName}
							onChange={handleChange}
							placeholder="Optional friendly name"
							className={inputClass}
						/>
					</div>

					{/* Error */}
					{formError && (
						<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
							<p className="text-red-400 text-sm">{formError}</p>
						</div>
					)}
				</ModalBody>
				<ModalFooter>
					<Button
						type="button"
						variant="secondary"
						onClick={onClose}
						disabled={creating}
					>
						Cancel
					</Button>
					<Button type="submit" disabled={creating}>
						{creating ? 'Creating...' : 'Sync Image'}
					</Button>
				</ModalFooter>
			</form>
		</Modal>
	)
}

// ----------------------------------------------------------------------------
// Edit Image Sync Modal
// ----------------------------------------------------------------------------

function EditImageSyncModal({ isOpen, onClose, onUpdated, imageSync }: {
	isOpen: boolean
	onClose: () => void
	onUpdated: () => void
	imageSync: ImageSync
}) {
	const { success, error: showError } = useToast()
	const [saving, setSaving] = useState(false)
	const [formError, setFormError] = useState<string | null>(null)

	const [displayName, setDisplayName] = useState('')
	const [format, setFormat] = useState('')
	const [transferMode, setTransferMode] = useState('')
	const [original, setOriginal] = useState({ displayName: '', format: '', transferMode: '' })

	useEffect(() => {
		if (isOpen && imageSync) {
			const dn = imageSync.spec.displayName || ''
			const fmt = imageSync.spec.format || ''
			const tm = imageSync.spec.transferMode || ''
			setDisplayName(dn)
			setFormat(fmt)
			setTransferMode(tm)
			setOriginal({ displayName: dn, format: fmt, transferMode: tm })
			setFormError(null)
		}
	}, [isOpen, imageSync])

	const hasChanges = displayName !== original.displayName
		|| format !== original.format
		|| transferMode !== original.transferMode

	const handleSave = async () => {
		if (!hasChanges || saving) return
		setSaving(true)
		setFormError(null)
		try {
			const req: UpdateImageSyncRequest = {}
			if (displayName !== original.displayName) req.displayName = displayName
			if (format !== original.format) req.format = format
			if (transferMode !== original.transferMode) req.transferMode = transferMode
			await imagesApi.update(imageSync.metadata.namespace, imageSync.metadata.name, req)
			success('Image Sync Updated', `${imageSync.metadata.name} has been updated`)
			onUpdated()
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update'
			setFormError(message)
			showError('Update Failed', message)
		} finally {
			setSaving(false)
		}
	}

	const inputClass = 'w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm'
	const readOnlyClass = 'w-full px-3 py-2 bg-neutral-800/50 border border-neutral-700/50 rounded-lg text-neutral-400 text-sm font-mono cursor-not-allowed'
	const labelClass = 'block text-sm font-medium text-neutral-400 mb-1'

	const factoryRef = imageSync.spec.factoryRef
	const providerRef = imageSync.spec.providerConfigRef
	const providerLabel = providerRef?.namespace
		? `${providerRef.namespace}/${providerRef.name}`
		: providerRef?.name || '-'

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg">
			<ModalHeader>
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
						<ImageIcon className="w-5 h-5 text-blue-400" />
					</div>
					<div>
						<h2 className="text-lg font-semibold text-neutral-100">Edit Image Sync</h2>
						<p className="text-sm text-neutral-400">{imageSync.metadata.name}</p>
					</div>
				</div>
			</ModalHeader>
			<ModalBody className="space-y-4">
				{/* Read-only fields */}
				<div>
					<p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">Immutable</p>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className={labelClass}>Schematic ID</label>
							<input type="text" readOnly value={factoryRef?.schematicID || ''} className={readOnlyClass} title={factoryRef?.schematicID} />
						</div>
						<div>
							<label className={labelClass}>Version</label>
							<input type="text" readOnly value={factoryRef?.version || ''} className={readOnlyClass} />
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4 mt-3">
						<div>
							<label className={labelClass}>Architecture</label>
							<input type="text" readOnly value={factoryRef?.arch || 'amd64'} className={readOnlyClass} />
						</div>
						<div>
							<label className={labelClass}>Provider</label>
							<input type="text" readOnly value={providerLabel} className={readOnlyClass} />
						</div>
					</div>
				</div>

				{/* Editable fields */}
				<div>
					<p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-3">Editable</p>
					<div className="space-y-4">
						<div>
							<label className={labelClass}>Display Name</label>
							<input
								type="text"
								value={displayName}
								onChange={(e) => setDisplayName(e.target.value)}
								placeholder="Optional friendly name"
								className={inputClass}
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className={labelClass}>Format</label>
								<select value={format} onChange={(e) => setFormat(e.target.value)} className={inputClass}>
									<option value="">Auto-detect</option>
									<option value="raw">raw</option>
									<option value="qcow2">qcow2</option>
									<option value="iso">iso</option>
									<option value="ova">ova</option>
									<option value="vhd">vhd</option>
									<option value="vmdk">vmdk</option>
								</select>
							</div>
							<div>
								<label className={labelClass}>Transfer Mode</label>
								<select value={transferMode} onChange={(e) => setTransferMode(e.target.value)} className={inputClass}>
									<option value="direct">Direct</option>
									<option value="proxy">Proxy</option>
								</select>
							</div>
						</div>
					</div>
				</div>

				{formError && (
					<div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
						<p className="text-red-400 text-sm">{formError}</p>
					</div>
				)}
			</ModalBody>
			<ModalFooter>
				<Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
				<Button onClick={handleSave} disabled={!hasChanges || saving}>
					{saving ? 'Saving...' : 'Save Changes'}
				</Button>
			</ModalFooter>
		</Modal>
	)
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatAge(timestamp: string): string {
	const now = Date.now()
	const created = new Date(timestamp).getTime()
	const diffMs = now - created

	const minutes = Math.floor(diffMs / 60000)
	if (minutes < 1) return 'Just now'
	if (minutes < 60) return `${minutes}m`

	const hours = Math.floor(minutes / 60)
	if (hours < 24) return `${hours}h`

	const days = Math.floor(hours / 24)
	if (days < 30) return `${days}d`

	return new Date(timestamp).toLocaleDateString()
}

// ----------------------------------------------------------------------------
// Icons
// ----------------------------------------------------------------------------

function ImageIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
			/>
		</svg>
	)
}
