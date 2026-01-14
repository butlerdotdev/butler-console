// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react'
import type { TenantCluster } from '@/types'

export interface WebSocketContextValue {
	isConnected: boolean
	lastClusterUpdate: TenantCluster | null
	lastClusterDelete: { name: string; namespace: string } | null
}

export const WebSocketContext = createContext<WebSocketContextValue>({
	isConnected: false,
	lastClusterUpdate: null,
	lastClusterDelete: null,
})
