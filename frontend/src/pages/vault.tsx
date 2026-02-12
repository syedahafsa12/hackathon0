import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import VaultExplorer from '@/components/vault/VaultExplorer';
import MarkdownViewer from '@/components/vault/MarkdownViewer';
import DashboardViewer from '@/components/vault/DashboardViewer';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export default function VaultPage() {
    const [selectedFile, setSelectedFile] = useState<string | null>('Dashboard.md');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
            <Head>
                <title>Obsidian Vault - Mini Hafsa</title>
                <meta name="description" content="Browse your Obsidian vault" />
            </Head>

            {/* Header */}
            <header className="bg-white/80 backdrop-blur-sm border-b border-pink-100 sticky top-0 z-40">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <span className="text-xl">←</span>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-600">
                            Obsidian Vault
                        </h1>
                    </Link>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden px-3 py-1 bg-pink-100 text-pink-600 rounded-full text-sm"
                        >
                            {sidebarOpen ? 'Hide' : 'Show'} Folders
                        </button>
                        <span className="text-sm text-gray-500">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-10rem)]">

                    {/* Left Sidebar - Folder Tree */}
                    <div className={`lg:col-span-1 ${sidebarOpen ? 'block' : 'hidden lg:block'}`}>
                        <VaultExplorer
                            onFileSelect={setSelectedFile}
                            selectedFile={selectedFile}
                        />
                    </div>

                    {/* Right Panel - File Viewer */}
                    <div className="lg:col-span-3">
                        {selectedFile === 'Dashboard.md' ? (
                            <DashboardViewer />
                        ) : selectedFile ? (
                            <MarkdownViewer filePath={selectedFile} />
                        ) : (
                            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-12 text-center">
                                <div className="text-6xl mb-4">📁</div>
                                <h2 className="text-2xl font-bold text-gray-700 mb-2">Select a File</h2>
                                <p className="text-gray-500">Choose a file from the sidebar to view its contents</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
