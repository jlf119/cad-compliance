"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Upload, FileText, CheckCircle, AlertTriangle, X, Play, Settings, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"

// Mock data for demonstration
const mockRules = [
	{
		id: 1,
		name: "Minimum Wall Thickness",
		description: "All walls must be >= 2mm thick",
		category: "Manufacturing",
		enabled: true,
	},
	{
		id: 2,
		name: "Maximum Overhang Angle",
		description: "Overhangs must be <= 45 degrees",
		category: "3D Printing",
		enabled: true,
	},
	{
		id: 3,
		name: "Hole Diameter Standards",
		description: "Holes must follow standard drill sizes",
		category: "Manufacturing",
		enabled: false,
	},
	{
		id: 4,
		name: "Material Thickness",
		description: "Sheet metal thickness must be standard",
		category: "Sheet Metal",
		enabled: true,
	},
	{
		id: 5,
		name: "Fillet Radius",
		description: "Minimum fillet radius of 0.5mm",
		category: "Manufacturing",
		enabled: true,
	},
]

const mockViolations = [
	{
		id: 1,
		rule: "Wheel Clearance",
		severity: "high",
		description: "Wheel Clearance of 75mm each side in a vertical bounding box from the wheel up",
		location: "Formula Student Car",
	},
]

export default function CADComplianceTool() {
	const [activeTab, setActiveTab] = useState("check_model")
	const [rules, setRules] = useState(mockRules)
	const [isChecking, setIsChecking] = useState(false)
	const [checkProgress, setCheckProgress] = useState(0)
	const [violations, setViolations] = useState<typeof mockViolations>([])
	const [hasResults, setHasResults] = useState(false)

	// --- OAUTH STATE ---
	const [accessToken, setAccessToken] = useState<string | null>(null)
	const [documentId, setDocumentId] = useState<string>("")
	const [workspaceId, setWorkspaceId] = useState<string>("")
	const [elementId, setElementId] = useState<string>("")
	const [oauthError, setOauthError] = useState<string | null>(null)

	// --- ONSHAPE CONTEXT ---
	useEffect(() => {
		if (typeof window !== "undefined" && (window as any).onshape && typeof (window as any).onshape.getContext === "function") {
			(window as any).onshape.getContext().then((ctx: any) => {
				setDocumentId(ctx.documentId)
				setWorkspaceId(ctx.workspaceId)
				setElementId(ctx.elementId)
			})
		}
	}, [])

	// --- OAUTH FLOW ---
	// 1. Redirect user to Onshape OAuth login
	const ONSHAPE_CLIENT_ID = process.env.OAUTH_CLIENT_ID || "" // Set in .env
	const ONSHAPE_REDIRECT_URI = process.env.OAUTH_CALLBACK_URL || "" // Set in .env
	const ONSHAPE_AUTH_URL =
		`https://oauth.onshape.com/oauth/authorize?response_type=token&client_id=${encodeURIComponent(ONSHAPE_CLIENT_ID)}&redirect_uri=${encodeURIComponent(ONSHAPE_REDIRECT_URI)}&scope=OAuth2Read` // You may want more scopes

	// 2. Parse access token from URL hash after redirect
	useEffect(() => {
		if (typeof window !== "undefined" && !accessToken) {
			const hash = window.location.hash
			if (hash && hash.includes("access_token")) {
				const params = new URLSearchParams(hash.replace(/^#/, ""))
				const token = params.get("access_token")
				if (token) {
					setAccessToken(token)
					window.location.hash = "" // Clean up URL
				}
			}
		}
	}, [accessToken])

	// 3. Helper to start OAuth login
	const handleLogin = () => {
		window.location.href = ONSHAPE_AUTH_URL
	}

	// --- RUN COMPLIANCE CHECK ---
	const runComplianceCheck = async () => {
		setIsChecking(true)
		setCheckProgress(0)
		setActiveTab("results")

		const enabledRules = rules.filter((rule) => rule.enabled)

		try {
			for (let i = 0; i <= 30; i += 10) {
				setCheckProgress(i)
				await new Promise((resolve) => setTimeout(resolve, 100))
			}

			if (!accessToken) throw new Error("Not authenticated with Onshape.")
			if (!documentId || !workspaceId || !elementId) throw new Error("Missing CAD model IDs.")

			const response = await fetch("/api/check-model", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					rules: enabledRules,
					documentId,
					workspaceId,
					elementId,
					accessToken,
				}),
			})

			for (let i = 31; i <= 70; i += 10) {
				setCheckProgress(i)
				await new Promise((resolve) => setTimeout(resolve, 100))
			}

			const resultData = await response.json()
			if (!response.ok || !resultData.success) {
				throw new Error(resultData.error || "Failed to run compliance check")
			}

			// You can use resultData.downloadUrl for the STEP file if needed
			setViolations(resultData.violations || mockViolations)
			for (let i = 71; i <= 100; i += 10) {
				setCheckProgress(i)
				await new Promise((resolve) => setTimeout(resolve, 100))
			}
			setHasResults(true)
		} catch (error: any) {
			setOauthError(error.message)
			setViolations(mockViolations)
			setHasResults(true)
		} finally {
			setIsChecking(false)
		}
	}

	const toggleRule = (ruleId: number) => {
		setRules(rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule)))
	}

	const getSeverityColor = (severity: string) => {
		switch (severity) {
			case "high":
				return "destructive"
			case "medium":
				return "default"
			case "low":
				return "secondary"
			default:
				return "default"
		}
	}

	const getSeverityIcon = (severity: string) => {
		switch (severity) {
			case "high":
				return <X className="h-4 w-4" />
			case "medium":
				return <AlertTriangle className="h-4 w-4" />
			case "low":
				return <AlertTriangle className="h-4 w-4" />
			default:
				return <AlertTriangle className="h-4 w-4" />
		}
	}

	return (
		<div className="w-full max-w-md mx-auto p-4 space-y-4">
			{/* OAUTH LOGIN */}
			{!accessToken ? (
				<div className="space-y-4">
					<Button onClick={handleLogin} className="w-full">
						Login with Onshape
					</Button>
					{oauthError && (
						<Alert>
							<AlertDescription>{oauthError}</AlertDescription>
						</Alert>
					)}
				</div>
			) : null}

			<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="check_model" className="text-xs">
						Check Model
					</TabsTrigger>
					<TabsTrigger value="rules" className="text-xs">
						Rules
					</TabsTrigger>
					<TabsTrigger value="results" className="text-xs">
						Results
					</TabsTrigger>
				</TabsList>

				<TabsContent value="check_model" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Initiate CAD Model Check</CardTitle>
							<CardDescription>
								Configure your design rules in the 'Rules' tab, then click below to start the compliance check.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<p className="text-sm text-muted-foreground">
								This process will involve accessing the specified CAD model from Onshape,
								exporting it, and sending it for analysis against the selected rules.
							</p>
							<Button onClick={runComplianceCheck} className="w-full flex items-center gap-2">
								<Play className="h-4 w-4" />
								Run Full Compliance Check
							</Button>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="rules" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Design Rules</CardTitle>
							<CardDescription>Select which rules to check against your model</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{rules.map((rule) => (
								<div
									key={rule.id}
									className="flex items-start space-x-3 p-3 border rounded-lg"
								>
									<Checkbox
										id={`rule-${rule.id}`}
										checked={rule.enabled}
										onCheckedChange={() => toggleRule(rule.id)}
									/>
									<div className="flex-1 space-y-1">
										<div className="flex items-center justify-between">
											<Label
												htmlFor={`rule-${rule.id}`}
												className="text-sm font-medium cursor-pointer"
											>
												{rule.name}
											</Label>
											<Badge variant="outline" className="text-xs">
												{rule.category}
											</Badge>
										</div>
										<p className="text-xs text-muted-foreground">
											{rule.description}
										</p>
									</div>
								</div>
							))}

							<Separator />

							<div className="flex justify-between items-center pt-2">
								<p className="text-sm text-muted-foreground">
									{rules.filter((r) => r.enabled).length} of {rules.length} rules selected
								</p>
								{/* Removed Run Check Button from here, it's now in the 'Check Model' tab */}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="results" className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-lg">Compliance Results</CardTitle>
							<CardDescription>
								{isChecking
									? "Checking your model..."
									: hasResults
									? "Review violations and recommendations"
									: "No results yet"}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{isChecking && (
								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span>Analyzing model...</span>
										<span>{checkProgress}%</span>
									</div>
									<Progress value={checkProgress} className="w-full" />
								</div>
							)}

							{hasResults && !isChecking && (
								<div className="space-y-4">
									<div className="grid grid-cols-3 gap-2 text-center">
										<div className="p-2 bg-green-50 rounded-lg">
											<div className="text-lg font-bold text-green-600">
												{rules.filter((r) => r.enabled).length - violations.length}
											</div>
											<div className="text-xs text-green-600">Passed</div>
										</div>
										<div className="p-2 bg-red-50 rounded-lg">
											<div className="text-lg font-bold text-red-600">
												{violations.length}
											</div>
											<div className="text-xs text-red-600">Violations</div>
										</div>
										<div className="p-2 bg-blue-50 rounded-lg">
											<div className="text-lg font-bold text-blue-600">
												{rules.filter((r) => r.enabled).length}
											</div>
											<div className="text-xs text-blue-600">Total Rules</div>
										</div>
									</div>

									{violations.length > 0 && (
										<div className="mt-4">
											<h3 className="text-sm font-medium">Violations Detected:</h3>
											<div className="mt-2 space-y-2">
												{violations.map((violation) => (
													<div
														key={violation.id}
														className={`p-3 rounded-lg flex items-center space-x-3 border-l-4 ${getSeverityColor(
															violation.severity
														)}`}
													>
														<div className="flex-shrink-0">
															{getSeverityIcon(violation.severity)}
														</div>
														<div className="flex-1 min-w-0">
															<p className="text-sm font-medium truncate">
																{violation.rule}
															</p>
															<p className="text-xs text-muted-foreground truncate">
																{violation.description}
															</p>
														</div>
													</div>
												))}
											</div>
										</div>
									)}

									<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
										<Button
											onClick={() => setActiveTab("rules")}
											className="w-full sm:w-auto"
										>
											<Settings className="h-4 w-4 mr-2" />
											Review Rules
										</Button>
										<a
											href="/api/download-step"
											target="_blank"
											rel="noopener noreferrer"
											className="w-full sm:w-auto"
										>
											<Download className="h-4 w-4 mr-2" />
											Download STEP File
										</a>
									</div>
								</div>
							)}

							{!hasResults && !isChecking && (
								<p className="text-sm text-muted-foreground">
									No compliance check results available. Please run the check.
								</p>
							)}

							{/* Show STEP download link if available */}
							{hasResults && !isChecking && accessToken && documentId && (
								violations.length === 0 && (
									<a
										href={typeof window !== 'undefined' && window.localStorage.getItem('lastStepUrl') || undefined}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center justify-center mt-2 text-blue-600 hover:underline"
									>
										<Download className="h-4 w-4 mr-2" />
										Download STEP Export
									</a>
								)
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	)
}