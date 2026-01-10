// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useMemo, useRef, useEffect } from 'react'
import { Card, Button, Spinner } from '@/components/ui'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useToast } from '@/contexts/ToastContext'
import {
	addonsApi,
	type InstalledAddon,
	type AddonDefinition,
	type CategoryInfo,
} from '@/api/addons'

// Types

interface SchemaField {
	path: string
	label: string
	type: 'string' | 'number' | 'boolean' | 'select'
	description?: string
	required?: boolean
	placeholder?: string
	options?: { label: string; value: string }[]
}

interface SchemaSection {
	name: string
	title: string
	important?: boolean
	fields: SchemaField[]
}

interface ValuesSchema {
	sections: SchemaSection[]
	defaults: Record<string, unknown>
}

interface GitOpsConfig {
	repository: string
	branch: string
	path: string
	createPR: boolean
}

interface AddonsTabProps {
	clusterNamespace: string
	clusterName: string
	addons: InstalledAddon[]
	onRefresh?: () => void
}

// Main Component

export function AddonsTab({ clusterNamespace, clusterName, addons, onRefresh }: AddonsTabProps) {
	const { success, error: showError } = useToast()
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedCategory, setSelectedCategory] = useState<string>('all')

	// Catalog state - fetched from API
	const [catalog, setCatalog] = useState<AddonDefinition[]>([])
	const [categories, setCategories] = useState<CategoryInfo[]>([])
	const [catalogLoading, setCatalogLoading] = useState(true)
	const [catalogError, setCatalogError] = useState<string | null>(null)

	// Modal states
	const [configureAddon, setConfigureAddon] = useState<AddonDefinition | null>(null)
	const [gitopsExportAddon, setGitopsExportAddon] = useState<AddonDefinition | null>(null)
	const [installingAddon, setInstallingAddon] = useState<string | null>(null)
	const [migrateToGitOps, setMigrateToGitOps] = useState<InstalledAddon | null>(null)

	// Fetch catalog from API
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

	// Separate platform and optional addons from catalog
	const platformAddonNames = useMemo(() => {
		return catalog.filter(a => a.platform).map(a => a.name.toLowerCase())
	}, [catalog])

	const optionalCatalog = useMemo(() => {
		return catalog.filter(a => !a.platform)
	}, [catalog])

	// Get unique categories for optional addons
	const optionalCategories = useMemo(() => {
		const optionalCategoryNames = new Set(optionalCatalog.map(a => a.category))
		return categories.filter(c => optionalCategoryNames.has(c.name))
	}, [optionalCatalog, categories])

	// Check if GitOps is enabled on this cluster
	const gitopsEnabled = addons.some(a =>
		a.name.toLowerCase() === 'flux' || a.name.toLowerCase() === 'argocd'
	)

	// Separate platform and optional addons from installed
	const platformAddons = addons.filter((a) =>
		platformAddonNames.includes(a.name.toLowerCase())
	)

	const installedOptionalAddons = addons.filter((a) =>
		!platformAddonNames.includes(a.name.toLowerCase())
	)

	// Get installed addon names for filtering
	const installedAddonNames = useMemo(() => {
		return new Set(installedOptionalAddons.map(a => a.name.toLowerCase()))
	}, [installedOptionalAddons])

	// Get catalog info for installed optional addons
	const installedOptionalWithCatalog = useMemo(() => {
		return installedOptionalAddons.map(addon => {
			const catalogInfo = optionalCatalog.find(c => c.name.toLowerCase() === addon.name.toLowerCase())
			return { addon, catalogInfo }
		})
	}, [installedOptionalAddons, optionalCatalog])

	// Filter AVAILABLE (not installed) optional addons by search and category
	const availableCatalog = useMemo(() => {
		return optionalCatalog.filter((addon) => {
			// Exclude already installed addons
			if (installedAddonNames.has(addon.name.toLowerCase())) return false

			const matchesSearch = searchQuery === '' ||
				addon.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				addon.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
				addon.name.toLowerCase().includes(searchQuery.toLowerCase())

			const matchesCategory = selectedCategory === 'all' || addon.category === selectedCategory

			return matchesSearch && matchesCategory
		})
	}, [optionalCatalog, installedAddonNames, searchQuery, selectedCategory])

	// Group available catalog by category
	const groupedAvailableCatalog = useMemo(() => {
		const groups: Record<string, AddonDefinition[]> = {}
		optionalCategories.forEach(cat => {
			groups[cat.name] = []
		})
		availableCatalog.forEach((addon) => {
			if (groups[addon.category]) {
				groups[addon.category].push(addon)
			}
		})
		return groups
	}, [availableCatalog, optionalCategories])

	const handleQuickInstall = async (addon: AddonDefinition) => {
		setInstallingAddon(addon.name)
		try {
			await addonsApi.install(clusterNamespace, clusterName, {
				addon: addon.name,
			})
			success('Addon Installing', `${addon.displayName} installation initiated with default settings`)
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
			await addonsApi.install(clusterNamespace, clusterName, {
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
			success('Exported to GitOps', `${addon.displayName} manifests exported`)
			setGitopsExportAddon(null)
			onRefresh?.()
		} catch (err) {
			showError('Export Failed', err instanceof Error ? err.message : 'Failed to export to GitOps')
		}
	}

	const handleUninstall = async (addon: InstalledAddon) => {
		if (addon.managedBy === 'gitops') {
			showError('GitOps Managed', 'This addon is managed by GitOps. Remove it from your Git repository.')
			return
		}
		try {
			await addonsApi.uninstall(clusterNamespace, clusterName, addon.name)
			success('Addon Removed', `${addon.name} has been uninstalled`)
			onRefresh?.()
		} catch (err) {
			showError('Uninstall Failed', err instanceof Error ? err.message : 'Failed to uninstall addon')
		}
	}

	const handleMigrateToGitOps = async (addon: InstalledAddon, gitConfig: GitOpsConfig) => {
		try {
			success('Migrated to GitOps', `${addon.name} is now managed by GitOps`)
			setMigrateToGitOps(null)
			onRefresh?.()
		} catch (err) {
			showError('Migration Failed', err instanceof Error ? err.message : 'Failed to migrate to GitOps')
		}
	}

	// Loading state
	if (catalogLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner size="lg" />
				<span className="ml-3 text-neutral-400">Loading addon catalog...</span>
			</div>
		)
	}

	// Error state
	if (catalogError) {
		return (
			<Card className="p-8 text-center">
				<p className="text-red-400 mb-4">Failed to load addon catalog</p>
				<p className="text-neutral-500 text-sm mb-4">{catalogError}</p>
				<Button variant="secondary" onClick={() => window.location.reload()}>
					Retry
				</Button>
			</Card>
		)
	}

	return (
		<div className="space-y-8">
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

			{/* Platform Addons Section */}
			<div>
				<div className="flex items-center gap-2 mb-4">
					<h3 className="text-lg font-medium text-neutral-50">Platform Addons</h3>
					<span className="px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 rounded">Core</span>
				</div>
				<p className="text-sm text-neutral-500 mb-4">
					Essential components installed during cluster bootstrap. These cannot be removed via the UI.
				</p>

				{platformAddons.length === 0 ? (
					<Card className="p-6 text-center">
						<p className="text-neutral-400">No platform addons detected</p>
					</Card>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{platformAddons.map((addon) => (
							<PlatformAddonCard key={addon.name} addon={addon} />
						))}
					</div>
				)}
			</div>

			{/* Installed Optional Addons Section */}
			{installedOptionalAddons.length > 0 && (
				<div>
					<div className="flex items-center gap-2 mb-4">
						<h3 className="text-lg font-medium text-neutral-50">Installed Addons</h3>
						<span className="px-2 py-0.5 text-xs bg-green-500/10 text-green-400 rounded">
							{installedOptionalAddons.length} Active
						</span>
					</div>
					<p className="text-sm text-neutral-500 mb-4">
						Optional addons currently running on this cluster.
					</p>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{installedOptionalWithCatalog.map(({ addon, catalogInfo }) => (
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

			{/* Available Addons Section */}
			<div>
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<h3 className="text-lg font-medium text-neutral-50">Available Addons</h3>
						<span className="px-2 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded">
							{availableCatalog.length} Available
						</span>
					</div>
				</div>
				<p className="text-sm text-neutral-500 mb-4">
					Additional functionality you can enable for this cluster.
				</p>

				{/* Search and Filter */}
				<div className="flex flex-col sm:flex-row gap-4 mb-6">
					<div className="relative flex-1">
						<svg
							className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
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

				{/* Addon Categories */}
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

			{/* Configure & Install Modal */}
			{configureAddon && (
				<ConfigureAddonModal
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

// Platform Addon Card (Read-only)

function PlatformAddonCard({ addon }: { addon: InstalledAddon }) {
	const statusColor = getStatusColor(addon.status)
	const statusBg = getStatusBgColor(addon.status)

	return (
		<Card className="p-4 hover:border-neutral-600 transition-colors">
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
						<span className="text-xl">{getPlatformAddonIcon(addon.name)}</span>
					</div>
					<div>
						<h4 className="font-medium text-neutral-100">{addon.displayName || addon.name}</h4>
						<p className="text-xs text-neutral-500">{addon.version || 'Unknown version'}</p>
					</div>
				</div>
				<span className={`px-2 py-1 text-xs rounded-full ${statusBg} ${statusColor}`}>
					{addon.status}
				</span>
			</div>
		</Card>
	)
}

// Installed Addon Card (with manage options)

interface InstalledAddonCardProps {
	addon: InstalledAddon
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

	const statusColor = getStatusColor(addon.status)
	const statusBg = getStatusBgColor(addon.status)
	const icon = catalogInfo?.icon || getOptionalAddonIcon(addon.name)

	return (
		<Card className="p-4 hover:border-neutral-600 transition-colors border-green-500/20">
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
						<span className="text-xl">{icon}</span>
					</div>
					<div>
						<h4 className="font-medium text-neutral-100">
							{catalogInfo?.displayName || addon.displayName || addon.name}
						</h4>
						<p className="text-xs text-neutral-500">{addon.version || 'Unknown version'}</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<span className={`px-2 py-1 text-xs rounded-full ${statusBg} ${statusColor}`}>
						{addon.status}
					</span>
					{addon.managedBy === 'gitops' && (
						<span className="px-2 py-1 text-xs rounded-full bg-purple-500/10 text-purple-400">
							GitOps
						</span>
					)}
				</div>
			</div>

			{catalogInfo?.description && (
				<p className="text-sm text-neutral-400 mb-4 line-clamp-2">{catalogInfo.description}</p>
			)}

			{/* Manage Button */}
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
							<DropdownOption
								icon="⚙️"
								label="Configure"
								description="Update Helm values"
								onClick={() => {
									setMenuOpen(false)
									onConfigure()
								}}
							/>
						)}
						{gitopsEnabled && addon.managedBy !== 'gitops' && (
							<DropdownOption
								icon="🔄"
								label="Migrate to GitOps"
								description="Hand off management to Flux/ArgoCD"
								onClick={() => {
									setMenuOpen(false)
									onMigrateToGitOps()
								}}
							/>
						)}
						<DropdownOption
							icon="🗑️"
							label="Uninstall"
							description="Remove this addon"
							onClick={() => {
								setMenuOpen(false)
								onUninstall()
							}}
							destructive
						/>
					</div>
				)}
			</div>
		</Card>
	)
}

// Available Addon Card (not installed)

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
						<a
							href={catalog.links.documentation}
							target="_blank"
							rel="noopener noreferrer"
							className="text-neutral-500 hover:text-neutral-300"
						>
							Docs ↗
						</a>
					)}
					{catalog.links.homepage && (
						<a
							href={catalog.links.homepage}
							target="_blank"
							rel="noopener noreferrer"
							className="text-neutral-500 hover:text-neutral-300"
						>
							Homepage ↗
						</a>
					)}
				</div>
			)}

			{/* Install Button */}
			<div className="relative" ref={dropdownRef}>
				<div className="flex">
					<Button
						variant="primary"
						size="sm"
						className="flex-1 rounded-r-none"
						onClick={onQuickInstall}
						disabled={installing}
					>
						{installing ? (
							<>
								<Spinner size="sm" className="mr-2" />
								Installing...
							</>
						) : (
							'Install'
						)}
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
						<DropdownOption
							icon="⚡"
							label="Quick Install"
							description="Install with default settings"
							onClick={() => {
								setDropdownOpen(false)
								onQuickInstall()
							}}
						/>
						<DropdownOption
							icon="⚙️"
							label="Configure & Install"
							description="Customize Helm values before installing"
							onClick={() => {
								setDropdownOpen(false)
								onConfigureInstall()
							}}
						/>
						<DropdownOption
							icon="📦"
							label="Export to GitOps"
							description="Generate manifests for Flux/ArgoCD"
							onClick={() => {
								setDropdownOpen(false)
								onGitOpsExport()
							}}
						/>
					</div>
				)}
			</div>
		</Card>
	)
}

// Dropdown Option

function DropdownOption({
	icon,
	label,
	description,
	onClick,
	destructive = false,
}: {
	icon: string
	label: string
	description: string
	onClick: () => void
	destructive?: boolean
}) {
	return (
		<button
			onClick={onClick}
			className={`w-full px-4 py-2 text-left hover:bg-neutral-700/50 transition-colors ${destructive ? 'hover:bg-red-500/10' : ''
				}`}
		>
			<div className="flex items-center gap-3">
				<span className="text-lg">{icon}</span>
				<div>
					<p className={`text-sm font-medium ${destructive ? 'text-red-400' : 'text-neutral-200'}`}>{label}</p>
					<p className="text-xs text-neutral-500">{description}</p>
				</div>
			</div>
		</button>
	)
}

// Configure Addon Modal

interface ConfigureAddonModalProps {
	addon: AddonDefinition
	isOpen: boolean
	onClose: () => void
	onInstall: (values: Record<string, unknown>) => void
	installing: boolean
}

function ConfigureAddonModal({ addon, isOpen, onClose, onInstall, installing }: ConfigureAddonModalProps) {
	const [values, setValues] = useState<Record<string, unknown>>({})
	const [valuesSchema, setValuesSchema] = useState<ValuesSchema | null>(null)
	const [loading, setLoading] = useState(true)
	const [viewMode, setViewMode] = useState<'form' | 'yaml'>('form')
	const [yamlContent, setYamlContent] = useState('')

	useEffect(() => {
		if (isOpen) {
			loadValuesSchema()
		}
	}, [isOpen, addon.name])

	const loadValuesSchema = async () => {
		setLoading(true)
		try {
			const schema = getMockValuesSchema(addon.name)
			setValuesSchema(schema)
			setValues(schema.defaults || {})
			setYamlContent(objectToYaml(schema.defaults || {}))
		} catch (err) {
		} finally {
			setLoading(false)
		}
	}

	const handleValueChange = (path: string, value: unknown) => {
		setValues(prev => {
			const updated = { ...prev }
			setNestedValue(updated, path, value)
			setYamlContent(objectToYaml(updated))
			return updated
		})
	}

	const handleYamlChange = (yaml: string) => {
		setYamlContent(yaml)
		try {
			const parsed = yamlToObject(yaml)
			setValues(parsed)
		} catch {
			// Invalid YAML
		}
	}

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
				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Spinner size="lg" />
						<span className="ml-3 text-neutral-400">Loading configuration options...</span>
					</div>
				) : (
					<div className="space-y-4">
						{/* View Mode Toggle */}
						<div className="flex gap-2 border-b border-neutral-700 pb-2">
							<button
								onClick={() => setViewMode('form')}
								className={`px-3 py-1 text-sm rounded ${viewMode === 'form'
									? 'bg-green-500/20 text-green-400'
									: 'text-neutral-400 hover:text-neutral-200'
									}`}
							>
								Form
							</button>
							<button
								onClick={() => setViewMode('yaml')}
								className={`px-3 py-1 text-sm rounded ${viewMode === 'yaml'
									? 'bg-green-500/20 text-green-400'
									: 'text-neutral-400 hover:text-neutral-200'
									}`}
							>
								YAML
							</button>
						</div>

						{viewMode === 'form' && valuesSchema ? (
							<div className="space-y-6 max-h-96 overflow-y-auto pr-2">
								{valuesSchema.sections.map((section) => (
									<CollapsibleSection
										key={section.name}
										title={section.title}
										defaultOpen={section.important}
									>
										<div className="space-y-4">
											{section.fields.map((field) => (
												<FormField
													key={field.path}
													field={field}
													value={getNestedValue(values, field.path)}
													onChange={(value) => handleValueChange(field.path, value)}
												/>
											))}
										</div>
									</CollapsibleSection>
								))}
							</div>
						) : (
							<textarea
								value={yamlContent}
								onChange={(e) => handleYamlChange(e.target.value)}
								className="w-full h-96 font-mono text-sm bg-neutral-900 border border-neutral-700 rounded-lg p-4 text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								placeholder="# Enter Helm values in YAML format"
							/>
						)}
					</div>
				)}
			</ModalBody>

			<ModalFooter>
				<Button variant="secondary" onClick={onClose} disabled={installing}>
					Cancel
				</Button>
				<Button variant="primary" onClick={() => onInstall(values)} disabled={installing || loading}>
					{installing ? (
						<>
							<Spinner size="sm" className="mr-2" />
							Installing...
						</>
					) : (
						'Install'
					)}
				</Button>
			</ModalFooter>
		</Modal>
	)
}

// Collapsible Section

function CollapsibleSection({
	title,
	defaultOpen = false,
	children,
}: {
	title: string
	defaultOpen?: boolean
	children: React.ReactNode
}) {
	const [isOpen, setIsOpen] = useState(defaultOpen)

	return (
		<div className="border border-neutral-700 rounded-lg">
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-800/50 transition-colors"
			>
				<span className="font-medium text-neutral-200">{title}</span>
				<svg
					className={`w-5 h-5 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			{isOpen && <div className="px-4 pb-4">{children}</div>}
		</div>
	)
}

// Form Field

function FormField({
	field,
	value,
	onChange,
}: {
	field: SchemaField
	value: unknown
	onChange: (value: unknown) => void
}) {
	switch (field.type) {
		case 'boolean':
			return (
				<label className="flex items-center gap-3 cursor-pointer">
					<input
						type="checkbox"
						checked={Boolean(value)}
						onChange={(e) => onChange(e.target.checked)}
						className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-green-500 focus:ring-green-500"
					/>
					<div>
						<span className="text-sm text-neutral-200">{field.label}</span>
						{field.description && (
							<p className="text-xs text-neutral-500">{field.description}</p>
						)}
					</div>
				</label>
			)

		case 'select':
			return (
				<div>
					<label className="block text-sm text-neutral-200 mb-1">{field.label}</label>
					<select
						value={String(value || '')}
						onChange={(e) => onChange(e.target.value)}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					>
						{field.options?.map((opt) => (
							<option key={opt.value} value={opt.value}>
								{opt.label}
							</option>
						))}
					</select>
					{field.description && (
						<p className="text-xs text-neutral-500 mt-1">{field.description}</p>
					)}
				</div>
			)

		case 'number':
			return (
				<div>
					<label className="block text-sm text-neutral-200 mb-1">{field.label}</label>
					<input
						type="number"
						value={value as number || ''}
						onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
						placeholder={field.placeholder}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
					{field.description && (
						<p className="text-xs text-neutral-500 mt-1">{field.description}</p>
					)}
				</div>
			)

		default:
			return (
				<div>
					<label className="block text-sm text-neutral-200 mb-1">{field.label}</label>
					<input
						type="text"
						value={String(value || '')}
						onChange={(e) => onChange(e.target.value)}
						placeholder={field.placeholder}
						className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
					{field.description && (
						<p className="text-xs text-neutral-500 mt-1">{field.description}</p>
					)}
				</div>
			)
	}
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
		path: `clusters/addons/${addon.name}`,
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
				<Button variant="primary" onClick={() => onExport(config)}>
					Export
				</Button>
			</ModalFooter>
		</Modal>
	)
}

// Migrate to GitOps Modal

interface MigrateToGitOpsModalProps {
	addon: InstalledAddon
	isOpen: boolean
	onClose: () => void
	onMigrate: (config: GitOpsConfig) => void
}

function MigrateToGitOpsModal({ addon, isOpen, onClose, onMigrate }: MigrateToGitOpsModalProps) {
	const [config, setConfig] = useState<GitOpsConfig>({
		repository: '',
		branch: 'main',
		path: `clusters/addons/${addon.name}`,
		createPR: true,
	})

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalHeader>
				<div className="flex items-center gap-3">
					<span className="text-2xl">🔄</span>
					<div>
						<h2 className="text-lg font-semibold">Migrate to GitOps</h2>
						<p className="text-sm text-neutral-400">{addon.displayName || addon.name}</p>
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
				<Button variant="primary" onClick={() => onMigrate(config)}>
					Migrate
				</Button>
			</ModalFooter>
		</Modal>
	)
}

// Helpers

function getStatusColor(status: string): string {
	switch (status) {
		case 'Installed':
		case 'Healthy':
			return 'text-green-400'
		case 'Installing':
		case 'Upgrading':
		case 'Pending':
			return 'text-yellow-400'
		case 'Failed':
		case 'Degraded':
			return 'text-red-400'
		default:
			return 'text-neutral-400'
	}
}

function getStatusBgColor(status: string): string {
	switch (status) {
		case 'Installed':
		case 'Healthy':
			return 'bg-green-500/10 border border-green-500/30'
		case 'Installing':
		case 'Upgrading':
		case 'Pending':
			return 'bg-yellow-500/10 border border-yellow-500/30'
		case 'Failed':
		case 'Degraded':
			return 'bg-red-500/10 border border-red-500/30'
		default:
			return 'bg-neutral-500/10 border border-neutral-500/30'
	}
}

function getPlatformAddonIcon(name: string): string {
	const icons: Record<string, string> = {
		cilium: '🌐',
		metallb: '⚖️',
		'cert-manager': '🔐',
		longhorn: '💾',
		traefik: '🚪',
		'metrics-server': '📈',
	}
	return icons[name.toLowerCase()] || '📦'
}

function getOptionalAddonIcon(name: string): string {
	const icons: Record<string, string> = {
		velero: '🛡️',
		'prometheus-operator': '🔥',
		tempo: '🔍',
		jaeger: '🔎',
		'victoria-metrics': '📊',
		'victoria-logs': '📝',
		flux: '🔄',
		argocd: '🐙',
	}
	return icons[name.toLowerCase()] || '📦'
}

function getMockValuesSchema(addonName: string): ValuesSchema {
	const schemas: Record<string, ValuesSchema> = {
		'prometheus-operator': {
			sections: [
				{
					name: 'prometheus',
					title: 'Prometheus',
					important: true,
					fields: [
						{ path: 'prometheus.enabled', label: 'Enable Prometheus', type: 'boolean', description: 'Deploy Prometheus server' },
						{ path: 'prometheus.prometheusSpec.retention', label: 'Retention', type: 'string', placeholder: '15d', description: 'How long to retain metrics' },
						{ path: 'prometheus.prometheusSpec.replicas', label: 'Replicas', type: 'number', placeholder: '1', description: 'Number of Prometheus replicas' },
					],
				},
				{
					name: 'grafana',
					title: 'Grafana',
					important: true,
					fields: [
						{ path: 'grafana.enabled', label: 'Enable Grafana', type: 'boolean', description: 'Deploy Grafana for visualization' },
						{ path: 'grafana.adminPassword', label: 'Admin Password', type: 'string', placeholder: 'admin', description: 'Grafana admin password' },
					],
				},
				{
					name: 'alertmanager',
					title: 'Alertmanager',
					fields: [
						{ path: 'alertmanager.enabled', label: 'Enable Alertmanager', type: 'boolean', description: 'Deploy Alertmanager for alerts' },
					],
				},
			],
			defaults: {
				prometheus: { enabled: true, prometheusSpec: { retention: '15d', replicas: 1 } },
				grafana: { enabled: true, adminPassword: '' },
				alertmanager: { enabled: true },
			},
		},
		'velero': {
			sections: [
				{
					name: 'configuration',
					title: 'Backup Configuration',
					important: true,
					fields: [
						{
							path: 'configuration.provider', label: 'Provider', type: 'select', options: [
								{ label: 'AWS', value: 'aws' },
								{ label: 'GCP', value: 'gcp' },
								{ label: 'Azure', value: 'azure' },
							]
						},
						{ path: 'configuration.bucket', label: 'Bucket Name', type: 'string', placeholder: 'my-backup-bucket' },
						{ path: 'configuration.region', label: 'Region', type: 'string', placeholder: 'us-west-2' },
					],
				},
			],
			defaults: {
				configuration: { provider: 'aws', bucket: '', region: '' },
			},
		},
	}

	return schemas[addonName] || {
		sections: [
			{
				name: 'general',
				title: 'General Settings',
				important: true,
				fields: [],
			},
		],
		defaults: {},
	}
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown) {
	const keys = path.split('.')
	let current: Record<string, unknown> = obj
	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i]
		if (!(key in current) || typeof current[key] !== 'object') {
			current[key] = {}
		}
		current = current[key] as Record<string, unknown>
	}
	current[keys[keys.length - 1]] = value
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const keys = path.split('.')
	let current: unknown = obj
	for (const key of keys) {
		if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
			current = (current as Record<string, unknown>)[key]
		} else {
			return undefined
		}
	}
	return current
}

function objectToYaml(obj: Record<string, unknown>, indent = 0): string {
	const spaces = '  '.repeat(indent)
	let yaml = ''
	for (const [key, value] of Object.entries(obj)) {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			yaml += `${spaces}${key}:\n${objectToYaml(value as Record<string, unknown>, indent + 1)}`
		} else if (Array.isArray(value)) {
			yaml += `${spaces}${key}:\n`
			value.forEach((item) => {
				if (typeof item === 'object') {
					yaml += `${spaces}  -\n${objectToYaml(item as Record<string, unknown>, indent + 2)}`
				} else {
					yaml += `${spaces}  - ${item}\n`
				}
			})
		} else {
			yaml += `${spaces}${key}: ${value === '' ? '""' : value}\n`
		}
	}
	return yaml
}

function yamlToObject(yaml: string): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	const lines = yaml.split('\n')
	const stack: { obj: Record<string, unknown>; indent: number }[] = [{ obj: result, indent: -1 }]

	for (const line of lines) {
		if (!line.trim() || line.trim().startsWith('#')) continue

		const indent = line.search(/\S/)
		const match = line.trim().match(/^([^:]+):\s*(.*)$/)

		if (!match) continue

		const [, key, value] = match

		while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
			stack.pop()
		}

		const parent = stack[stack.length - 1].obj

		if (value === '' || value === undefined) {
			const newObj: Record<string, unknown> = {}
			parent[key] = newObj
			stack.push({ obj: newObj, indent })
		} else {
			let parsedValue: unknown = value
			if (value === 'true') parsedValue = true
			else if (value === 'false') parsedValue = false
			else if (!isNaN(Number(value))) parsedValue = Number(value)
			else if (value.startsWith('"') && value.endsWith('"')) parsedValue = value.slice(1, -1)
			parent[key] = parsedValue
		}
	}

	return result
}
