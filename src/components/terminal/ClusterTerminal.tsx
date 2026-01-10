// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

interface TerminalProps {
	type: 'management' | 'tenant'
	namespace: string
	cluster: string
	pod?: string
	container?: string
}

export function ClusterTerminal({ type, namespace, cluster, pod, container }: TerminalProps) {
	const terminalRef = useRef<HTMLDivElement>(null)
	const termRef = useRef<Terminal | null>(null)
	const wsRef = useRef<WebSocket | null>(null)
	const fitAddonRef = useRef<FitAddon | null>(null)

	const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
	const [error, setError] = useState<string | null>(null)

	const sendResize = useCallback(() => {
		if (!termRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
			return
		}
		const { cols, rows } = termRef.current
		wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }))
	}, [])

	const connect = useCallback((term: Terminal) => {
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
		const host = window.location.host

		let wsUrl: string
		if (type === 'management') {
			wsUrl = `${protocol}//${host}/ws/terminal/management`
		} else {
			wsUrl = `${protocol}//${host}/ws/terminal/${type}/${namespace}/${cluster}`
			if (pod) {
				wsUrl += `/${pod}`
				if (container) {
					wsUrl += `/${container}`
				}
			}
		}

		term.writeln('\x1b[33mConnecting to cluster...\x1b[0m')
		setStatus('connecting')

		const ws = new WebSocket(wsUrl)
		wsRef.current = ws

		ws.onopen = () => {
			setStatus('connected')
			term.writeln('\x1b[32mConnected!\x1b[0m\r\n')
			setTimeout(sendResize, 100)
		}

		ws.onmessage = (event) => {
			term.write(event.data)
		}

		ws.onerror = () => {
			setStatus('error')
			setError('Connection error')
			term.writeln('\r\n\x1b[31mConnection error\x1b[0m')
		}

		ws.onclose = () => {
			setStatus('disconnected')
			term.writeln('\r\n\x1b[33mDisconnected\x1b[0m')
		}

		term.onData((data) => {
			if (ws.readyState === WebSocket.OPEN) {
				ws.send(JSON.stringify({ type: 'data', data }))
			}
		})
	}, [type, namespace, cluster, pod, container, sendResize])

	useEffect(() => {
		if (!terminalRef.current) return

		const term = new Terminal({
			cursorBlink: true,
			fontSize: 14,
			fontFamily: '"JetBrains Mono", "Fira Code", monospace',
			theme: {
				background: '#0a0a0a',
				foreground: '#fafafa',
				cursor: '#22c55e',
				cursorAccent: '#0a0a0a',
				selectionBackground: '#22c55e33',
				black: '#171717',
				red: '#ef4444',
				green: '#22c55e',
				yellow: '#eab308',
				blue: '#3b82f6',
				magenta: '#a855f7',
				cyan: '#06b6d4',
				white: '#fafafa',
				brightBlack: '#404040',
				brightRed: '#f87171',
				brightGreen: '#4ade80',
				brightYellow: '#facc15',
				brightBlue: '#60a5fa',
				brightMagenta: '#c084fc',
				brightCyan: '#22d3ee',
				brightWhite: '#ffffff',
			},
		})

		const fitAddon = new FitAddon()
		term.loadAddon(fitAddon)
		term.open(terminalRef.current)

		setTimeout(() => fitAddon.fit(), 0)

		termRef.current = term
		fitAddonRef.current = fitAddon

		queueMicrotask(() => connect(term))

		const handleResize = () => {
			if (fitAddonRef.current) {
				fitAddonRef.current.fit()
				sendResize()
			}
		}
		window.addEventListener('resize', handleResize)

		return () => {
			window.removeEventListener('resize', handleResize)
			if (wsRef.current) {
				wsRef.current.close()
			}
			term.dispose()
		}
	}, [connect, sendResize])

	const reconnect = () => {
		if (wsRef.current) {
			wsRef.current.close()
		}
		if (termRef.current) {
			termRef.current.clear()
			connect(termRef.current)
		}
	}

	return (
		<div className="flex flex-col h-full">
			<div className="flex items-center justify-between px-3 py-2 bg-neutral-900 border-b border-neutral-800">
				<div className="flex items-center gap-2">
					<span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' :
						status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
							status === 'error' ? 'bg-red-500' :
								'bg-neutral-500'
						}`} />
					<span className="text-sm text-neutral-400">
						{status === 'connected' ? 'Connected' :
							status === 'connecting' ? 'Connecting...' :
								status === 'error' ? error || 'Error' :
									'Disconnected'}
					</span>
					<span className="text-sm text-neutral-600">|</span>
					<span className="text-sm text-neutral-500">{cluster}</span>
				</div>
				<div className="flex items-center gap-2">
					{status !== 'connected' && (
						<button
							onClick={reconnect}
							className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition-colors"
						>
							Reconnect
						</button>
					)}
				</div>
			</div>

			<div
				ref={terminalRef}
				className="flex-1 bg-[#0a0a0a] p-2"
				style={{ minHeight: '400px' }}
			/>
		</div>
	)
}
