// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Card, Button } from '@/components/ui'

interface AccessDeniedProps {
	message?: string
	resourceType?: string
	resourceName?: string
	teamName?: string
}

interface TeamRef {
	role?: string
}

export function AccessDenied({
	message,
	resourceType = 'resource',
	resourceName,
	teamName,
}: AccessDeniedProps) {
	const navigate = useNavigate()
	const { user } = useAuth()

	const isAdmin = user?.role === 'admin' || user?.isAdmin ||
		user?.teams?.some((t: TeamRef) => t.role === 'admin')

	const defaultMessage = teamName
		? `You don't have access to the ${teamName} team's resources.`
		: `You don't have permission to view this ${resourceType}.`

	return (
		<div className="flex items-center justify-center min-h-[400px]">
			<Card className="max-w-md w-full p-8 text-center">
				{/* Lock Icon */}
				<div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
					<svg
						className="w-8 h-8 text-red-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
						/>
					</svg>
				</div>

				{/* Title */}
				<h2 className="text-xl font-semibold text-neutral-100 mb-2">
					Access Denied
				</h2>

				{/* Resource info if available */}
				{resourceName && (
					<p className="text-sm text-neutral-500 mb-4">
						{resourceType}: <span className="text-neutral-300">{resourceName}</span>
					</p>
				)}

				{/* Message */}
				<p className="text-neutral-400 mb-6">
					{message || defaultMessage}
				</p>

				{/* Actions */}
				<div className="flex flex-col sm:flex-row gap-3 justify-center">
					<Button
						variant="secondary"
						onClick={() => navigate(-1)}
					>
						<svg
							className="w-4 h-4 mr-2"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M10 19l-7-7m0 0l7-7m-7 7h18"
							/>
						</svg>
						Go Back
					</Button>

					{isAdmin && teamName && (
						<Button
							onClick={() => navigate(`/t/${teamName}`)}
						>
							Switch to {teamName}
						</Button>
					)}

					{!isAdmin && (
						<Button
							variant="secondary"
							onClick={() => navigate('/')}
						>
							Go Home
						</Button>
					)}
				</div>

				{/* Help text */}
				<p className="text-xs text-neutral-600 mt-6">
					If you believe you should have access, contact your team administrator.
				</p>
			</Card>
		</div>
	)
}
