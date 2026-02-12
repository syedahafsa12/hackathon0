import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface DashboardData {
    content: string;
    sections: Record<string, {
        raw: string;
        data: Record<string, string>;
    }>;
    modified: string;
}

const DashboardViewer: React.FC = () => {
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboard();
        const interval = setInterval(fetchDashboard, 10000); // Auto-refresh every 10 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchDashboard = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/vault/dashboard`);

            if (!response.ok) {
                throw new Error('Failed to fetch dashboard');
            }

            const result = await response.json();
            if (result.success) {
                setDashboard(result.data);
                setError(null);
            }
        } catch (err) {
            console.error('Error fetching dashboard:', err);
            setError('Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-12">
                <div className="flex justify-center items-center">
                    <div className="flex space-x-2">
                        <div className="w-3 h-3 rounded-full bg-pink-300 animate-bounce"></div>
                        <div className="w-3 h-3 rounded-full bg-pink-300 animate-bounce delay-75"></div>
                        <div className="w-3 h-3 rounded-full bg-pink-300 animate-bounce delay-150"></div>
                    </div>
                </div>
                <p className="text-center text-gray-500 mt-4">Loading dashboard...</p>
            </div>
        );
    }

    if (error || !dashboard) {
        return (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-12 text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-gray-700 mb-2">Error Loading Dashboard</h2>
                <p className="text-gray-500 mb-4">{error || 'Dashboard not found'}</p>
                <button
                    onClick={fetchDashboard}
                    className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full hover:opacity-90"
                >
                    Retry
                </button>
            </div>
        );
    }

    const sections = dashboard.sections || {};

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-3xl shadow-lg p-8 text-white">
                <h1 className="text-3xl font-bold mb-2">📊 Mini Hafsa Dashboard</h1>
                <p className="text-sm opacity-80">Real-time system overview</p>
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs">Last updated: {formatDate(dashboard.modified)}</span>
                    <button
                        onClick={fetchDashboard}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full text-sm transition-colors"
                    >
                        ↻ Refresh
                    </button>
                </div>
            </div>

            {/* System State */}
            {sections['System State'] && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-6 border border-pink-100">
                    <h2 className="text-xl font-bold text-pink-600 mb-4">System State</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {Object.entries(sections['System State'].data).map(([key, value]) => (
                            <div key={key} className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-4">
                                <div className="text-sm text-gray-600">{key}</div>
                                <div className="text-lg font-bold text-gray-900 mt-1">{value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Financial Overview */}
            {sections['Financial Overview'] && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-6 border border-pink-100">
                    <h2 className="text-xl font-bold text-pink-600 mb-4">💰 Financial Overview</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {Object.entries(sections['Financial Overview'].data).map(([key, value]) => (
                            <div key={key} className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
                                <div className="text-sm text-gray-600">{key}</div>
                                <div className="text-lg font-bold text-gray-900 mt-1">{value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Projects */}
            {sections['Active Projects'] && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-6 border border-pink-100">
                    <h2 className="text-xl font-bold text-pink-600 mb-4">🚀 Active Projects</h2>
                    <div className="prose prose-pink max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-xl">
                            {sections['Active Projects'].raw}
                        </pre>
                    </div>
                </div>
            )}

            {/* Pending Actions */}
            {sections['Pending Actions'] && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-6 border border-pink-100">
                    <h2 className="text-xl font-bold text-pink-600 mb-4">⏳ Pending Actions</h2>
                    <div className="prose prose-pink max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-xl">
                            {sections['Pending Actions'].raw}
                        </pre>
                    </div>
                </div>
            )}

            {/* Recent Activity */}
            {sections['Recent Activity'] && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-6 border border-pink-100">
                    <h2 className="text-xl font-bold text-pink-600 mb-4">📝 Recent Activity</h2>
                    <div className="prose prose-pink max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-xl">
                            {sections['Recent Activity'].raw}
                        </pre>
                    </div>
                </div>
            )}

            {/* System Health */}
            {sections['System Health'] && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-6 border border-pink-100">
                    <h2 className="text-xl font-bold text-pink-600 mb-4">💚 System Health</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(sections['System Health'].data).map(([key, value]) => (
                            <div key={key} className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4">
                                <div className="text-sm text-gray-600">{key}</div>
                                <div className="text-lg font-bold text-gray-900 mt-1">{value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Next Steps */}
            {sections['Next Steps'] && (
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-6 border border-pink-100">
                    <h2 className="text-xl font-bold text-pink-600 mb-4">🎯 Next Steps</h2>
                    <div className="prose prose-pink max-w-none">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-gray-50 p-4 rounded-xl">
                            {sections['Next Steps'].raw}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardViewer;
