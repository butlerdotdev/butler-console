// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { useDocumentTitle } from '@/hooks'
import { Card, Button, FadeIn } from '@/components/ui'

export function SettingsPage() {
	useDocumentTitle('Settings')

	const [saved, setSaved] = useState(false)

	const handleSave = () => {
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	return (
		<FadeIn>
			<div className="space-y-6 max-w-4xl">
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50">Settings</h1>
					<p className="text-neutral-400 mt-1">Manage your Butler Console preferences</p>
				</div>

				<Card className="p-6">
					<h2 className="text-lg font-medium text-neutral-50 mb-4">Profile</h2>
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">Username</label>
							<input
								type="text"
								value="admin"
								disabled
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 disabled:opacity-50"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-neutral-400 mb-1">Email</label>
							<input
								type="email"
								placeholder="admin@example.com"
								className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
					</div>
				</Card>

				<Card className="p-6">
					<h2 className="text-lg font-medium text-neutral-50 mb-4">Preferences</h2>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-neutral-200">Default Namespace</p>
								<p className="text-sm text-neutral-500">Default namespace for new clusters</p>
							</div>
							<select className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 focus:outline-none focus:ring-2 focus:ring-green-500">
								<option>butler-tenants</option>
								<option>default</option>
							</select>
						</div>
						<div className="flex items-center justify-between">
							<div>
								<p className="text-neutral-200">Auto-refresh</p>
								<p className="text-sm text-neutral-500">Automatically refresh cluster status</p>
							</div>
							<label className="relative inline-flex items-center cursor-pointer">
								<input type="checkbox" defaultChecked className="sr-only peer" />
								<div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
							</label>
						</div>
					</div>
				</Card>

				<Card className="p-6 border-red-500/20">
					<h2 className="text-lg font-medium text-red-400 mb-4">Danger Zone</h2>
					<div className="flex items-center justify-between">
						<div>
							<p className="text-neutral-200">Clear Local Data</p>
							<p className="text-sm text-neutral-500">Remove all cached data and preferences</p>
						</div>
						<Button variant="danger" size="sm">
							Clear Data
						</Button>
					</div>
				</Card>

				<div className="flex justify-end gap-3">
					{saved && (
						<span className="text-green-500 text-sm self-center">Settings saved!</span>
					)}
					<Button onClick={handleSave}>Save Settings</Button>
				</div>
			</div>
		</FadeIn>
	)
}
