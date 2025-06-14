"use client"

import type React from "react"

import { useState } from "react"
import { Upload, FileText, CheckCircle, AlertTriangle, X, Play, Settings } from "lucide-react"
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
  }
]

export default function CADComplianceTool() {
  const [activeTab, setActiveTab] = useState("check_model")
  const [rules, setRules] = useState(mockRules)
  const [isChecking, setIsChecking] = useState(false)
  const [checkProgress, setCheckProgress] = useState(0)
  const [violations, setViolations] = useState<typeof mockViolations>([])
  const [hasResults, setHasResults] = useState(false)

  const toggleRule = (ruleId: number) => {
    setRules(rules.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule)))
  }

  const runComplianceCheck = async () => {
    setIsChecking(true)
    setCheckProgress(0)
    setActiveTab("results")

    const enabledRules = rules.filter((rule) => rule.enabled)

    try {
      // Simulate initial progress before API call
      for (let i = 0; i <= 30; i += 10) {
        setCheckProgress(i)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      const response = await fetch("/api/check-model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rules: enabledRules }),
      })

      // Simulate remaining progress during/after API call
      for (let i = 31; i <= 70; i += 10) {
        setCheckProgress(i)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      if (!response.ok) {
        throw new Error("Failed to run compliance check")
      }

      const resultData = await response.json()

      setViolations(resultData.violations || mockViolations) // Fallback to mockViolations if API doesn't provide them yet
      
      for (let i = 71; i <= 100; i += 10) {
        setCheckProgress(i)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      
      setHasResults(true)
    } catch (error) {
      console.error("Error running compliance check:", error)
      // Handle error state, maybe set a message in the UI
      setViolations(mockViolations) // Show mock violations on error for now
      setHasResults(true) // Or set to false and display an error message
    } finally {
      setIsChecking(false)
    }
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
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold">CAD Compliance Checker</h1>
        <p className="text-sm text-muted-foreground">Validate your CAD models against design rules</p>
      </div>

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
                <div key={rule.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                  <Checkbox id={`rule-${rule.id}`} checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`rule-${rule.id}`} className="text-sm font-medium cursor-pointer">
                        {rule.name}
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {rule.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
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
                      <div className="text-lg font-bold text-red-600">{violations.length}</div>
                      <div className="text-xs text-red-600">Violations</div>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <div className="text-lg font-bold text-blue-600">
                        {Math.round(
                          ((rules.filter((r) => r.enabled).length - violations.length) /
                            rules.filter((r) => r.enabled).length) *
                            100,
                        )}
                        %
                      </div>
                      <div className="text-xs text-blue-600">Score</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Violations Found</h4>
                    {violations.map((violation) => (
                      <div key={violation.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getSeverityIcon(violation.severity)}
                            <span className="font-medium text-sm">{violation.rule}</span>
                          </div>
                          <Badge variant={getSeverityColor(violation.severity) as any} className="text-xs">
                            {violation.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{violation.description}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Settings className="h-3 w-3" />
                          {violation.location}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setHasResults(false)
                      setViolations([])
                      setActiveTab("check_model") // Navigate to check_model tab
                    }}
                  >
                    Run New Check
                  </Button>
                </div>
              )}

              {!isChecking && !hasResults && (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No compliance check results yet</p>
                  <p className="text-xs">Upload rules and run a check to see results</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
