// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react'
import { Card } from './Card'

interface EmptyStateProps {
	title: string
	description?: string
	action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
	return (
		<Card className="p-8 text-center">
			<h3 className="text-lg font-medium text-neutral-200">{title}</h3>
			{description && <p className="mt-2 text-neutral-400">{description}</p>}
			{action && <div className="mt-4">{action}</div>}
		</Card>
	)
}
