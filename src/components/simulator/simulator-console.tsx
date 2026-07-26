"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  SimulatorReport,
  SimulatorScenarioResult,
  SimulatorScenarioSummary,
} from "@/lib/simulator/types";

const TAG_PRESETS = ["smoke", "workflow", "security", "sla"] as const;

type LoadPayload = {
  scenarios: SimulatorScenarioSummary[];
  report: SimulatorReport;
  summary: {
    total: number;
    passed: number;
    failed: number;
    updatedAt: string | null;
  };
};

export function SimulatorConsole() {
  const [scenarios, setScenarios] = useState<SimulatorScenarioSummary[]>([]);
  const [report, setReport] = useState<SimulatorReport>({
    results: [],
    updatedAt: null,
  });
  const [summary, setSummary] = useState({
    total: 0,
    passed: 0,
    failed: 0,
    updatedAt: null as string | null,
  });
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastStdout, setLastStdout] = useState<string | null>(null);

  const applyPayload = useCallback((payload: Partial<LoadPayload>) => {
    if (payload.scenarios) {
      setScenarios(payload.scenarios);
    }
    if (payload.report) {
      setReport(payload.report);
    }
    if (payload.summary) {
      setSummary(payload.summary);
    }
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/simulator");
    const json = (await response.json()) as {
      success: boolean;
      error?: string;
      data?: LoadPayload;
    };
    if (!response.ok || !json.success || !json.data) {
      throw new Error(json.error ?? "Unable to load simulator state.");
    }
    applyPayload(json.data);
  }, [applyPayload]);

  useEffect(() => {
    refresh()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  const filteredScenarios = useMemo(() => {
    const list = scenarios ?? [];
    if (!selectedTag) return list;
    return list.filter((item) => item.tags.includes(selectedTag));
  }, [scenarios, selectedTag]);

  const resultsByName = useMemo(() => {
    const map = new Map<string, SimulatorScenarioResult>();
    for (const result of report.results ?? []) {
      map.set(result.name, result);
    }
    return map;
  }, [report.results]);

  async function run(options?: { tags?: string[]; name?: string }) {
    setRunning(true);
    setError(null);
    setLastStdout(null);
    try {
      const response = await fetch("/api/simulator/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options ?? {}),
      });
      const json = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: LoadPayload & {
          ok: boolean;
          stdout?: string;
          stderr?: string;
        };
      };
      if (!response.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Simulator run failed.");
      }
      applyPayload(json.data);
      setLastStdout(
        [json.data.stdout, json.data.stderr].filter(Boolean).join("\n").trim() ||
          null
      );
      if (options?.name) {
        setExpanded((prev) => ({ ...prev, [options.name!]: true }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulator run failed.");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading simulator…</p>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Latest run</CardTitle>
          <CardDescription>
            {summary.updatedAt
              ? `Report updated ${new Date(summary.updatedAt).toLocaleString()}`
              : "No report yet — run a suite to generate results."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant={summary.failed === 0 && summary.total > 0 ? "success" : summary.total === 0 ? "secondary" : "destructive"}>
            {summary.passed}/{summary.total} passed
          </Badge>
          {summary.failed > 0 && (
            <Badge variant="destructive">{summary.failed} failed</Badge>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={running}
              onClick={() => refresh().catch((err: Error) => setError(err.message))}
            >
              Refresh
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={running}
              onClick={() => run()}
            >
              {running ? "Running…" : "Run all"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={selectedTag === null ? "default" : "outline"}
          disabled={running}
          onClick={() => {
            setSelectedTag(null);
            setSelectedName(null);
          }}
        >
          All tags
        </Button>
        {TAG_PRESETS.map((tag) => (
          <Button
            key={tag}
            type="button"
            size="sm"
            variant={selectedTag === tag ? "default" : "outline"}
            disabled={running}
            onClick={() => {
              setSelectedTag(tag);
              setSelectedName(null);
            }}
          >
            {tag}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="ml-auto"
          disabled={running || !selectedTag}
          onClick={() => run({ tags: selectedTag ? [selectedTag] : undefined })}
        >
          Run {selectedTag ?? "selected"} tag
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {filteredScenarios.map((scenario) => {
          const result = resultsByName.get(scenario.name);
          const isOpen = expanded[scenario.name] ?? false;
          const selected = selectedName === scenario.name;

          return (
            <Card
              key={scenario.file}
              className={selected ? "ring-2 ring-primary/40" : undefined}
            >
              <CardHeader className="space-y-3 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{scenario.name}</CardTitle>
                    <CardDescription>
                      {scenario.actionCount} actions · {scenario.assertionCount}{" "}
                      assertions · {scenario.file}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {result ? (
                      <Badge variant={result.ok ? "success" : "destructive"}>
                        {result.ok ? "PASS" : "FAIL"}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Not run</Badge>
                    )}
                    {scenario.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={running}
                    onClick={() => {
                      setSelectedName(scenario.name);
                      void run({ name: scenario.name });
                    }}
                  >
                    Run this
                  </Button>
                  {result && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExpanded((prev) => ({
                          ...prev,
                          [scenario.name]: !isOpen,
                        }))
                      }
                    >
                      {isOpen ? "Hide steps" : "Show steps"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              {isOpen && result && (
                <CardContent className="space-y-2 border-t pt-4">
                  <p className="text-xs text-muted-foreground">
                    {new Date(result.startedAt).toLocaleString()} →{" "}
                    {new Date(result.finishedAt).toLocaleString()}
                  </p>
                  <ul className="space-y-2">
                    {result.steps.map((step, index) => (
                      <li
                        key={`${step.step}-${index}`}
                        className="rounded-md border px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={
                              step.ok
                                ? "font-medium text-emerald-700"
                                : "font-medium text-destructive"
                            }
                          >
                            {step.ok ? "✓" : "✗"} {step.step}
                          </span>
                          <span className="text-muted-foreground">
                            ({step.actor}) · {step.durationMs}ms
                          </span>
                          {step.correlationId && (
                            <span className="font-mono text-xs text-muted-foreground">
                              {step.correlationId}
                            </span>
                          )}
                        </div>
                        {!step.ok && (
                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {step.error && <p>Error: {step.error}</p>}
                            <p>Expected: {stringify(step.expected)}</p>
                            <p>Actual: {stringify(step.actual)}</p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {lastStdout && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Console output</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-80 overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
              {lastStdout}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
