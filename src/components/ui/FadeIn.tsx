// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface FadeInProps {
	children: ReactNode
	delay?: number
}

export function FadeIn({ children, delay = 0 }: FadeInProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay }}
		>
			{children}
		</motion.div>
	)
}
