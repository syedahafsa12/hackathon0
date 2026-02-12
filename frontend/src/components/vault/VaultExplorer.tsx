import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface VaultFile {
    name: string;
    path: string;
    size: number;
    modified: string;
}

interface VaultFolder {
    name: string;
    path: string;
    fileCount: number;
    files: VaultFile[];
}

interface VaultStructure {
    folders: VaultFolder[];
    totalFiles: number;
}

interface VaultExplorerProps {
    onFileSelect: (filePath: string) => void;
    selectedFile: string | null;
}

const VaultExplorer: React.FC<VaultExplorerProps> = ({ onFileSelect, selectedFile }) => {
    const [structure, setStructure] = useState<VaultStructure | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['Root']));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchStructure();
        const interval = setInterval(fetchStructure, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchStructure = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/vault/structure`);
            if (!response.ok) throw new Error('Failed to fetch vault structure');

            const result = await response.json();
            if (result.success) {
                setStructure(result.data);
                setError(null);
            }
        } catch (err) {
            console.error('Error fetching vault structure:', err);
            setError('Failed to load vault structure');
        } finally {
            setLoading(false);
        }
    };

    const toggleFolder = (folderName: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderName)) {
                newSet.delete(folderName);
            } else {
                newSet.add(folderName);
            }
            return newSet;
        });
    };

    const getFolderIcon = (folderName: string) => {
        const icons: Record<string, string> = {
            'Root': '🏠',
            'Needs_Action': '📥',
            'In_Progress': '⏳',
            'Pending_Approval': '⏸️',
            'Approved': '✅',
            'Rejected': '❌',
            'Done': '✓',
            'Plans': '📋',
            'Knowledge_Vault': '📚',
            'Briefings': '📊',
            'Logs': '📝',
            'Backups': '💾'
        };
        return icons[folderName] || '📁';
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-6">
                <div className="flex justify-center items-center h-64">
                    <div className="flex space-x-2">
                        <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce"></div>
                        <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-75"></div>
                        <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-150"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-6">
                <div className="text-center text-red-600">
                    <div className="text-3xl mb-2">⚠️</div>
                    <p>{error}</p>
                    <button
                        onClick={fetchStructure}
                        className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-full text-sm hover:bg-pink-600"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg overflow-hidden border border-pink-100">
            <div className="p-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                <h2 className="text-lg font-bold">Vault Explorer</h2>
                <p className="text-xs opacity-80">{structure?.totalFiles || 0} files</p>
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-16rem)]">
                {structure?.folders.map(folder => (
                    <div key={folder.name} className="border-b border-pink-100 last:border-b-0">
                        {/* Folder Header */}
                        <button
                            onClick={() => toggleFolder(folder.name)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-pink-50 transition-colors text-left"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{getFolderIcon(folder.name)}</span>
                                <span className="font-medium text-gray-700 text-sm">{folder.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-pink-100 text-pink-600 px-2 py-1 rounded-full">
                                    {folder.fileCount}
                                </span>
                                <span className="text-gray-400 text-sm">
                                    {expandedFolders.has(folder.name) ? '▼' : '▶'}
                                </span>
                            </div>
                        </button>

                        {/* Files List */}
                        {expandedFolders.has(folder.name) && folder.files.length > 0 && (
                            <div className="bg-gray-50">
                                {folder.files.map(file => (
                                    <button
                                        key={file.path}
                                        onClick={() => onFileSelect(file.path)}
                                        className={`w-full px-6 py-2 flex items-center justify-between hover:bg-pink-100 transition-colors text-left ${selectedFile === file.path ? 'bg-pink-100 border-l-4 border-pink-500' : ''
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">📄</span>
                                                <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
                                                <span className="text-xs text-gray-400">•</span>
                                                <span className="text-xs text-gray-400">{formatDate(file.modified)}</span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-3 border-t border-pink-100 bg-gray-50">
                <button
                    onClick={fetchStructure}
                    className="w-full text-xs text-pink-600 hover:text-pink-800 transition-colors"
                >
                    ↻ Refresh
                </button>
            </div>
        </div>
    );
};

export default VaultExplorer;
