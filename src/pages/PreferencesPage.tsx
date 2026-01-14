// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { useDocumentTitle } from '@/hooks'
import { Card, Button, FadeIn } from '@/components/ui'
import { useToast } from '@/hooks/useToast'

interface Preferences {
	// Notifications
	emailNotifications: boolean
	clusterAlerts: boolean
	teamInvites: boolean

	// Display
	defaultView: 'team' | 'admin' | 'last'
	compactMode: boolean
	showClusterMetrics: boolean

	// Terminal
	terminalFontSize: number
	terminalTheme: 'dark' | 'light'

	// Time
	timezone: string
	dateFormat: '12h' | '24h'
}

const defaultPreferences: Preferences = {
	emailNotifications: true,
	clusterAlerts: true,
	teamInvites: true,
	defaultView: 'last',
	compactMode: false,
	showClusterMetrics: true,
	terminalFontSize: 14,
	terminalTheme: 'dark',
	timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	dateFormat: '12h',
}

export function PreferencesPage() {
	useDocumentTitle('Preferences')
	const { success } = useToast()

	const [prefs, setPrefs] = useState<Preferences>(defaultPreferences)
	const [saving, setSaving] = useState(false)

	const updatePref = <K extends keyof Preferences>(
		key: K,
		value: Preferences[K]
	) => {
		setPrefs((prev) => ({ ...prev, [key]: value }))
	}

	const handleSave = async () => {
		setSaving(true)
		// TODO: Implement preferences API
		await new Promise((resolve) => setTimeout(resolve, 500))
		localStorage.setItem('butler-preferences', JSON.stringify(prefs))
		success('Preferences Saved', 'Your preferences have been updated')
		setSaving(false)
	}

	const handleReset = () => {
		setPrefs(defaultPreferences)
	}

	return (
		<FadeIn>
			<div className="max-w-2xl mx-auto">
				<div className="mb-6">
					<h1 className="text-2xl font-semibold text-neutral-50">Preferences</h1>
					<p className="text-neutral-400 mt-1">
						Customize your Butler Console experience
					</p>
				</div>

				<div className="space-y-6">
					{/* Notifications */}
					<Card className="p-6">
						<div className="flex items-center gap-2 mb-4">
							<BellIcon className="w-5 h-5 text-neutral-400" />
							<h3 className="text-lg font-medium text-neutral-50">
								Notifications
							</h3>
						</div>
						<div className="space-y-4">
							<Toggle
								label="Email Notifications"
								description="Receive email updates for important events"
								checked={prefs.emailNotifications}
								onChange={(v) => updatePref('emailNotifications', v)}
							/>
							<Toggle
								label="Cluster Alerts"
								description="Get notified when clusters change state"
								checked={prefs.clusterAlerts}
								onChange={(v) => updatePref('clusterAlerts', v)}
							/>
							<Toggle
								label="Team Invitations"
								description="Notify when you're invited to a team"
								checked={prefs.teamInvites}
								onChange={(v) => updatePref('teamInvites', v)}
							/>
						</div>
					</Card>

					{/* Display */}
					<Card className="p-6">
						<div className="flex items-center gap-2 mb-4">
							<LayoutIcon className="w-5 h-5 text-neutral-400" />
							<h3 className="text-lg font-medium text-neutral-50">Display</h3>
						</div>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-2">
									Default View
								</label>
								<select
									value={prefs.defaultView}
									onChange={(e) =>
										updatePref('defaultView', e.target.value as Preferences['defaultView'])
									}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								>
									<option value="last">Remember Last View</option>
									<option value="team">Default to Team View</option>
									<option value="admin">Default to Admin View</option>
								</select>
								<p className="text-xs text-neutral-500 mt-1">
									Where to start when you log in
								</p>
							</div>
							<Toggle
								label="Compact Mode"
								description="Use smaller spacing and fonts throughout"
								checked={prefs.compactMode}
								onChange={(v) => updatePref('compactMode', v)}
							/>
							<Toggle
								label="Show Cluster Metrics"
								description="Display resource usage on cluster cards"
								checked={prefs.showClusterMetrics}
								onChange={(v) => updatePref('showClusterMetrics', v)}
							/>
						</div>
					</Card>

					{/* Terminal */}
					<Card className="p-6">
						<div className="flex items-center gap-2 mb-4">
							<TerminalIcon className="w-5 h-5 text-neutral-400" />
							<h3 className="text-lg font-medium text-neutral-50">Terminal</h3>
						</div>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-2">
									Font Size
								</label>
								<div className="flex items-center gap-4">
									<input
										type="range"
										min={10}
										max={20}
										value={prefs.terminalFontSize}
										onChange={(e) =>
											updatePref('terminalFontSize', Number(e.target.value))
										}
										className="flex-1 accent-green-500"
									/>
									<span className="text-neutral-400 text-sm w-12">
										{prefs.terminalFontSize}px
									</span>
								</div>
							</div>
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-2">
									Theme
								</label>
								<div className="flex gap-2">
									<button
										onClick={() => updatePref('terminalTheme', 'dark')}
										className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${prefs.terminalTheme === 'dark'
											? 'border-green-500 bg-green-500/10 text-green-400'
											: 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
											}`}
									>
										Dark
									</button>
									<button
										onClick={() => updatePref('terminalTheme', 'light')}
										className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${prefs.terminalTheme === 'light'
											? 'border-green-500 bg-green-500/10 text-green-400'
											: 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
											}`}
									>
										Light
									</button>
								</div>
							</div>
						</div>
					</Card>

					{/* Time & Date */}
					<Card className="p-6">
						<div className="flex items-center gap-2 mb-4">
							<ClockIcon className="w-5 h-5 text-neutral-400" />
							<h3 className="text-lg font-medium text-neutral-50">
								Time & Date
							</h3>
						</div>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-2">
									Timezone
								</label>
								<select
									value={prefs.timezone}
									onChange={(e) => updatePref('timezone', e.target.value)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								>
									<option value="America/New_York">
										Eastern Time (ET)
									</option>
									<option value="America/Chicago">Central Time (CT)</option>
									<option value="America/Denver">Mountain Time (MT)</option>
									<option value="America/Los_Angeles">
										Pacific Time (PT)
									</option>
									<option value="UTC">UTC</option>
								</select>
							</div>
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-2">
									Time Format
								</label>
								<div className="flex gap-2">
									<button
										onClick={() => updatePref('dateFormat', '12h')}
										className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${prefs.dateFormat === '12h'
											? 'border-green-500 bg-green-500/10 text-green-400'
											: 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
											}`}
									>
										12-hour (1:30 PM)
									</button>
									<button
										onClick={() => updatePref('dateFormat', '24h')}
										className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${prefs.dateFormat === '24h'
											? 'border-green-500 bg-green-500/10 text-green-400'
											: 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
											}`}
									>
										24-hour (13:30)
									</button>
								</div>
							</div>
						</div>
					</Card>

					{/* Actions */}
					<div className="flex justify-between items-center">
						<Button variant="secondary" onClick={handleReset}>
							Reset to Defaults
						</Button>
						<Button onClick={handleSave} disabled={saving}>
							{saving ? 'Saving...' : 'Save Preferences'}
						</Button>
					</div>
				</div>
			</div>
		</FadeIn>
	)
}

interface ToggleProps {
	label: string
	description?: string
	checked: boolean
	onChange: (checked: boolean) => void
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
	return (
		<div className="flex items-center justify-between">
			<div>
				<p className="text-sm font-medium text-neutral-300">{label}</p>
				{description && (
					<p className="text-xs text-neutral-500">{description}</p>
				)}
			</div>
			<button
				role="switch"
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-neutral-700'
					}`}
			>
				<span
					className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'
						}`}
				/>
			</button>
		</div>
	)
}

// Icons
function BellIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
			/>
		</svg>
	)
}

function LayoutIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
			/>
		</svg>
	)
}

function TerminalIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
			/>
		</svg>
	)
}

function ClockIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	)
}
