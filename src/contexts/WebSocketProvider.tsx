// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { TenantCluster } from '@/types'
import { WebSocketContext } from './WebSocketContext'

interface WebSocketMessage {
	type: 'cluster_update' | 'cluster_delete' | 'ping' | 'pong' | 'error'
	payload?: unknown
}

interface ClusterUpdatePayload {
	cluster: TenantCluster
}

interface ClusterDeletePayload {
	name: string
	namespace: string
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
	const [isConnected, setIsConnected] = useState(false)
	const [lastClusterUpdate, setLastClusterUpdate] = useState<TenantCluster | null>(null)
	const [lastClusterDelete, setLastClusterDelete] = useState<{ name: string; namespace: string } | null>(null)
	const wsRef = useRef<WebSocket | null>(null)
	const reconnectTimeoutRef = useRef<number | null>(null)
	const reconnectAttempts = useRef(0)
	const maxReconnectAttempts = 5
	const connectRef = useRef<() => void>(() => { })

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
		<WebSocketContext.Provider value={{ isConnected, lastClusterUpdate, lastClusterDelete }}>
			{children}
		</WebSocketContext.Provider>
	)
}
