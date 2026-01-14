// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useContext } from 'react'
import { ToastContext } from '@/contexts/ToastContext'

export function useToast() {
	const context = useContext(ToastContext)
	if (!context) {
		throw new Error('useToast must be used within a ToastProvider')
	}
	return context
}
