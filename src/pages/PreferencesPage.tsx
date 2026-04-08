// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useDocumentTitle } from '@/hooks'
import { Card, Button, FadeIn } from '@/components/ui'
import { usePreferences } from '@/contexts/PreferencesContext'
import type { Preferences } from '@/contexts/PreferencesContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { ThemeMode, ColorMode } from '@/contexts/ThemeContext'

export function PreferencesPage() {
	useDocumentTitle('Preferences')

	const { preferences, updatePreference, resetPreferences } = usePreferences()
	const { theme, colorMode, setTheme, setColorMode } = useTheme()

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
					{/* Appearance */}
					<Card className="p-6">
						<div className="flex items-center gap-2 mb-4">
							<PaletteIcon className="w-5 h-5 text-neutral-400" />
							<h3 className="text-lg font-medium text-neutral-50">Appearance</h3>
						</div>
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-2">
									Theme
								</label>
								<div className="flex gap-2">
									{(['dark', 'light'] as ThemeMode[]).map((mode) => (
										<button
											key={mode}
											onClick={() => setTheme(mode)}
											className={`flex-1 px-4 py-2 rounded-lg border transition-colors capitalize ${
												theme === mode
													? 'border-green-500 bg-green-500/10 text-green-400'
													: 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
											}`}
										>
											{mode}
										</button>
									))}
								</div>
							</div>
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-2">
									Color Vision
								</label>
								<select
									value={colorMode}
									onChange={(e) => setColorMode(e.target.value as ColorMode)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								>
									<option value="default">Default</option>
									<option value="deuteranopia">Deuteranopia (red-green)</option>
									<option value="protanopia">Protanopia (red-blind)</option>
									<option value="tritanopia">Tritanopia (blue-yellow)</option>
								</select>
								<p className="text-xs text-neutral-500 mt-1">
									Adjusts accent colors for color vision accessibility
								</p>
							</div>
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
									value={preferences.defaultView}
									onChange={(e) =>
										updatePreference('defaultView', e.target.value as Preferences['defaultView'])
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
										value={preferences.terminalFontSize}
										onChange={(e) =>
											updatePreference('terminalFontSize', Number(e.target.value))
										}
										className="flex-1 accent-green-500"
									/>
									<span className="text-neutral-400 text-sm w-12">
										{preferences.terminalFontSize}px
									</span>
								</div>
								<p className="text-xs text-neutral-500 mt-1">
									Font size for the in-browser terminal
								</p>
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
									value={preferences.timezone}
									onChange={(e) => updatePreference('timezone', e.target.value)}
									className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
								>
									<option value="America/New_York">Eastern Time (ET)</option>
									<option value="America/Chicago">Central Time (CT)</option>
									<option value="America/Denver">Mountain Time (MT)</option>
									<option value="America/Los_Angeles">Pacific Time (PT)</option>
									<option value="Europe/London">London (GMT/BST)</option>
									<option value="Europe/Berlin">Central Europe (CET)</option>
									<option value="Asia/Tokyo">Tokyo (JST)</option>
									<option value="Asia/Shanghai">Shanghai (CST)</option>
									<option value="Australia/Sydney">Sydney (AEST)</option>
									<option value="UTC">UTC</option>
								</select>
								<p className="text-xs text-neutral-500 mt-1">
									Used for timestamps in audit log, events, and other views
								</p>
							</div>
							<div>
								<label className="block text-sm font-medium text-neutral-300 mb-2">
									Time Format
								</label>
								<div className="flex gap-2">
									<button
										onClick={() => updatePreference('dateFormat', '12h')}
										className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${preferences.dateFormat === '12h'
											? 'border-green-500 bg-green-500/10 text-green-400'
											: 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
											}`}
									>
										12-hour (1:30 PM)
									</button>
									<button
										onClick={() => updatePreference('dateFormat', '24h')}
										className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${preferences.dateFormat === '24h'
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
					<div className="flex justify-end">
						<Button variant="secondary" onClick={resetPreferences}>
							Reset to Defaults
						</Button>
					</div>
				</div>
			</div>
		</FadeIn>
	)
}

// Icons
function PaletteIcon({ className }: { className?: string }) {
	return (
		<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
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
