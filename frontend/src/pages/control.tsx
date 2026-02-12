import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface SystemHealth {
  status: string;
  timestamp: string;
  uptime: number;
  watchers: string[];
  watcherCount: number;
  orchestratorRunning: boolean;
  agents: string[];
  vaultPath: string;
  vaultStatus: string;
  database: string;
  pendingApprovals: number;
  demoMode: boolean;
}

interface AgentStatus {
  name: string;
  displayName: string;
  description: string;
  status: 'running' | 'idle' | 'error' | 'loading';
  lastRun?: string;
  actionLabel: string;
  actionEndpoint: string;
  icon: string;
}

export default function ControlPanel() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([
    {
      name: 'prioritySorter',
      displayName: 'Priority Sorter',
      description: 'Generates daily priority plan at 6 AM or on demand',
      status: 'idle',
      actionLabel: 'Generate Priority Plan',
      actionEndpoint: '/api/priority/generate',
      icon: '🎯',
    },
    {
      name: 'newsAgent',
      displayName: 'News Agent',
      description: 'Fetches curated news from Tech, AI, and World categories',
      status: 'idle',
      actionLabel: 'Fetch News Now',
      actionEndpoint: '/api/news/fetch',
      icon: '📰',
    },
    {
      name: 'ceoBriefing',
      displayName: 'CEO Briefing',
      description: 'Generates weekly summary with insights (Sunday 8 PM)',
      status: 'idle',
      actionLabel: 'Generate Briefing',
      actionEndpoint: '/api/briefing/generate',
      icon: '📊',
    },
    {
      name: 'ralphLoop',
      displayName: 'Ralph Loop',
      description: 'Multi-step autonomous task executor',
      status: 'idle',
      actionLabel: 'View Active Tasks',
      actionEndpoint: '',
      icon: '🤖',
    },
  ]);
  const [actionResults, setActionResults] = useState<Record<string, any>>({});
  const [loadingAgents, setLoadingAgents] = useState<Set<string>>(new Set());

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/system/health`);
      if (!res.ok) throw new Error('Failed to fetch health');
      const data = await res.json();
      setHealth(data);
      setHealthError(null);
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const triggerAgent = async (agent: AgentStatus) => {
    if (!agent.actionEndpoint || loadingAgents.has(agent.name)) return;

    setLoadingAgents(prev => new Set(prev).add(agent.name));
    setAgents(prev => prev.map(a =>
      a.name === agent.name ? { ...a, status: 'loading' } : a
    ));

    try {
      const res = await fetch(`${API_BASE_URL}${agent.actionEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      setActionResults(prev => ({
        ...prev,
        [agent.name]: { success: data.success, data, timestamp: new Date().toISOString() },
      }));

      setAgents(prev => prev.map(a =>
        a.name === agent.name
          ? { ...a, status: data.success ? 'running' : 'error', lastRun: new Date().toISOString() }
          : a
      ));

      // Reset to idle after a delay
      setTimeout(() => {
        setAgents(prev => prev.map(a =>
          a.name === agent.name ? { ...a, status: 'idle' } : a
        ));
      }, 3000);
    } catch (err) {
      setActionResults(prev => ({
        ...prev,
        [agent.name]: { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      }));
      setAgents(prev => prev.map(a =>
        a.name === agent.name ? { ...a, status: 'error' } : a
      ));
    } finally {
      setLoadingAgents(prev => {
        const next = new Set(prev);
        next.delete(agent.name);
        return next;
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'loading': return 'bg-yellow-500 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <Head>
        <title>Control Panel - Mini Hafsa 2.0</title>
        <meta name="description" content="Agent control panel for Mini Hafsa AI" />
      </Head>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-pink-100 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
                Control Panel
              </h1>
            </Link>
            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
              Agent Manager
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-pink-600 hover:text-pink-800 transition-colors">
              Dashboard
            </Link>
            <Link href="/vault" className="text-sm text-purple-600 hover:text-purple-800 transition-colors">
              Vault
            </Link>
            <Link href="/logs" className="text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Logs
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* System Health Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-pink-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>System Health</span>
            {health && (
              <span className={`w-3 h-3 rounded-full ${health.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></span>
            )}
          </h2>

          {healthError ? (
            <div className="text-red-500 p-4 bg-red-50 rounded-lg">
              Error: {healthError}
            </div>
          ) : health ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
                <div className="text-sm text-gray-500">Database</div>
                <div className="text-lg font-bold text-green-600 capitalize">{health.database}</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                <div className="text-sm text-gray-500">Vault</div>
                <div className="text-lg font-bold text-blue-600 capitalize">{health.vaultStatus}</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                <div className="text-sm text-gray-500">Watchers</div>
                <div className="text-lg font-bold text-purple-600">{health.watcherCount} / 6</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl">
                <div className="text-sm text-gray-500">Uptime</div>
                <div className="text-lg font-bold text-orange-600">{formatUptime(health.uptime)}</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl">
                <div className="text-sm text-gray-500">Pending Approvals</div>
                <div className="text-lg font-bold text-pink-600">{health.pendingApprovals}</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-xl">
                <div className="text-sm text-gray-500">Orchestrator</div>
                <div className="text-lg font-bold text-cyan-600">{health.orchestratorRunning ? 'Running' : 'Stopped'}</div>
              </div>
              <div className="p-4 bg-gradient-to-br from-violet-50 to-fuchsia-50 rounded-xl col-span-2">
                <div className="text-sm text-gray-500">Mode</div>
                <div className="text-lg font-bold text-violet-600">{health.demoMode ? 'Demo Mode' : 'Production'}</div>
              </div>
            </div>
          ) : (
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            </div>
          )}
        </div>

        {/* Agent Cards */}
        <h2 className="text-xl font-bold text-gray-800">Autonomous Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {agents.map(agent => (
            <div
              key={agent.name}
              className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-pink-100 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{agent.icon}</span>
                  <div>
                    <h3 className="font-bold text-gray-800">{agent.displayName}</h3>
                    <p className="text-sm text-gray-500">{agent.description}</p>
                  </div>
                </div>
                <div className={`w-3 h-3 rounded-full ${getStatusColor(agent.status)}`}></div>
              </div>

              {agent.lastRun && (
                <div className="text-xs text-gray-400 mb-3">
                  Last run: {new Date(agent.lastRun).toLocaleTimeString()}
                </div>
              )}

              {actionResults[agent.name] && (
                <div className={`text-sm p-3 rounded-lg mb-3 ${
                  actionResults[agent.name].success
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}>
                  {actionResults[agent.name].success
                    ? 'Action completed successfully!'
                    : `Error: ${actionResults[agent.name].error || 'Unknown error'}`}
                </div>
              )}

              {agent.actionEndpoint ? (
                <button
                  onClick={() => triggerAgent(agent)}
                  disabled={loadingAgents.has(agent.name)}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-2 px-4 rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                  {loadingAgents.has(agent.name) ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Running...</span>
                    </>
                  ) : (
                    agent.actionLabel
                  )}
                </button>
              ) : (
                <Link
                  href="/dashboard"
                  className="block w-full bg-gray-100 text-gray-600 py-2 px-4 rounded-xl font-medium text-center hover:bg-gray-200 transition-colors"
                >
                  {agent.actionLabel}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Watchers Status */}
        <h2 className="text-xl font-bold text-gray-800 mt-8">Registered Watchers</h2>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6 border border-pink-100">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {(health?.watchers || []).map((watcher) => (
              <div
                key={watcher}
                className="flex items-center gap-2 p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl"
              >
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-gray-700 capitalize">
                  {watcher.replace('Watcher', '')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-4 mt-6">
          <Link
            href="/vault"
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow px-6 py-3 border border-pink-100 hover:shadow-lg transition-shadow flex items-center gap-2"
          >
            <span>View Vault in Browser</span>
          </Link>
          <button
            onClick={fetchHealth}
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow px-6 py-3 border border-pink-100 hover:shadow-lg transition-shadow flex items-center gap-2"
          >
            <span>Refresh Status</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 py-4 text-center text-xs text-gray-400">
        <p>Mini Hafsa 2.0 - Hackathon 0 Compliant - Local-First + HITL</p>
      </footer>
    </div>
  );
}
