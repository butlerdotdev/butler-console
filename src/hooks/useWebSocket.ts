// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react'
import { WebSocketContext } from '@/contexts/WebSocketContext'

export function useWebSocket() {
	return useContext(WebSocketContext)
}
