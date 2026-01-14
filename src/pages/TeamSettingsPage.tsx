// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState, useEffect, useCallback } from 'react'
import { useTeamContext } from '@/hooks/useTeamContext'
import { useDocumentTitle } from '@/hooks'
import { Card, FadeIn, Spinner, Button } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

interface TeamSettings {
	displayName: string
	description: string
}

export function TeamSettingsPage() {
	const { currentTeam, currentTeamDisplayName } = useTeamContext()
	useDocumentTitle(currentTeamDisplayName ? `${currentTeamDisplayName} Settings` : 'Settings')
	const { success, error: showError } = useToast()

	const [settings, setSettings] = useState<TeamSettings>({
		displayName: '',
		description: '',
	})
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

				{/* Settings Form */}
				<Card className="p-6">
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
