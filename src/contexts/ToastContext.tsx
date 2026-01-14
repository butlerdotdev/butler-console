// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { createContext } from 'react'

export interface ToastContextValue {
	success: (title: string, message?: string) => void
	error: (title: string, message?: string) => void
	warning: (title: string, message?: string) => void
	info: (title: string, message?: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
