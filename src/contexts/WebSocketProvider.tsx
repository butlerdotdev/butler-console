// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { TenantCluster } from '@/types'
import type { Notification, NotificationSeverity, NotificationCategory, ResourceRef } from '@/types/notifications'
import { WebSocketContext } from './WebSocketContext'

interface WebSocketMessage {
	type: 'cluster_update' | 'cluster_delete' | 'notification' | 'ping' | 'pong' | 'error'
	payload?: unknown
}

interface ClusterUpdatePayload {
	cluster: TenantCluster
}

interface ClusterDeletePayload {
	name: string
	namespace: string
}

interface NotificationPayload {
	id: string
	title: string
	message: string
	severity?: string
	category?: string
	timestamp?: string
	resourceRef?: ResourceRef
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
	const [isConnected, setIsConnected] = useState(false)
	const [lastClusterUpdate, setLastClusterUpdate] = useState<TenantCluster | null>(null)
	const [lastClusterDelete, setLastClusterDelete] = useState<{ name: string; namespace: string } | null>(null)
	const [notifications, setNotifications] = useState<Notification[]>([])
	const [unreadCount, setUnreadCount] = useState(0)
	const wsRef = useRef<WebSocket | null>(null)
	const reconnectTimeoutRef = useRef<number | null>(null)
	const reconnectAttempts = useRef(0)
	const maxReconnectAttempts = 5
	const connectRef = useRef<() => void>(() => { })

	const markAsRead = useCallback((id: string) => {
		setNotifications(prev =>
			prev.map(n => n.id === id ? { ...n, read: true } : n)
		)
		setUnreadCount(prev => Math.max(0, prev - 1))
	}, [])

	const markAllAsRead = useCallback(() => {
		setNotifications(prev => prev.map(n => ({ ...n, read: true })))
		setUnreadCount(0)
	}, [])

	const clearNotifications = useCallback(() => {
		setNotifications([])
		setUnreadCount(0)
	}, [])

	useEffect(() => {
		const connect = () => {
			if (wsRef.current) {
				wsRef.current.close()
			}

			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
			const host = window.location.host
			const wsUrl = `${protocol}//${host}/ws/clusters`

			try {
				const ws = new WebSocket(wsUrl)
				wsRef.current = ws

				ws.onopen = () => {
					setIsConnected(true)
					reconnectAttempts.current = 0
				}

				ws.onclose = () => {
					setIsConnected(false)
					wsRef.current = null

					if (reconnectAttempts.current < maxReconnectAttempts) {
						const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
						reconnectTimeoutRef.current = window.setTimeout(() => {
							reconnectAttempts.current++
							connectRef.current()
						}, delay)
					}
				}

				ws.onerror = () => {
					// Error handling - connection will close and trigger reconnect
				}

				ws.onmessage = (event) => {
					try {
						const message: WebSocketMessage = JSON.parse(event.data)

						switch (message.type) {
							case 'cluster_update': {
								const payload = message.payload as ClusterUpdatePayload
								if (payload?.cluster) {
									setLastClusterUpdate(payload.cluster)
								}
								break
							}
							case 'cluster_delete': {
								const payload = message.payload as ClusterDeletePayload
								if (payload?.name && payload?.namespace) {
									setLastClusterDelete({ name: payload.name, namespace: payload.namespace })
								}
								break
							}
							case 'notification': {
								const payload = message.payload as NotificationPayload
								if (payload?.id && payload?.title) {
									const notification: Notification = {
										id: payload.id,
										title: payload.title,
										message: payload.message,
										severity: (payload.severity || 'info') as NotificationSeverity,
										category: (payload.category || 'cluster') as NotificationCategory,
										timestamp: payload.timestamp || new Date().toISOString(),
										resourceRef: payload.resourceRef,
										read: false,
									}
									setNotifications(prev => [notification, ...prev].slice(0, 50))
									setUnreadCount(prev => prev + 1)
								}
								break
							}
							case 'ping':
								if (ws.readyState === WebSocket.OPEN) {
									ws.send(JSON.stringify({ type: 'pong' }))
								}
								break
						}
					} catch {
						// Failed to parse message
					}
				}
			} catch {
				// Failed to create WebSocket connection
			}
		}

		connectRef.current = connect
		connect()

		return () => {
			if (reconnectTimeoutRef.current) {
				window.clearTimeout(reconnectTimeoutRef.current)
				reconnectTimeoutRef.current = null
			}
			if (wsRef.current) {
				wsRef.current.close()
				wsRef.current = null
			}
		}
	}, [])

	return (
		<WebSocketContext.Provider value={{
			isConnected,
			lastClusterUpdate,
			lastClusterDelete,
			notifications,
			unreadCount,
			markAsRead,
			markAllAsRead,
			clearNotifications,
		}}>
			{children}
		</WebSocketContext.Provider>
	)
}
