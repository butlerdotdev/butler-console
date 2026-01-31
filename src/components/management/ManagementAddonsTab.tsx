// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, Button, Spinner } from '@/components/ui'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useToast } from '@/hooks/useToast'
import {
	addonsApi,
	type AddonDefinition,
	type CategoryInfo,
} from '@/api/addons'
import { gitopsApi } from '@/api/gitops'
import type { Repository, Branch, GitProviderConfig, GitOpsStatus } from '@/types/gitops'


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

	// Git provider state
	const [gitConfig, setGitConfig] = useState<GitProviderConfig | null>(null)
	const [repositories, setRepositories] = useState<Repository[]>([])

	// Management GitOps status (includes configured repository)
	const [mgmtGitOpsStatus, setMgmtGitOpsStatus] = useState<GitOpsStatus | null>(null)

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

	// Fetch git provider config and repositories
	useEffect(() => {
		const fetchGitConfig = async () => {
			try {
				const config = await gitopsApi.getConfig()
				setGitConfig(config)

				if (config.configured) {
					const repos = await gitopsApi.listRepositories()
					setRepositories(repos)
				}
			} catch (err) {
				console.warn('Failed to load git config:', err)
			}
		}
		fetchGitConfig()
	}, [])

	// Fetch management cluster GitOps status (includes configured repository)
	useEffect(() => {
		const fetchMgmtGitOpsStatus = async () => {
			try {
				const status = await gitopsApi.getManagementStatus()
				setMgmtGitOpsStatus(status)
			} catch (err) {
				console.warn('Failed to load management GitOps status:', err)
			}
		}
		fetchMgmtGitOpsStatus()
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

	const handleGitOpsExport = async (addon: AddonDefinition, gitConfig: { repository: string; branch: string; path: string; createPR: boolean }) => {
		try {
			const result = await gitopsApi.exportManagementAddon({
				addonName: addon.name,
				repository: gitConfig.repository,
				branch: gitConfig.branch,
				targetPath: gitConfig.path,
				createPR: gitConfig.createPR,
				prTitle: `Add ${addon.displayName} addon to management cluster`,
			})

			if (result.success) {
				if (result.prUrl) {
					success('Pull Request Created', `${addon.displayName} exported. View PR at ${result.prUrl}`)
				} else {
					success('Exported to GitOps', `${addon.displayName} manifests committed successfully`)
				}
			} else {
				showError('Export Failed', result.message || 'Unknown error')
			}
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

	const handleMigrateToGitOps = async (addon: ManagementAddon, gitConfig: { repository: string; branch: string; path: string; createPR: boolean; helmRepoUrl?: string }) => {
		try {
			// Find the namespace - management addons typically use addon name as namespace
			const releaseNamespace = addon.addon.toLowerCase().includes('system')
				? addon.addon
				: `${addon.addon}-system`

			const result = await gitopsApi.exportManagementRelease({
				releaseName: addon.addon,
				releaseNamespace: releaseNamespace,
				repository: gitConfig.repository,
				branch: gitConfig.branch,
				path: gitConfig.path,
				createPR: gitConfig.createPR,
				prTitle: `Migrate ${addon.addon} to GitOps on management cluster`,
				helmRepoUrl: gitConfig.helmRepoUrl,
			})

			if (result.success) {
				if (result.prUrl) {
					success('Pull Request Created', `${addon.addon} migration PR created`)
				} else {
					success('Migrated to GitOps', `${addon.addon} is now managed by GitOps`)
				}
			} else {
				showError('Migration Failed', result.message || 'Unknown error')
			}
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
			{/* Info Banner - Violet to match Admin theme */}
			<div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
				<div className="flex items-center gap-3">
					<span className="text-xl">ℹ️</span>
					<div>
						<p className="font-medium text-violet-300">Management Cluster Addons</p>
						<p className="text-sm text-violet-400/70">
							These addons are installed directly on the management cluster to provide observability,
							backup, and other platform-level capabilities.
						</p>
					</div>
				</div>
			</div>

			{/* GitOps Status Banner */}
			{gitopsEnabled && (
				<div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center gap-3">
					<span className="text-xl">🔄</span>
					<div>
						<p className="font-medium text-purple-300">GitOps Enabled</p>
						<p className="text-sm text-purple-400/70">
							Addons can be exported to Git via the GitOps tab or the Manage menu on each addon.
						</p>
					</div>
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
					<span className="px-2 py-0.5 text-xs bg-violet-500/10 text-violet-400 rounded">
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
							className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
						/>
					</div>

					<div className="flex gap-2 flex-wrap">
						<button
							onClick={() => setSelectedCategory('all')}
							className={`px-3 py-2 text-sm rounded-lg transition-colors ${selectedCategory === 'all'
								? 'bg-violet-500/20 text-violet-400 border border-violet-500'
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
									? 'bg-violet-500/20 text-violet-400 border border-violet-500'
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
					repositories={repositories}
					configuredRepository={mgmtGitOpsStatus?.repository}
					configuredBranch={mgmtGitOpsStatus?.branch}
					gitConfigured={gitConfig?.configured ?? false}
					onClose={() => setGitopsExportAddon(null)}
					onExport={(config) => handleGitOpsExport(gitopsExportAddon, config)}
				/>
			)}

			{/* Migrate to GitOps Modal */}
			{migrateToGitOps && (
				<MigrateToGitOpsModal
					addon={migrateToGitOps}
					isOpen={!!migrateToGitOps}
					repositories={repositories}
					configuredRepository={mgmtGitOpsStatus?.repository}
					configuredBranch={mgmtGitOpsStatus?.branch}
					gitConfigured={gitConfig?.configured ?? false}
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
					<div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
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
						className="w-full h-64 font-mono text-sm bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
						placeholder="# Enter Helm values in YAML format"
					/>
					{addon.links?.documentation && (
						<p className="text-xs text-neutral-500">
							Refer to the{' '}
							<a
								href={addon.links.documentation}
								target="_blank"
								rel="noopener noreferrer"
								className="text-violet-400 hover:underline"
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
	repositories: Repository[]
	configuredRepository?: string
	configuredBranch?: string
	gitConfigured: boolean
	onClose: () => void
	onExport: (config: { repository: string; branch: string; path: string; createPR: boolean }) => void
}

function GitOpsExportModal({ addon, isOpen, repositories, configuredRepository, configuredBranch, gitConfigured, onClose, onExport }: GitOpsExportModalProps) {
	// Generate correct path based on addon.platform
	const defaultPath = addon.platform
		? `clusters/management/infrastructure/${addon.name}`
		: `clusters/management/apps/${addon.name}`

	const [repository, setRepository] = useState('')
	const [branch, setBranch] = useState('main')
	const [path, setPath] = useState(defaultPath)
	const [createPR, setCreatePR] = useState(true)
	const [branches, setBranches] = useState<Branch[]>([])
	const [loadingBranches, setLoadingBranches] = useState(false)

	// Preview state
	const [preview, setPreview] = useState<Record<string, string> | null>(null)
	const [loadingPreview, setLoadingPreview] = useState(false)

	// Auto-select configured repository when available
	useEffect(() => {
		if (configuredRepository && !repository) {
			setRepository(configuredRepository)
		}
	}, [configuredRepository, repository])

	// Auto-select configured branch when available
	useEffect(() => {
		if (configuredBranch && branch === 'main') {
			setBranch(configuredBranch)
		}
	}, [configuredBranch, branch])

	// Update path when addon changes
	useEffect(() => {
		const newPath = addon.platform
			? `clusters/management/infrastructure/${addon.name}`
			: `clusters/management/apps/${addon.name}`
		setPath(newPath)
	}, [addon])

	// Load branches when repository changes
	useEffect(() => {
		if (!repository) {
			setBranches([])
			return
		}

		const loadBranches = async () => {
			setLoadingBranches(true)
			try {
				const [owner, repo] = repository.split('/')
				if (owner && repo) {
					const branchList = await gitopsApi.listBranches(owner, repo)
					setBranches(branchList)

					// Set default branch if available (but prefer configuredBranch)
					if (!configuredBranch) {
						const defaultBranch = repositories.find(r => r.fullName === repository)?.defaultBranch
						if (defaultBranch) {
							setBranch(defaultBranch)
						}
					}
				}
			} catch (err) {
				console.warn('Failed to load branches:', err)
			} finally {
				setLoadingBranches(false)
			}
		}

		loadBranches()
	}, [repository, repositories, configuredBranch])

	// Toggle preview
	const togglePreview = async () => {
		if (preview) {
			setPreview(null)
			return
		}

		if (!repository) return

		setLoadingPreview(true)
		try {
			const result = await gitopsApi.previewManifests({
				addonName: addon.name,
				repository,
				targetPath: path,
			})
			setPreview(result)
		} catch (err) {
			console.warn('Failed to load preview:', err)
		} finally {
			setLoadingPreview(false)
		}
	}

	if (!gitConfigured) {
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
					<div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
						<p className="text-yellow-300 font-medium mb-2">Git Provider Not Configured</p>
						<p className="text-sm text-neutral-400">
							Please configure a Git provider (GitHub/GitLab) in the GitOps tab before exporting addons.
						</p>
					</div>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={onClose}>Close</Button>
				</ModalFooter>
			</Modal>
		)
	}

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
					{/* Addon Info */}
					<div className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-700">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-neutral-200 font-medium">{addon.displayName}</p>
								<p className="text-sm text-neutral-500">{addon.chartName}:{addon.defaultVersion}</p>
							</div>
							<span className="px-2 py-1 text-xs rounded bg-violet-500/10 text-violet-400">
								From Catalog
							</span>
						</div>
					</div>

					{/* Repository Selection */}
					<div>
						<label className="block text-sm font-medium text-neutral-300 mb-1">
							Target Repository
						</label>
						<select
							value={repository}
							onChange={(e) => setRepository(e.target.value)}
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
						>
							<option value="">Select a repository...</option>
							{repositories.map((repo) => (
								<option key={repo.fullName} value={repo.fullName}>
									{repo.fullName} {repo.private ? '(private)' : ''}
								</option>
							))}
						</select>
					</div>

					{/* Branch and Path */}
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">Branch</label>
							<div className="relative">
								<select
									value={branch}
									onChange={(e) => setBranch(e.target.value)}
									disabled={loadingBranches || branches.length === 0}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
								>
									{branches.length === 0 ? (
										<option value={branch}>{branch}</option>
									) : (
										branches.map((b) => (
											<option key={b.name} value={b.name}>{b.name}</option>
										))
									)}
								</select>
								{loadingBranches && (
									<div className="absolute right-3 top-1/2 -translate-y-1/2">
										<Spinner size="sm" />
									</div>
								)}
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">Path</label>
							<input
								type="text"
								value={path}
								onChange={(e) => setPath(e.target.value)}
								placeholder="clusters/management"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
							/>
						</div>
					</div>

					{/* Create PR option */}
					<label className="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={createPR}
							onChange={(e) => setCreatePR(e.target.checked)}
							className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-violet-500 focus:ring-violet-500"
						/>
						<div>
							<span className="text-neutral-200">Create Pull Request</span>
							<p className="text-xs text-neutral-500">Create a PR for review instead of committing directly</p>
						</div>
					</label>

					{/* Preview Button */}
					{repository && (
						<div className="pt-2">
							<button
								onClick={togglePreview}
								disabled={loadingPreview}
								className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-2"
							>
								{loadingPreview ? (
									<>
										<Spinner size="sm" />
										Loading preview...
									</>
								) : preview ? (
									<>
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
										</svg>
										Hide generated manifests
									</>
								) : (
									<>
										<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
										</svg>
										Preview generated manifests
									</>
								)}
							</button>
						</div>
					)}

					{/* Preview Content */}
					{preview && (
						<div className="border border-neutral-700 rounded-lg overflow-hidden">
							<div className="bg-neutral-800 px-3 py-2 text-sm text-neutral-400 border-b border-neutral-700">
								Generated Files
							</div>
							<div className="max-h-64 overflow-y-auto">
								{Object.entries(preview).map(([filename, content]) => (
									<details key={filename} className="border-b border-neutral-800 last:border-0">
										<summary className="px-3 py-2 text-sm text-neutral-300 cursor-pointer hover:bg-neutral-800/50 flex items-center gap-2">
											<svg className="w-4 h-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
											</svg>
											{filename}
										</summary>
										<pre className="px-3 py-2 bg-neutral-900 text-xs text-neutral-400 overflow-x-auto">
											{content}
										</pre>
									</details>
								))}
							</div>
						</div>
					)}
				</div>
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={onClose}>Cancel</Button>
				<Button
					variant="primary"
					onClick={() => onExport({ repository, branch, path, createPR })}
					disabled={!repository}
				>
					{createPR ? 'Create Pull Request' : 'Export'}
				</Button>
			</ModalFooter>
		</Modal>
	)
}

// Migrate to GitOps Modal

interface MigrateToGitOpsModalProps {
	addon: ManagementAddon
	isOpen: boolean
	repositories: Repository[]
	configuredRepository?: string
	configuredBranch?: string
	gitConfigured: boolean
	onClose: () => void
	onMigrate: (config: { repository: string; branch: string; path: string; createPR: boolean; helmRepoUrl?: string }) => void
}

function MigrateToGitOpsModal({ addon, isOpen, repositories, configuredRepository, configuredBranch, gitConfigured, onClose, onMigrate }: MigrateToGitOpsModalProps) {
	// For installed releases, default to apps/ path (most management addons are apps)
	const defaultPath = `clusters/management/apps/${addon.addon}`

	const [repository, setRepository] = useState('')
	const [branch, setBranch] = useState('main')
	const [path, setPath] = useState(defaultPath)
	const [createPR, setCreatePR] = useState(true)
	const [branches, setBranches] = useState<Branch[]>([])
	const [loadingBranches, setLoadingBranches] = useState(false)
	const [helmRepoUrl, setHelmRepoUrl] = useState('')

	// Auto-select configured repository when available
	useEffect(() => {
		if (configuredRepository && !repository) {
			setRepository(configuredRepository)
		}
	}, [configuredRepository, repository])

	// Auto-select configured branch when available
	useEffect(() => {
		if (configuredBranch && branch === 'main') {
			setBranch(configuredBranch)
		}
	}, [configuredBranch, branch])

	// Update path when addon changes
	useEffect(() => {
		setPath(`clusters/management/apps/${addon.addon}`)
	}, [addon])

	// Load branches when repository changes
	useEffect(() => {
		if (!repository) {
			setBranches([])
			return
		}

		const loadBranches = async () => {
			setLoadingBranches(true)
			try {
				const [owner, repo] = repository.split('/')
				if (owner && repo) {
					const branchList = await gitopsApi.listBranches(owner, repo)
					setBranches(branchList)

					// Set default branch if available (but prefer configuredBranch)
					if (!configuredBranch) {
						const defaultBranch = repositories.find(r => r.fullName === repository)?.defaultBranch
						if (defaultBranch) {
							setBranch(defaultBranch)
						}
					}
				}
			} catch (err) {
				console.warn('Failed to load branches:', err)
			} finally {
				setLoadingBranches(false)
			}
		}

		loadBranches()
	}, [repository, repositories, configuredBranch])

	if (!gitConfigured) {
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
					<div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
						<p className="text-yellow-300 font-medium mb-2">Git Provider Not Configured</p>
						<p className="text-sm text-neutral-400">
							Please configure a Git provider (GitHub/GitLab) in the GitOps tab before migrating addons.
						</p>
					</div>
				</ModalBody>
				<ModalFooter>
					<Button variant="secondary" onClick={onClose}>Close</Button>
				</ModalFooter>
			</Modal>
		)
	}

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
				<div className="space-y-4">
					{/* Warning Banner */}
					<div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
						<p className="text-sm text-yellow-300">
							This will export the current configuration to Git and mark the addon as GitOps-managed.
							Future changes should be made through your Git repository.
						</p>
					</div>

					{/* Repository Selection */}
					<div>
						<label className="block text-sm font-medium text-neutral-300 mb-1">
							Target Repository
						</label>
						<select
							value={repository}
							onChange={(e) => setRepository(e.target.value)}
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
						>
							<option value="">Select a repository...</option>
							{repositories.map((repo) => (
								<option key={repo.fullName} value={repo.fullName}>
									{repo.fullName} {repo.private ? '(private)' : ''}
								</option>
							))}
						</select>
					</div>

					{/* Branch and Path */}
					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">Branch</label>
							<div className="relative">
								<select
									value={branch}
									onChange={(e) => setBranch(e.target.value)}
									disabled={loadingBranches || branches.length === 0}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
								>
									{branches.length === 0 ? (
										<option value={branch}>{branch}</option>
									) : (
										branches.map((b) => (
											<option key={b.name} value={b.name}>{b.name}</option>
										))
									)}
								</select>
								{loadingBranches && (
									<div className="absolute right-3 top-1/2 -translate-y-1/2">
										<Spinner size="sm" />
									</div>
								)}
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">Path</label>
							<input
								type="text"
								value={path}
								onChange={(e) => setPath(e.target.value)}
								placeholder="clusters/management"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
							/>
						</div>
					</div>

					{/* Helm Repo URL - optional for unmatched releases */}
					<div>
						<label className="block text-sm font-medium text-neutral-300 mb-1">
							Helm Repository URL
							<span className="text-neutral-500 ml-1">(optional)</span>
						</label>
						<input
							type="url"
							value={helmRepoUrl}
							onChange={(e) => setHelmRepoUrl(e.target.value)}
							placeholder="https://charts.example.com"
							className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500"
						/>
						<p className="text-xs text-neutral-500 mt-1">
							Override the Helm repository URL if auto-detection fails
						</p>
					</div>

					{/* Create PR option */}
					<label className="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							checked={createPR}
							onChange={(e) => setCreatePR(e.target.checked)}
							className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-violet-500 focus:ring-violet-500"
						/>
						<div>
							<span className="text-neutral-200">Create Pull Request</span>
							<p className="text-xs text-neutral-500">Create a PR for review instead of committing directly</p>
						</div>
					</label>
				</div>
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={onClose}>Cancel</Button>
				<Button
					variant="primary"
					onClick={() => onMigrate({ repository, branch, path, createPR, helmRepoUrl: helmRepoUrl || undefined })}
					disabled={!repository}
				>
					{createPR ? 'Create Pull Request' : 'Migrate'}
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
		'victoria-logs': '📋',
		flux: '🔄',
		argocd: '🐙',
		grafana: '📊',
		loki: '📋',
	}
	return icons[name.toLowerCase()] || '📦'
}
