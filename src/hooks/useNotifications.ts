// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useWebSocket } from './useWebSocket'

export function useNotifications() {
	const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useWebSocket()
	return { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications }
}
