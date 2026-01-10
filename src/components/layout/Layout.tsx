// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

export function Layout() {
	return (
		<div className="flex h-screen bg-neutral-950 text-neutral-50">
			<Sidebar />
			<div className="flex-1 flex flex-col overflow-hidden">
				<Header />
				<main className="flex-1 overflow-auto p-6 relative">
					<div
						className="fixed inset-0 pointer-events-none z-0"
						style={{
							backgroundImage: 'url(/butlergopher.png)',
							backgroundRepeat: 'no-repeat',
							backgroundPosition: 'center center',
							backgroundSize: '50%',
							opacity: 0.03,
						}}
					/>
					<div className="relative z-10">
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	)
}
