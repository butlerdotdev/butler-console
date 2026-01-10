// Copyright 2025 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider, WebSocketProvider } from '@/contexts'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<BrowserRouter>
			<AuthProvider>
				<WebSocketProvider>
					<App />
				</WebSocketProvider>
			</AuthProvider>
		</BrowserRouter>
	</React.StrictMode>,
)
