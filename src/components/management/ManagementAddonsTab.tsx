// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, Button, Spinner } from '@/components/ui'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useToast } from '@/contexts/ToastContext'
import {
	addonsApi,
	type AddonDefinition,
	type CategoryInfo,
} from '@/api/addons'

// Types

interface ManagementAddon {
	name: string
	addon: string
	version?: string
	status: {
		phase: string
		installedVersion?: string
		message?: string
	}
}

interface ManagementAddonsTabProps {
	addons: ManagementAddon[]
	onRefresh?: () => void
}

interface GitOpsConfig {
	repository: string
	branch: string
	path: string
	createPR: boolean
}

// Main Component

export function ManagementAddonsTab({ addons, onRefresh }: ManagementAddonsTabProps) {
	const { success, error: showError } = useToast()
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedCategory, setSelectedCategory] = useState<string>('all')

	// Catalog state
	const [catalog, setCatalog] = useState<AddonDefinition[]>([])
	const [categories, setCategories] = useState<CategoryInfo[]>([])
	const [catalogLoading, setCatalogLoading] = useState(true)
	const [catalogError, setCatalogError] = useState<string | null>(null)

	// Modal states
	const [configureAddon, setConfigureAddon] = useState<AddonDefinition | null>(null)
	const [gitopsExportAddon, setGitopsExportAddon] = useState<AddonDefinition | null>(null)
	const [installingAddon, setInstallingAddon] = useState<string | null>(null)
	const [migrateToGitOps, setMigrateToGitOps] = useState<ManagementAddon | null>(null)

	// Check if GitOps is enabled (Flux or ArgoCD installed)
	const gitopsEnabled = useMemo(() => {
		return addons.some(a =>
			a.addon.toLowerCase() === 'flux' || a.addon.toLowerCase() === 'argocd'
		)
	}, [addons])

	// Fetch catalog
	useEffect(() => {
		const fetchCatalog = async () => {
			setCatalogLoading(true)
			setCatalogError(null)
			try {
				const response = await addonsApi.getCatalog()
				setCatalog(response.addons)
				setCategories(response.categories)
			} catch (err) {
				setCatalogError(err instanceof Error ? err.message : 'Failed to load addon catalog')
			} finally {
				setCatalogLoading(false)
			}
		}
		fetchCatalog()
	}, [])

	// Filter to non-platform addons (management cluster addons)
	const optionalCatalog = useMemo(() => {
		return catalog.filter(a => !a.platform)
	}, [catalog])

	const optionalCategories = useMemo(() => {
		const optionalCategoryNames = new Set(optionalCatalog.map(a => a.category))
		return categories.filter(c => optionalCategoryNames.has(c.name))
	}, [optionalCatalog, categories])

	// Installed addon names
	const installedAddonNames = useMemo(() => {
		return new Set(addons.map(a => a.addon.toLowerCase()))
	}, [addons])

	// Get catalog info for installed addons
	const installedWithCatalog = useMemo(() => {
		return addons.map(addon => {
			const catalogInfo = optionalCatalog.find(c => c.name.toLowerCase() === addon.addon.toLowerCase())
			return { addon, catalogInfo }
		})
	}, [addons, optionalCatalog])

	// Filter available addons
	const availableCatalog = useMemo(() => {
		return optionalCatalog.filter((addon) => {
			if (installedAddonNames.has(addon.name.toLowerCase())) return false

			const matchesSearch = searchQuery === '' ||
				addon.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				addon.description.toLowerCase().includes(searchQuery.toLowerCase())

			const matchesCategory = selectedCategory === 'all' || addon.category === selectedCategory

			return matchesSearch && matchesCategory
		})
	}, [optionalCatalog, installedAddonNames, searchQuery, selectedCategory])

	// Group by category
	const groupedAvailableCatalog = useMemo(() => {
		const groups: Record<string, AddonDefinition[]> = {}
		optionalCategories.forEach(cat => { groups[cat.name] = [] })
		availableCatalog.forEach((addon) => {
			if (groups[addon.category]) groups[addon.category].push(addon)
		})
		return groups
	}, [availableCatalog, optionalCategories])

	const handleQuickInstall = async (addon: AddonDefinition) => {
		setInstallingAddon(addon.name)
		try {
			await addonsApi.installManagementAddon({
				name: addon.name,
				addon: addon.name,
			})
			success('Addon Installing', `${addon.displayName} installation initiated`)
			onRefresh?.()
		} catch (err) {
			showError('Installation Failed', err instanceof Error ? err.message : 'Failed to install addon')
		} finally {
			setInstallingAddon(null)
		}
	}

	const handleConfiguredInstall = async (addon: AddonDefinition, values: Record<string, unknown>) => {
		setInstallingAddon(addon.name)
		try {
			await addonsApi.installManagementAddon({
				name: addon.name,
				addon: addon.name,
				values,
			})
			success('Addon Installing', `${addon.displayName} installation initiated with custom configuration`)
			setConfigureAddon(null)
			onRefresh?.()
		} catch (err) {
			showError('Installation Failed', err instanceof Error ? err.message : 'Failed to install addon')
		} finally {
			setInstallingAddon(null)
		}
	}

	const handleGitOpsExport = async (addon: AddonDefinition, gitConfig: GitOpsConfig) => {
		try {
			// TODO: Implement actual GitOps export API call
			success('Exported to GitOps', `${addon.displayName} manifests exported to ${gitConfig.repository}`)
			setGitopsExportAddon(null)
		} catch (err) {
			showError('Export Failed', err instanceof Error ? err.message : 'Failed to export to GitOps')
		}
	}

	const handleUninstall = async (addon: ManagementAddon) => {
		try {
			await addonsApi.uninstallManagementAddon(addon.name)
			success('Addon Removed', `${addon.addon} has been uninstalled`)
			onRefresh?.()
		} catch (err) {
			showError('Uninstall Failed', err instanceof Error ? err.message : 'Failed to uninstall addon')
		}
	}

	const handleMigrateToGitOps = async (addon: ManagementAddon, _gitConfig: GitOpsConfig) => {
		try {
			success('Migrated to GitOps', `${addon.addon} is now managed by GitOps`)
			setMigrateToGitOps(null)
			onRefresh?.()
		} catch (err) {
			showError('Migration Failed', err instanceof Error ? err.message : 'Failed to migrate to GitOps')
		}
	}

	if (catalogLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner size="lg" />
				<span className="ml-3 text-neutral-400">Loading addon catalog...</span>
			</div>
		)
	}

	if (catalogError) {
		return (
			<Card className="p-8 text-center">
				<p className="text-red-400 mb-4">Failed to load addon catalog</p>
				<p className="text-neutral-500 text-sm mb-4">{catalogError}</p>
				<Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>
			</Card>
		)
	}

	return (
		<div className="space-y-8">
			{/* Info Banner */}
			<div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
				<div className="flex items-center gap-3">
					<span className="text-xl">ℹ️</span>
					<div>
						<p className="font-medium text-blue-300">Management Cluster Addons</p>
						<p className="text-sm text-blue-400/70">
							These addons are installed directly on the management cluster to provide observability,
							backup, and other platform-level capabilities.
						</p>
					</div>
				</div>
			</div>

			{/* GitOps Status Banner */}
			{gitopsEnabled && (
				<div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center justify-between">
					<div className="flex items-center gap-3">
						<span className="text-xl">🔄</span>
						<div>
							<p className="font-medium text-purple-300">GitOps Enabled</p>
							<p className="text-sm text-purple-400/70">
								New addons can be managed via GitOps for full audit trail and declarative control.
							</p>
						</div>
					</div>
					<Button variant="secondary" size="sm">
						Migrate All to GitOps
					</Button>
				</div>
			)}

			{/* Installed Addons */}
			{addons.length > 0 && (
				<div>
					<div className="flex items-center gap-2 mb-4">
						<h3 className="text-lg font-medium text-neutral-50">Installed Addons</h3>
						<span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-400 rounded">
							{addons.length} Active
						</span>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{installedWithCatalog.map(({ addon, catalogInfo }) => (
							<InstalledAddonCard
								key={addon.name}
								addon={addon}
								catalogInfo={catalogInfo}
								gitopsEnabled={gitopsEnabled}
								onConfigure={() => catalogInfo && setConfigureAddon(catalogInfo)}
								onUninstall={() => handleUninstall(addon)}
								onMigrateToGitOps={() => setMigrateToGitOps(addon)}
							/>
						))}
					</div>
				</div>
			)}

			{/* Available Addons */}
			<div>
				<div className="flex items-center gap-2 mb-4">
					<h3 className="text-lg font-medium text-neutral-50">Available Addons</h3>
					<span className="px-2 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded">
						{availableCatalog.length} Available
					</span>
				</div>

				{/* Search and Filter */}
				<div className="flex flex-col sm:flex-row gap-4 mb-6">
					<div className="relative flex-1">
						<svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						<input
							type="text"
							placeholder="Search addons..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>

					<div className="flex gap-2 flex-wrap">
						<button
							onClick={() => setSelectedCategory('all')}
							className={`px-3 py-2 text-sm rounded-lg transition-colors ${selectedCategory === 'all'
								? 'bg-green-500/20 text-green-400 border border-green-500'
								: 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
								}`}
						>
							All
						</button>
						{optionalCategories.map((cat) => (
							<button
								key={cat.name}
								onClick={() => setSelectedCategory(cat.name)}
								className={`px-3 py-2 text-sm rounded-lg transition-colors ${selectedCategory === cat.name
									? 'bg-green-500/20 text-green-400 border border-green-500'
									: 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:border-neutral-600'
									}`}
							>
								{cat.icon} {cat.displayName}
							</button>
						))}
					</div>
				</div>

				{availableCatalog.length === 0 ? (
					<Card className="p-8 text-center">
						<p className="text-neutral-400">
							{searchQuery || selectedCategory !== 'all'
								? 'No addons match your search'
								: 'All available addons are installed'}
						</p>
					</Card>
				) : (
					<div className="space-y-8">
						{optionalCategories.map((category) => {
							const categoryAddons = groupedAvailableCatalog[category.name] || []
							if (categoryAddons.length === 0) return null

							return (
								<div key={category.name}>
									<div className="flex items-center gap-2 mb-2">
										<span className="text-xl">{category.icon}</span>
										<h4 className="text-md font-medium text-neutral-200">{category.displayName}</h4>
									</div>
									<p className="text-sm text-neutral-500 mb-4">{category.description}</p>

									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
										{categoryAddons.map((catalogItem) => (
											<AvailableAddonCard
												key={catalogItem.name}
												catalog={catalogItem}
												installing={installingAddon === catalogItem.name}
												gitopsEnabled={gitopsEnabled}
												onQuickInstall={() => handleQuickInstall(catalogItem)}
												onConfigureInstall={() => setConfigureAddon(catalogItem)}
												onGitOpsExport={() => setGitopsExportAddon(catalogItem)}
											/>
										))}
									</div>
								</div>
							)
						})}
					</div>
				)}
			</div>

			{/* Configure Modal */}
			{configureAddon && (
				<ConfigureModal
					addon={configureAddon}
					isOpen={!!configureAddon}
					onClose={() => setConfigureAddon(null)}
					onInstall={(values) => handleConfiguredInstall(configureAddon, values)}
					installing={installingAddon === configureAddon.name}
				/>
			)}

			{/* GitOps Export Modal */}
			{gitopsExportAddon && (
				<GitOpsExportModal
					addon={gitopsExportAddon}
					isOpen={!!gitopsExportAddon}
					onClose={() => setGitopsExportAddon(null)}
					onExport={(config) => handleGitOpsExport(gitopsExportAddon, config)}
				/>
			)}

			{/* Migrate to GitOps Modal */}
			{migrateToGitOps && (
				<MigrateToGitOpsModal
					addon={migrateToGitOps}
					isOpen={!!migrateToGitOps}
					onClose={() => setMigrateToGitOps(null)}
					onMigrate={(config) => handleMigrateToGitOps(migrateToGitOps, config)}
				/>
			)}
		</div>
	)
}

// Installed Addon Card

interface InstalledAddonCardProps {
	addon: ManagementAddon
	catalogInfo?: AddonDefinition
	gitopsEnabled: boolean
	onConfigure: () => void
	onUninstall: () => void
	onMigrateToGitOps: () => void
}

function InstalledAddonCard({
	addon,
	catalogInfo,
	gitopsEnabled,
	onConfigure,
	onUninstall,
	onMigrateToGitOps,
}: InstalledAddonCardProps) {
	const [menuOpen, setMenuOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setMenuOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	const statusColor = addon.status.phase === 'Installed' ? 'text-green-400' : 'text-yellow-400'
	const statusBg = addon.status.phase === 'Installed' ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'
	const icon = catalogInfo?.icon || getAddonIcon(addon.addon)

	return (
		<Card className="p-4 hover:border-neutral-600 transition-colors border-green-500/20">
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
						<span className="text-xl">{icon}</span>
					</div>
					<div>
						<h4 className="font-medium text-neutral-100">
							{catalogInfo?.displayName || addon.addon}
						</h4>
						<p className="text-xs text-neutral-500">{addon.status.installedVersion || addon.version || 'Unknown'}</p>
					</div>
				</div>
				<span className={`px-2 py-1 text-xs rounded-full ${statusBg} ${statusColor}`}>
					{addon.status.phase}
				</span>
			</div>

			{catalogInfo?.description && (
				<p className="text-sm text-neutral-400 mb-4 line-clamp-2">{catalogInfo.description}</p>
			)}

			<div className="relative" ref={menuRef}>
				<Button
					variant="secondary"
					size="sm"
					className="w-full justify-between"
					onClick={() => setMenuOpen(!menuOpen)}
				>
					Manage
					<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</Button>

				{menuOpen && (
					<div className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-10 overflow-hidden">
						{catalogInfo && (
							<button
								onClick={() => { setMenuOpen(false); onConfigure() }}
								className="w-full px-4 py-2 text-left hover:bg-neutral-700/50 transition-colors"
							>
								<div className="flex items-center gap-3">
									<span className="text-lg">⚙️</span>
									<div>
										<p className="text-sm font-medium text-neutral-200">Configure</p>
										<p className="text-xs text-neutral-500">Update Helm values</p>
									</div>
								</div>
							</button>
						)}
						{gitopsEnabled && (
							<button
								onClick={() => { setMenuOpen(false); onMigrateToGitOps() }}
								className="w-full px-4 py-2 text-left hover:bg-neutral-700/50 transition-colors"
							>
								<div className="flex items-center gap-3">
									<span className="text-lg">🔄</span>
									<div>
										<p className="text-sm font-medium text-neutral-200">Migrate to GitOps</p>
										<p className="text-xs text-neutral-500">Hand off management to Flux/ArgoCD</p>
									</div>
								</div>
							</button>
						)}
						<button
							onClick={() => { setMenuOpen(false); onUninstall() }}
							className="w-full px-4 py-2 text-left hover:bg-red-500/10 transition-colors"
						>
							<div className="flex items-center gap-3">
								<span className="text-lg">🗑️</span>
								<div>
									<p className="text-sm font-medium text-red-400">Uninstall</p>
									<p className="text-xs text-neutral-500">Remove this addon</p>
								</div>
							</div>
						</button>
					</div>
				)}
			</div>
		</Card>
	)
}

// Available Addon Card

interface AvailableAddonCardProps {
	catalog: AddonDefinition
	installing: boolean
	gitopsEnabled: boolean
	onQuickInstall: () => void
	onConfigureInstall: () => void
	onGitOpsExport: () => void
}

function AvailableAddonCard({
	catalog,
	installing,
	gitopsEnabled: _gitopsEnabled,
	onQuickInstall,
	onConfigureInstall,
	onGitOpsExport,
}: AvailableAddonCardProps) {
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setDropdownOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [])

	return (
		<Card className="p-4 hover:border-neutral-600 transition-colors">
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
						<span className="text-xl">{catalog.icon || '📦'}</span>
					</div>
					<div>
						<h4 className="font-medium text-neutral-100">{catalog.displayName}</h4>
						<p className="text-xs text-neutral-500">{catalog.defaultVersion}</p>
					</div>
				</div>
			</div>

			<p className="text-sm text-neutral-400 mb-4 line-clamp-2">{catalog.description}</p>

			{/* Dependencies */}
			{catalog.dependsOn && catalog.dependsOn.length > 0 && (
				<div className="mb-3">
					<span className="text-xs text-neutral-500">Requires: </span>
					{catalog.dependsOn.map((dep, i) => (
						<span key={dep} className="text-xs text-neutral-400">
							{dep}{i < catalog.dependsOn!.length - 1 ? ', ' : ''}
						</span>
					))}
				</div>
			)}

			{/* Links */}
			{catalog.links && (
				<div className="flex gap-3 mb-4 text-xs">
					{catalog.links.documentation && (
						<a href={catalog.links.documentation} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300">
							Docs ↗
						</a>
					)}
					{catalog.links.homepage && (
						<a href={catalog.links.homepage} target="_blank" rel="noopener noreferrer" className="text-neutral-500 hover:text-neutral-300">
							Homepage ↗
						</a>
					)}
				</div>
			)}

			<div className="relative" ref={dropdownRef}>
				<div className="flex">
					<Button
						variant="primary"
						size="sm"
						className="flex-1 rounded-r-none"
						onClick={onQuickInstall}
						disabled={installing}
					>
						{installing ? <><Spinner size="sm" className="mr-2" />Installing...</> : 'Install'}
					</Button>
					<Button
						variant="primary"
						size="sm"
						className="rounded-l-none border-l border-green-600 px-2"
						onClick={() => setDropdownOpen(!dropdownOpen)}
						disabled={installing}
					>
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
						</svg>
					</Button>
				</div>

				{dropdownOpen && (
					<div className="absolute top-full left-0 right-0 mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-10 overflow-hidden">
						<button
							onClick={() => { setDropdownOpen(false); onQuickInstall() }}
							className="w-full px-4 py-2 text-left hover:bg-neutral-700/50 transition-colors"
						>
							<div className="flex items-center gap-3">
								<span className="text-lg">⚡</span>
								<div>
									<p className="text-sm font-medium text-neutral-200">Quick Install</p>
									<p className="text-xs text-neutral-500">Install with default settings</p>
								</div>
							</div>
						</button>
						<button
							onClick={() => { setDropdownOpen(false); onConfigureInstall() }}
							className="w-full px-4 py-2 text-left hover:bg-neutral-700/50 transition-colors"
						>
							<div className="flex items-center gap-3">
								<span className="text-lg">⚙️</span>
								<div>
									<p className="text-sm font-medium text-neutral-200">Configure & Install</p>
									<p className="text-xs text-neutral-500">Customize Helm values before installing</p>
								</div>
							</div>
						</button>
						<button
							onClick={() => { setDropdownOpen(false); onGitOpsExport() }}
							className="w-full px-4 py-2 text-left hover:bg-neutral-700/50 transition-colors"
						>
							<div className="flex items-center gap-3">
								<span className="text-lg">📦</span>
								<div>
									<p className="text-sm font-medium text-neutral-200">Export to GitOps</p>
									<p className="text-xs text-neutral-500">Generate manifests for Flux/ArgoCD</p>
								</div>
							</div>
						</button>
					</div>
				)}
			</div>
		</Card>
	)
}

// Configure Modal

interface ConfigureModalProps {
	addon: AddonDefinition
	isOpen: boolean
	onClose: () => void
	onInstall: (values: Record<string, unknown>) => void
	installing: boolean
}

function ConfigureModal({ addon, isOpen, onClose, onInstall, installing }: ConfigureModalProps) {
	const [yamlContent, setYamlContent] = useState('# Enter custom Helm values\n')

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="lg">
			<ModalHeader>
				<div className="flex items-center gap-3">
					<span className="text-2xl">{addon.icon || '📦'}</span>
					<div>
						<h2 className="text-lg font-semibold">Configure {addon.displayName}</h2>
						<p className="text-sm text-neutral-400">Version {addon.defaultVersion}</p>
					</div>
				</div>
			</ModalHeader>
			<ModalBody>
				<div className="space-y-4">
					<p className="text-sm text-neutral-400">
						Enter custom Helm values in YAML format to customize the addon installation.
					</p>
					<textarea
						value={yamlContent}
						onChange={(e) => setYamlContent(e.target.value)}
						className="w-full h-64 font-mono text-sm bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						placeholder="# Enter Helm values in YAML format"
					/>
					{addon.links?.documentation && (
						<p className="text-xs text-neutral-500">
							Refer to the{' '}
							<a
								href={addon.links.documentation}
								target="_blank"
								rel="noopener noreferrer"
								className="text-green-400 hover:underline"
							>
								documentation
							</a>
							{' '}for available configuration options.
						</p>
					)}
				</div>
			</ModalBody>
			<ModalFooter>
				<Button variant="secondary" onClick={onClose} disabled={installing}>Cancel</Button>
				<Button variant="primary" onClick={() => onInstall({})} disabled={installing}>
					{installing ? <><Spinner size="sm" className="mr-2" />Installing...</> : 'Install'}
				</Button>
			</ModalFooter>
		</Modal>
	)
}

// GitOps Export Modal

interface GitOpsExportModalProps {
	addon: AddonDefinition
	isOpen: boolean
	onClose: () => void
	onExport: (config: GitOpsConfig) => void
}

function GitOpsExportModal({ addon, isOpen, onClose, onExport }: GitOpsExportModalProps) {
	const [config, setConfig] = useState<GitOpsConfig>({
		repository: '',
		branch: 'main',
		path: `clusters/management/addons/${addon.name}`,
		createPR: true,
	})

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalHeader>
				<div className="flex items-center gap-3">
					<span className="text-2xl">📦</span>
					<div>
						<h2 className="text-lg font-semibold">Export to GitOps</h2>
						<p className="text-sm text-neutral-400">{addon.displayName}</p>
					</div>
				</div>
			</ModalHeader>

			<ModalBody>
				<div className="space-y-4">
					<p className="text-sm text-neutral-400 mb-4">
						Generate Kubernetes manifests for {addon.displayName} to be managed by Flux or ArgoCD.
					</p>

					<div>
						<label className="block text-sm text-neutral-200 mb-1">Git Repository</label>
						<input
							type="text"
							value={config.repository}
							onChange={(e) => setConfig({ ...config, repository: e.target.value })}
							placeholder="https://github.com/org/repo"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>

					<div>
						<label className="block text-sm text-neutral-200 mb-1">Branch</label>
						<input
							type="text"
							value={config.branch}
							onChange={(e) => setConfig({ ...config, branch: e.target.value })}
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>

					<div>
						<label className="block text-sm text-neutral-200 mb-1">Path</label>
						<input
							type="text"
							value={config.path}
							onChange={(e) => setConfig({ ...config, path: e.target.value })}
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>

					<label className="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={config.createPR}
							onChange={(e) => setConfig({ ...config, createPR: e.target.checked })}
							className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
						/>
						<span className="text-sm text-neutral-200">Create Pull Request</span>
					</label>
				</div>
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={onClose}>
					Cancel
				</Button>
				<Button variant="primary" onClick={() => onExport(config)} disabled={!config.repository}>
					Export
				</Button>
			</ModalFooter>
		</Modal>
	)
}

// Migrate to GitOps Modal

interface MigrateToGitOpsModalProps {
	addon: ManagementAddon
	isOpen: boolean
	onClose: () => void
	onMigrate: (config: GitOpsConfig) => void
}

function MigrateToGitOpsModal({ addon, isOpen, onClose, onMigrate }: MigrateToGitOpsModalProps) {
	const [config, setConfig] = useState<GitOpsConfig>({
		repository: '',
		branch: 'main',
		path: `clusters/management/addons/${addon.addon}`,
		createPR: true,
	})

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalHeader>
				<div className="flex items-center gap-3">
					<span className="text-2xl">🔄</span>
					<div>
						<h2 className="text-lg font-semibold">Migrate to GitOps</h2>
						<p className="text-sm text-neutral-400">{addon.addon}</p>
					</div>
				</div>
			</ModalHeader>

			<ModalBody>
				<div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
					<p className="text-sm text-yellow-300">
						This will export the current configuration to Git and mark the addon as GitOps-managed.
						Future changes should be made through your Git repository.
					</p>
				</div>

				<div className="space-y-4">
					<div>
						<label className="block text-sm text-neutral-200 mb-1">Git Repository</label>
						<input
							type="text"
							value={config.repository}
							onChange={(e) => setConfig({ ...config, repository: e.target.value })}
							placeholder="https://github.com/org/repo"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>

					<div>
						<label className="block text-sm text-neutral-200 mb-1">Branch</label>
						<input
							type="text"
							value={config.branch}
							onChange={(e) => setConfig({ ...config, branch: e.target.value })}
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>

					<div>
						<label className="block text-sm text-neutral-200 mb-1">Path</label>
						<input
							type="text"
							value={config.path}
							onChange={(e) => setConfig({ ...config, path: e.target.value })}
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
						/>
					</div>

					<label className="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={config.createPR}
							onChange={(e) => setConfig({ ...config, createPR: e.target.checked })}
							className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
						/>
						<span className="text-sm text-neutral-200">Create Pull Request</span>
					</label>
				</div>
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={onClose}>
					Cancel
				</Button>
				<Button variant="primary" onClick={() => onMigrate(config)} disabled={!config.repository}>
					Migrate
				</Button>
			</ModalFooter>
		</Modal>
	)
}

// Helpers

function getAddonIcon(name: string): string {
	const icons: Record<string, string> = {
		velero: '🛡️',
		'prometheus-operator': '🔥',
		tempo: '🔍',
		jaeger: '🔎',
		'victoria-metrics': '📊',
		'victoria-logs': '📝',
		flux: '🔄',
		argocd: '🐙',
		grafana: '📊',
		loki: '📋',
	}
	return icons[name.toLowerCase()] || '📦'
}
