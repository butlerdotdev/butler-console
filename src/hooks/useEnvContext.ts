// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react'
import { EnvContext } from '@/contexts/EnvContext'

export function useEnvContext() {
	const context = useContext(EnvContext)
	if (!context) {
		throw new Error('useEnvContext must be used within EnvProvider')
	}
	return context
}
