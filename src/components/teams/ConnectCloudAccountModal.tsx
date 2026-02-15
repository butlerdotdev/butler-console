// Copyright 2026 The Butler Authors.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react'
import { providersApi } from '@/api/providers'
import type { CreateProviderRequest } from '@/api/providers'
import { Button, Spinner } from '@/components/ui'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { ProviderIcon } from '@/components/providers/ProviderIcon'
import { useToast } from '@/hooks/useToast'

type CloudType = 'aws' | 'azure' | 'gcp'

interface ConnectCloudAccountModalProps {
	isOpen: boolean
	onClose: () => void
	onConnected: () => void
	teamName: string
}

export function ConnectCloudAccountModal({ isOpen, onClose, onConnected, teamName }: ConnectCloudAccountModalProps) {
	const { success, error: showError } = useToast()

	const [step, setStep] = useState<'pick' | 'form'>('pick')
	const [cloudType, setCloudType] = useState<CloudType | null>(null)
	const [testing, setTesting] = useState(false)
	const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null)
	const [creating, setCreating] = useState(false)

	// Common
	const [name, setName] = useState('')

	// AWS
	const [awsRegion, setAwsRegion] = useState('')
	const [awsAccessKeyId, setAwsAccessKeyId] = useState('')
	const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('')
	const [awsVpcId, setAwsVpcId] = useState('')
	const [awsSubnetIds, setAwsSubnetIds] = useState<string[]>([''])
	const [awsSecurityGroupIds, setAwsSecurityGroupIds] = useState<string[]>([''])

	// Azure
	const [azureSubscriptionId, setAzureSubscriptionId] = useState('')
	const [azureTenantId, setAzureTenantId] = useState('')
	const [azureClientId, setAzureClientId] = useState('')
	const [azureClientSecret, setAzureClientSecret] = useState('')
	const [azureResourceGroup, setAzureResourceGroup] = useState('')
	const [azureLocation, setAzureLocation] = useState('')
	const [azureVnetName, setAzureVnetName] = useState('')
	const [azureSubnetName, setAzureSubnetName] = useState('')

	// GCP
	const [gcpProjectId, setGcpProjectId] = useState('')
	const [gcpRegion, setGcpRegion] = useState('')
	const [gcpServiceAccount, setGcpServiceAccount] = useState('')
	const [gcpNetwork, setGcpNetwork] = useState('')
	const [gcpSubnetwork, setGcpSubnetwork] = useState('')

	const resetForm = () => {
		setStep('pick')
		setCloudType(null)
		setTesting(false)
		setTestResult(null)
		setCreating(false)
		setName('')
		setAwsRegion('')
		setAwsAccessKeyId('')
		setAwsSecretAccessKey('')
		setAwsVpcId('')
		setAwsSubnetIds([''])
		setAwsSecurityGroupIds([''])
		setAzureSubscriptionId('')
		setAzureTenantId('')
		setAzureClientId('')
		setAzureClientSecret('')
		setAzureResourceGroup('')
		setAzureLocation('')
		setAzureVnetName('')
		setAzureSubnetName('')
		setGcpProjectId('')
		setGcpRegion('')
		setGcpServiceAccount('')
		setGcpNetwork('')
		setGcpSubnetwork('')
	}

	const handleClose = () => {
		resetForm()
		onClose()
	}

	const handlePickCloud = (type: CloudType) => {
		setCloudType(type)
		const region = type === 'aws' ? awsRegion : type === 'azure' ? azureLocation : gcpRegion
		if (!name) {
			setName(`${teamName}-${type}${region ? `-${region}` : ''}`)
		}
		setStep('form')
	}

	const buildRequest = (): CreateProviderRequest | null => {
		if (!name || !cloudType) return null

		const base: CreateProviderRequest = {
			name,
			provider: cloudType,
			networkMode: 'cloud',
		}

		switch (cloudType) {
			case 'aws':
				if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey) return null
				return {
					...base,
					awsRegion,
					awsAccessKeyId,
					awsSecretAccessKey,
					awsVpcId: awsVpcId || undefined,
					awsSubnetIds: awsSubnetIds.filter(Boolean).length > 0 ? awsSubnetIds.filter(Boolean) : undefined,
					awsSecurityGroupIds: awsSecurityGroupIds.filter(Boolean).length > 0 ? awsSecurityGroupIds.filter(Boolean) : undefined,
				}
			case 'azure':
				if (!azureSubscriptionId || !azureTenantId || !azureClientId || !azureClientSecret) return null
				return {
					...base,
					azureSubscriptionId,
					azureTenantId,
					azureClientId,
					azureClientSecret,
					azureResourceGroup: azureResourceGroup || undefined,
					azureLocation: azureLocation || undefined,
					azureVnetName: azureVnetName || undefined,
					azureSubnetName: azureSubnetName || undefined,
				}
			case 'gcp':
				if (!gcpProjectId || !gcpRegion || !gcpServiceAccount) return null
				return {
					...base,
					gcpProjectId,
					gcpRegion,
					gcpServiceAccount,
					gcpNetwork: gcpNetwork || undefined,
					gcpSubnetwork: gcpSubnetwork || undefined,
				}
		}
	}

	const handleTest = async () => {
		const req = buildRequest()
		if (!req) return
		setTesting(true)
		setTestResult(null)
		try {
			const result = await providersApi.testTeamConnection(teamName, req)
			setTestResult(result)
		} catch (err) {
			setTestResult({ valid: false, message: err instanceof Error ? err.message : 'Connection test failed' })
		} finally {
			setTesting(false)
		}
	}

	const handleCreate = async () => {
		const req = buildRequest()
		if (!req) return
		setCreating(true)
		try {
			await providersApi.createTeamProvider(teamName, req)
			success('Provider Connected', `${name} has been connected to the team`)
			resetForm()
			onConnected()
		} catch (err) {
			showError('Connection Failed', err instanceof Error ? err.message : 'Failed to connect provider')
		} finally {
			setCreating(false)
		}
	}

	const isFormValid = buildRequest() !== null

	const updateListItem = (
		list: string[],
		setList: React.Dispatch<React.SetStateAction<string[]>>,
		index: number,
		value: string
	) => {
		const updated = [...list]
		updated[index] = value
		setList(updated)
	}

	const addListItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
		setList([...list, ''])
	}

	const removeListItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
		if (list.length <= 1) return
		setList(list.filter((_, i) => i !== index))
	}

	return (
		<Modal isOpen={isOpen} onClose={creating ? () => {} : handleClose}>
			<ModalHeader>
				<div className="flex items-center gap-3">
					<div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
						<svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
						</svg>
					</div>
					<div>
						<h2 className="text-lg font-semibold text-neutral-100">Connect Cloud Account</h2>
						<p className="text-sm text-neutral-400">
							{step === 'pick' ? 'Choose your cloud provider' : `Configure ${cloudType?.toUpperCase()} connection`}
						</p>
					</div>
				</div>
			</ModalHeader>

			<ModalBody>
				{step === 'pick' ? (
					<div className="grid grid-cols-3 gap-4">
						{([
							{ type: 'aws' as CloudType, label: 'AWS', sublabel: 'Amazon Web Services' },
							{ type: 'azure' as CloudType, label: 'Azure', sublabel: 'Microsoft Azure' },
							{ type: 'gcp' as CloudType, label: 'GCP', sublabel: 'Google Cloud' },
						]).map(({ type, label, sublabel }) => (
							<button
								key={type}
								onClick={() => handlePickCloud(type)}
								className="p-6 rounded-lg border border-neutral-700/50 bg-neutral-800/50 text-center hover:scale-[1.02] hover:border-green-500/30 hover:bg-neutral-800 transition-all flex flex-col items-center gap-3"
							>
								<ProviderIcon type={type} className="w-12 h-12" />
								<div>
									<div className="text-sm font-semibold text-neutral-100">{label}</div>
									<div className="text-xs text-neutral-500">{sublabel}</div>
								</div>
							</button>
						))}
					</div>
				) : (
					<div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
						{/* Provider Name */}
						<FormField label="Provider Name" required>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
								placeholder={`${teamName}-${cloudType}`}
							/>
						</FormField>

						{/* AWS Form */}
						{cloudType === 'aws' && (
							<>
								<div className="text-xs font-medium text-neutral-500 uppercase tracking-wide pt-2">Credentials</div>
								<FormField label="Region" required>
									<input
										type="text"
										value={awsRegion}
										onChange={(e) => setAwsRegion(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
										placeholder="us-east-1"
									/>
								</FormField>
								<FormField label="Access Key ID" required>
									<input
										type="password"
										value={awsAccessKeyId}
										onChange={(e) => setAwsAccessKeyId(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
										placeholder="AKIA..."
									/>
								</FormField>
								<FormField label="Secret Access Key" required>
									<input
										type="password"
										value={awsSecretAccessKey}
										onChange={(e) => setAwsSecretAccessKey(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
									/>
								</FormField>

								<div className="text-xs font-medium text-neutral-500 uppercase tracking-wide pt-2">Network</div>
								<FormField label="VPC ID">
									<input
										type="text"
										value={awsVpcId}
										onChange={(e) => setAwsVpcId(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
										placeholder="vpc-abc123"
									/>
								</FormField>
								<FormField label="Subnet IDs">
									{awsSubnetIds.map((id, i) => (
										<div key={i} className="flex gap-2 mb-2">
											<input
												type="text"
												value={id}
												onChange={(e) => updateListItem(awsSubnetIds, setAwsSubnetIds, i, e.target.value)}
												className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
												placeholder={`subnet-az${i + 1}`}
											/>
											{awsSubnetIds.length > 1 && (
												<button
													type="button"
													onClick={() => removeListItem(awsSubnetIds, setAwsSubnetIds, i)}
													className="text-neutral-500 hover:text-red-400 px-2"
												>
													&times;
												</button>
											)}
										</div>
									))}
									<button
										type="button"
										onClick={() => addListItem(awsSubnetIds, setAwsSubnetIds)}
										className="text-xs text-green-400 hover:text-green-300"
									>
										+ Add Subnet
									</button>
								</FormField>
								<FormField label="Security Group IDs">
									{awsSecurityGroupIds.map((id, i) => (
										<div key={i} className="flex gap-2 mb-2">
											<input
												type="text"
												value={id}
												onChange={(e) => updateListItem(awsSecurityGroupIds, setAwsSecurityGroupIds, i, e.target.value)}
												className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
												placeholder="sg-abc123"
											/>
											{awsSecurityGroupIds.length > 1 && (
												<button
													type="button"
													onClick={() => removeListItem(awsSecurityGroupIds, setAwsSecurityGroupIds, i)}
													className="text-neutral-500 hover:text-red-400 px-2"
												>
													&times;
												</button>
											)}
										</div>
									))}
									<button
										type="button"
										onClick={() => addListItem(awsSecurityGroupIds, setAwsSecurityGroupIds)}
										className="text-xs text-green-400 hover:text-green-300"
									>
										+ Add Security Group
									</button>
								</FormField>
							</>
						)}

						{/* Azure Form */}
						{cloudType === 'azure' && (
							<>
								<div className="text-xs font-medium text-neutral-500 uppercase tracking-wide pt-2">Credentials</div>
								<FormField label="Subscription ID" required>
									<input
										type="text"
										value={azureSubscriptionId}
										onChange={(e) => setAzureSubscriptionId(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
									/>
								</FormField>
								<FormField label="Tenant ID" required>
									<input
										type="text"
										value={azureTenantId}
										onChange={(e) => setAzureTenantId(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
									/>
								</FormField>
								<FormField label="Client ID" required>
									<input
										type="text"
										value={azureClientId}
										onChange={(e) => setAzureClientId(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
									/>
								</FormField>
								<FormField label="Client Secret" required>
									<input
										type="password"
										value={azureClientSecret}
										onChange={(e) => setAzureClientSecret(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
									/>
								</FormField>

								<div className="text-xs font-medium text-neutral-500 uppercase tracking-wide pt-2">Resource & Network</div>
								<FormField label="Resource Group">
									<input
										type="text"
										value={azureResourceGroup}
										onChange={(e) => setAzureResourceGroup(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
									/>
								</FormField>
								<FormField label="Location">
									<input
										type="text"
										value={azureLocation}
										onChange={(e) => setAzureLocation(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
										placeholder="eastus"
									/>
								</FormField>
								<FormField label="VNet Name">
									<input
										type="text"
										value={azureVnetName}
										onChange={(e) => setAzureVnetName(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
									/>
								</FormField>
								<FormField label="Subnet Name">
									<input
										type="text"
										value={azureSubnetName}
										onChange={(e) => setAzureSubnetName(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
									/>
								</FormField>
							</>
						)}

						{/* GCP Form */}
						{cloudType === 'gcp' && (
							<>
								<div className="text-xs font-medium text-neutral-500 uppercase tracking-wide pt-2">Credentials</div>
								<FormField label="Project ID" required>
									<input
										type="text"
										value={gcpProjectId}
										onChange={(e) => setGcpProjectId(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
										placeholder="my-project-123"
									/>
								</FormField>
								<FormField label="Region" required>
									<input
										type="text"
										value={gcpRegion}
										onChange={(e) => setGcpRegion(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
										placeholder="us-central1"
									/>
								</FormField>
								<FormField label="Service Account Key (JSON)" required>
									<div className="space-y-2">
										<textarea
											value={gcpServiceAccount}
											onChange={(e) => setGcpServiceAccount(e.target.value)}
											className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500 font-mono h-24 resize-none"
											placeholder='{"type": "service_account", ...}'
										/>
										<label className="text-xs text-green-400 hover:text-green-300 cursor-pointer">
											<input
												type="file"
												accept=".json"
												className="hidden"
												onChange={(e) => {
													const file = e.target.files?.[0]
													if (file) {
														const reader = new FileReader()
														reader.onload = (ev) => setGcpServiceAccount(ev.target?.result as string)
														reader.readAsText(file)
													}
												}}
											/>
											Upload JSON key file
										</label>
									</div>
								</FormField>

								<div className="text-xs font-medium text-neutral-500 uppercase tracking-wide pt-2">Network</div>
								<FormField label="VPC Network">
									<input
										type="text"
										value={gcpNetwork}
										onChange={(e) => setGcpNetwork(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
										placeholder="default"
									/>
								</FormField>
								<FormField label="Subnetwork">
									<input
										type="text"
										value={gcpSubnetwork}
										onChange={(e) => setGcpSubnetwork(e.target.value)}
										className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-green-500"
									/>
								</FormField>
							</>
						)}

						{/* Test Result */}
						{testResult && (
							<div className={`p-3 rounded-lg border ${
								testResult.valid
									? 'bg-green-500/10 border-green-500/20'
									: 'bg-red-500/10 border-red-500/20'
							}`}>
								<p className={`text-sm ${testResult.valid ? 'text-green-400' : 'text-red-400'}`}>
									{testResult.valid ? 'Connection successful' : 'Connection failed'}
								</p>
								{testResult.message && (
									<p className="text-xs text-neutral-400 mt-1">{testResult.message}</p>
								)}
							</div>
						)}
					</div>
				)}
			</ModalBody>

			<ModalFooter>
				{step === 'pick' ? (
					<Button variant="secondary" onClick={handleClose}>Cancel</Button>
				) : (
					<>
						<Button variant="secondary" onClick={() => { setStep('pick'); setTestResult(null) }} disabled={creating}>
							Back
						</Button>
						<Button
							variant="secondary"
							onClick={handleTest}
							disabled={!isFormValid || testing || creating}
						>
							{testing ? <><Spinner size="sm" /> Testing...</> : 'Test Connection'}
						</Button>
						<Button
							onClick={handleCreate}
							disabled={!isFormValid || creating}
						>
							{creating ? 'Connecting...' : 'Connect Account'}
						</Button>
					</>
				)}
			</ModalFooter>
		</Modal>
	)
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
	return (
		<div>
			<label className="block text-sm text-neutral-300 mb-1">
				{label}
				{required && <span className="text-red-400 ml-1">*</span>}
			</label>
			{children}
		</div>
	)
}
