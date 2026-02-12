import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface LogFile {
    fileName: string;
    createdAt: string;
    size: number;
    data?: any;
    content?: string;
}

export default function LogViewer() {
    const [logs, setLogs] = useState<LogFile[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState('system');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLog, setSelectedLog] = useState<LogFile | null>(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchLogs(activeCategory);
    }, [activeCategory]);

    const fetchCategories = async () => {
        try {
            const resp = await fetch(`${API_BASE_URL}/api/logs/categories`);
            const data = await resp.json();
            if (data.success) {
                setCategories(data.data);
            }
        } catch (err) {
            console.error('Failed to fetch categories');
        }
    };

    const fetchLogs = async (category: string) => {
        setLoading(true);
        setError(null);
        try {
            const resp = await fetch(`${API_BASE_URL}/api/logs?category=${category}`);
            const data = await resp.json();
            if (data.success) {
                setLogs(data.data);
            } else {
                setError(data.error || 'Failed to fetch logs');
            }
        } catch (err) {
            setError('Connection refused');
        } finally {
            setLoading(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-6">
            <Head>
                <title>Mini Hafsa 2.0 - Log Viewer</title>
            </Head>

            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
                            Observable Execution Logs
                        </h1>
                        <p className="text-gray-500">Hackathon 0 Principle #5: Observable Execution</p>
                    </div>
                    <Link href="/dashboard" className="bg-white px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all text-pink-600 font-medium">
                        ← Back to Dashboard
                    </Link>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar - Categories */}
                    <div className="lg:col-span-1 space-y-2">
                        <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest px-2 mb-4">Categories</h2>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`w-full text-left px-4 py-3 rounded-2xl transition-all font-bold ${activeCategory === cat
                                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                                        : 'bg-white/60 text-gray-600 hover:bg-white'
                                    }`}
                            >
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* Main Content - Log List */}
                    <div className="lg:col-span-3 space-y-4">
                        {loading ? (
                            <div className="bg-white/60 rounded-3xl p-12 text-center animate-pulse">
                                <span className="text-4xl">🔄</span>
                                <p className="mt-4 text-gray-400 font-bold">Fetching logs...</p>
                            </div>
                        ) : error ? (
                            <div className="bg-red-50 border border-red-100 rounded-3xl p-8 text-center text-red-500 font-bold">
                                ⚠️ {error}
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="bg-white/60 rounded-3xl p-12 text-center">
                                <span className="text-4xl">📭</span>
                                <p className="mt-4 text-gray-400 font-bold">No logs found in this category.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {logs.map(log => (
                                    <div
                                        key={log.fileName}
                                        onClick={() => setSelectedLog(log)}
                                        className="bg-white/80 p-4 rounded-2xl border border-pink-50 hover:border-pink-200 transition-all cursor-pointer shadow-sm hover:shadow-md"
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">📄</span>
                                                <div>
                                                    <h3 className="font-bold text-gray-800">{log.fileName}</h3>
                                                    <p className="text-xs text-gray-400">
                                                        {new Date(log.createdAt).toLocaleString()} • {formatSize(log.size)}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-pink-300">View →</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Log Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-pink-50 to-purple-50">
                            <div>
                                <h2 className="font-black text-gray-800 text-lg">{selectedLog.fileName}</h2>
                                <p className="text-xs text-gray-500">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white transition-colors text-2xl"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto p-6 bg-gray-900 text-gray-300 font-mono text-sm">
                            <pre className="whitespace-pre-wrap">
                                {selectedLog.data
                                    ? JSON.stringify(selectedLog.data, null, 2)
                                    : selectedLog.content || "No content to display."
                                }
                            </pre>
                        </div>

                        <div className="p-4 bg-gray-50 flex justify-end gap-2 text-xs font-bold text-gray-400">
                            <span>JSON Format</span>
                            <span>•</span>
                            <span>Encrypted on Disk</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
