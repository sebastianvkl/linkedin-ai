import { useState, useEffect } from "react"
import { Storage } from "@plasmohq/storage"
import type { ToneType } from "~lib/prompts"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { Textarea } from "~components/ui/textarea"
import { Card, CardContent } from "~components/ui/card"
import { Label } from "~components/ui/label"
import { Separator } from "~components/ui/separator"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "~components/ui/collapsible"
import {
  Sparkles,
  Key,
  ChevronDown,
  Check,
  AlertCircle,
  Keyboard,
  Send,
  Settings2,
  Calendar
} from "lucide-react"
import { cn } from "~lib/utils"

import "~style.css"

const storage = new Storage()

function SidePanel() {
  const [apiKey, setApiKey] = useState("")
  const [tone, setTone] = useState<ToneType>("professional")
  const [meetingLink, setMeetingLink] = useState("")
  const [userContext, setUserContext] = useState("")
  const [customInstructions, setCustomInstructions] = useState("")
  const [outreachInstructions, setOutreachInstructions] = useState("")
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      const savedKey = await storage.get<string>("claude_api_key")
      const savedTone = await storage.get<ToneType>("tone")
      const savedMeetingLink = await storage.get<string>("meeting_link")
      const savedContext = await storage.get<string>("user_context")
      const savedInstructions = await storage.get<string>("custom_instructions")
      const savedOutreachInstructions = await storage.get<string>(
        "outreach_instructions"
      )

      if (savedKey) setApiKey(savedKey)
      if (savedTone) setTone(savedTone)
      if (savedMeetingLink) setMeetingLink(savedMeetingLink)
      if (savedContext) setUserContext(savedContext)
      if (savedInstructions) setCustomInstructions(savedInstructions)
      if (savedOutreachInstructions)
        setOutreachInstructions(savedOutreachInstructions)

      if (savedContext || savedInstructions || savedOutreachInstructions) {
        setShowAdvanced(true)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    await storage.set("claude_api_key", apiKey)
    await storage.set("tone", tone)
    await storage.set("meeting_link", meetingLink)
    await storage.set("user_context", userContext)
    await storage.set("custom_instructions", customInstructions)
    await storage.set("outreach_instructions", outreachInstructions)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestResult({ success: false, message: "Please enter an API key first" })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }]
        })
      })

      if (response.ok) {
        setTestResult({ success: true, message: "Connection successful!" })
      } else {
        const data = await response.json().catch(() => ({}))
        setTestResult({
          success: false,
          message: data.error?.message || `Error: ${response.status}`
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection failed"
      })
    } finally {
      setTesting(false)
    }
  }

  const toneOptions: { value: ToneType; label: string }[] = [
    { value: "professional", label: "Professional" },
    { value: "friendly", label: "Friendly" },
    { value: "casual", label: "Casual" }
  ]

  return (
    <div className="w-full min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0a66c2] to-[#004182] flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">
              LinkedIn AI Reply
            </h1>
            <p className="text-xs text-muted-foreground">Powered by Claude</p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Main Settings Card */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* API Key */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Key className="w-3.5 h-3.5 text-muted-foreground" />
                API Key
              </Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                Get your key from{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>

            <Separator />

            {/* Tone Selection */}
            <div className="space-y-2">
              <Label className="text-sm">Response Tone</Label>
              <div className="flex gap-2">
                {toneOptions.map((option) => (
                  <Button
                    key={option.value}
                    variant={tone === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTone(option.value)}
                    className={cn(
                      "flex-1 h-9",
                      tone === option.value && "shadow-sm"
                    )}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Meeting Link */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Meeting Scheduler Link
              </Label>
              <Input
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://calendly.com/your-link"
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                Used when generating "schedule a call" messages
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full text-primary hover:text-primary/80 hover:bg-primary/5"
            >
              <Settings2 className="w-4 h-4 mr-2" />
              {showAdvanced ? "Hide" : "Show"} Advanced Settings
              <ChevronDown
                className={cn(
                  "w-4 h-4 ml-auto transition-transform duration-200",
                  showAdvanced && "rotate-180"
                )}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">About Me & Company</Label>
                  <Textarea
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                    placeholder="Describe yourself and your company to help generate more relevant replies..."
                    className="min-h-[100px] resize-none"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm">Reply Instructions</Label>
                  <Textarea
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Custom rules for generating replies..."
                    className="min-h-[100px] resize-none"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm">Outreach Template</Label>
                  <Textarea
                    value={outreachInstructions}
                    onChange={(e) => setOutreachInstructions(e.target.value)}
                    placeholder="Rules for generating cold outreach messages..."
                    className="min-h-[100px] resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Test Result */}
        {testResult && (
          <div
            className={cn(
              "flex items-center gap-2 p-3 rounded-lg text-sm font-medium",
              testResult.success
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            )}
          >
            {testResult.success ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {testResult.message}
          </div>
        )}
      </div>

      {/* Fixed Footer */}
      <div className="p-4 border-t bg-card space-y-3">
        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            className={cn(
              "flex-1 h-10 shadow-md transition-all",
              saved && "bg-green-600 hover:bg-green-600"
            )}
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testing}
            className="h-10 px-6"
          >
            {testing ? "Testing..." : "Test"}
          </Button>
        </div>

        {/* Quick Tips */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
              Ctrl+Shift+A
            </kbd>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            <span>Click to insert</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SidePanel
