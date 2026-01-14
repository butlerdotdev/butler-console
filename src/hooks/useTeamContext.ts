// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react'
import { TeamContext } from '@/contexts/TeamContext'

export function useTeamContext() {
	const context = useContext(TeamContext)
	if (!context) {
		throw new Error('useTeamContext must be used within TeamContextProvider')
	}
	return context
}
