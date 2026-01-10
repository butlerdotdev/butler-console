// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useAuth } from '@/contexts'
import { useWebSocket } from '@/contexts'

export function Header() {
	const { user, logout } = useAuth()
	const { isConnected } = useWebSocket()

	return (
		<header className="h-14 border-b border-neutral-800 bg-neutral-900 px-6 flex items-center justify-between">
			<div className="flex items-center gap-3">
				<span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-neutral-500'}`} />
				<span className="text-sm text-neutral-400">
					{isConnected ? 'Connected' : 'Disconnected'}
				</span>
			</div>
			<div className="flex items-center gap-4">
				<span className="text-sm text-neutral-300">{user?.username}</span>
				<button
					onClick={logout}
					className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
				>
					Logout
				</button>
			</div>
		</header>
	)
}
