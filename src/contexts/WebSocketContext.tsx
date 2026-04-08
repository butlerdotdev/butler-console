// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react'
import type { TenantCluster } from '@/types'
import type { Notification } from '@/types/notifications'

export interface WebSocketContextValue {
	isConnected: boolean
	lastClusterUpdate: TenantCluster | null
	lastClusterDelete: { name: string; namespace: string } | null
	notifications: Notification[]
	unreadCount: number
	markAsRead: (id: string) => void
	markAllAsRead: () => void
	clearNotifications: () => void
}

export const WebSocketContext = createContext<WebSocketContextValue>({
	isConnected: false,
	lastClusterUpdate: null,
	lastClusterDelete: null,
	notifications: [],
	unreadCount: 0,
	markAsRead: () => {},
	markAllAsRead: () => {},
	clearNotifications: () => {},
})
