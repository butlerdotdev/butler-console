// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react'

export function useDocumentTitle(title: string) {
	useEffect(() => {
		const prevTitle = document.title
		document.title = title ? `${title} | Butler Console` : 'Butler Console'
		return () => {
			document.title = prevTitle
		}
	}, [title])
}
