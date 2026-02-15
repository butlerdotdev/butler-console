// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useDocumentTitle } from '@/hooks'
import { Card, FadeIn, Spinner, Button, ResourceUsageBar } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

interface TeamSettings {
	displayName: string
	description: string
}

interface TeamResourceLimits {
	maxClusters?: number
	maxTotalNodes?: number
	maxNodesPerCluster?: number
	maxCPUCores?: string
	maxMemory?: string
	maxStorage?: string
}

interface TeamResourceUsage {
	clusters: number
	totalNodes: number
	totalCPU?: string
	totalMemory?: string
	totalStorage?: string
	clusterUtilization?: number
	nodeUtilization?: number
	cpuUtilization?: number
	memoryUtilization?: number
}

export function TeamSettingsPage() {
	const { currentTeam, currentTeamDisplayName } = useTeamContext()
	useDocumentTitle(currentTeamDisplayName ? `${currentTeamDisplayName} Settings` : 'Settings')
	const { success, error: showError } = useToast()

	const [settings, setSettings] = useState<TeamSettings>({
		displayName: '',
		description: '',
	})
	const [resourceUsage, setResourceUsage] = useState<TeamResourceUsage | null>(null)
	const [resourceLimits, setResourceLimits] = useState<TeamResourceLimits | null>(null)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)

	const fetchSettings = useCallback(async () => {
		if (!currentTeam) return
		try {
			const response = await fetch(`/api/teams/${currentTeam}`, {
				credentials: 'include',
			})
			if (response.ok) {
				const data = await response.json()
				const team = data.team || data
				setSettings({
					displayName: team.spec?.displayName || team.displayName || currentTeam,
					description: team.spec?.description || team.description || '',
				})
				// Extract resource usage and limits from response
				const usage = team.resourceUsage || team.status?.resourceUsage
				const limits = team.resourceLimits || team.spec?.resourceLimits
				if (usage) setResourceUsage(usage)
				if (limits) setResourceLimits(limits)
			}
		} catch (err) {
			console.error('Failed to fetch settings:', err)
		} finally {
			setLoading(false)
		}
	}, [currentTeam])

	useEffect(() => {
		fetchSettings()
	}, [fetchSettings])

	async function handleSave(e: React.FormEvent) {
		e.preventDefault()
		if (!currentTeam) return

		setSaving(true)
		try {
			const response = await fetch(`/api/teams/${currentTeam}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(settings),
			})

			if (response.ok) {
				success('Settings Saved', 'Team settings have been updated')
			} else {
				const data = await response.json()
				showError('Failed to Save', data.message || 'Unknown error')
			}
		} catch {
			showError('Error', 'Failed to save settings')
		} finally {
			setSaving(false)
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
				{/* Header */}
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">Settings</h1>
					<p className="text-neutral-400 mt-1">
						Configure team settings
					</p>
				</div>

				{/* Resource Usage */}
				<Card className="p-6">
					<h2 className="text-lg font-medium text-neutral-100 mb-1">Resource Usage</h2>
					<p className="text-sm text-neutral-500 mb-4">
						Current resource consumption for your team
					</p>
					{resourceUsage ? (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
							<ResourceUsageBar
								label="Clusters"
								used={resourceUsage.clusters}
								limit={resourceLimits?.maxClusters}
							/>
							<ResourceUsageBar
								label="Total Nodes"
								used={resourceUsage.totalNodes}
								limit={resourceLimits?.maxTotalNodes}
							/>
							<ResourceUsageBar
								label="CPU Cores"
								used={resourceUsage.totalCPU || '0'}
								limit={resourceLimits?.maxCPUCores}
								unit="cores"
							/>
							<ResourceUsageBar
								label="Memory"
								used={resourceUsage.totalMemory || '0'}
								limit={resourceLimits?.maxMemory}
							/>
							<ResourceUsageBar
								label="Storage"
								used={resourceUsage.totalStorage || '0'}
								limit={resourceLimits?.maxStorage}
							/>
							{resourceLimits?.maxNodesPerCluster != null && (
								<div className="space-y-1.5">
									<div className="flex justify-between items-baseline">
										<span className="text-sm text-neutral-300">Max Nodes per Cluster</span>
										<span className="text-sm font-mono text-neutral-400">
											{resourceLimits.maxNodesPerCluster}
										</span>
									</div>
									<div className="h-2" />
								</div>
							)}
						</div>
					) : (
						<div className="text-sm text-neutral-500">
							Resource usage data is not yet available.
						</div>
					)}
				</Card>

				{/* Settings Form */}
				<Card className="p-6">
					<h2 className="text-lg font-medium text-neutral-100 mb-4">Team Settings</h2>
					<form onSubmit={handleSave} className="space-y-6">
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-2">
								Team Name
							</label>
							<input
								type="text"
								value={currentTeam || ''}
								disabled
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-500 cursor-not-allowed"
							/>
							<p className="text-xs text-neutral-500 mt-1">
								Team names cannot be changed
							</p>
						</div>

						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-2">
								Display Name
							</label>
							<input
								type="text"
								value={settings.displayName}
								onChange={(e) =>
									setSettings({ ...settings, displayName: e.target.value })
								}
								className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-1 focus:ring-green-500"
								placeholder="My Team"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-2">
								Description
							</label>
							<textarea
								value={settings.description}
								onChange={(e) =>
									setSettings({ ...settings, description: e.target.value })
								}
								rows={3}
								className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
								placeholder="Team description..."
							/>
						</div>

						<div className="flex justify-end">
							<Button type="submit" disabled={saving}>
								{saving ? 'Saving...' : 'Save Changes'}
							</Button>
						</div>
					</form>
				</Card>
			</div>
		</FadeIn>
	)
}
