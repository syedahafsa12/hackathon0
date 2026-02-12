import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface FileData {
    path: string;
    name: string;
    content: string;
    frontmatter: Record<string, any>;
    size: number;
    created: string;
    modified: string;
}

interface MarkdownViewerProps {
    filePath: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ filePath }) => {
    const [fileData, setFileData] = useState<FileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (filePath) {
            fetchFile();
        }
    }, [filePath]);

    const fetchFile = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/vault/file?path=${encodeURIComponent(filePath)}`);

            if (!response.ok) {
                throw new Error('Failed to fetch file');
            }

            const result = await response.json();
            if (result.success) {
                setFileData(result.data);
                setError(null);
            }
        } catch (err) {
            console.error('Error fetching file:', err);
            setError('Failed to load file');
        } finally {
            setLoading(false);
        }
    };

    const downloadFile = () => {
        if (!fileData) return;

        const blob = new Blob([fileData.content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileData.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
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
                <p className="text-center text-gray-500 mt-4">Loading file...</p>
            </div>
        );
    }

    if (error || !fileData) {
        return (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-12 text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-2xl font-bold text-gray-700 mb-2">Error Loading File</h2>
                <p className="text-gray-500 mb-4">{error || 'File not found'}</p>
                <button
                    onClick={fetchFile}
                    className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full hover:opacity-90"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg overflow-hidden border border-pink-100">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">{fileData.name}</h2>
                        <p className="text-sm opacity-80 mt-1">{filePath}</p>
                    </div>
                    <button
                        onClick={downloadFile}
                        className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full text-sm transition-colors"
                    >
                        ⬇ Download
                    </button>
                </div>
            </div>

            {/* Frontmatter Metadata */}
            {Object.keys(fileData.frontmatter).length > 0 && (
                <div className="p-6 bg-purple-50 border-b border-pink-100">
                    <h3 className="text-sm font-bold text-purple-900 mb-3">Metadata</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.entries(fileData.frontmatter).map(([key, value]) => (
                            <div key={key} className="bg-white rounded-lg p-3">
                                <div className="text-xs text-gray-500 uppercase tracking-wide">{key}</div>
                                <div className="text-sm text-gray-800 mt-1 font-medium">
                                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* File Info */}
            <div className="px-6 py-3 bg-gray-50 border-b border-pink-100 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-4">
                    <span>📅 Modified: {formatDate(fileData.modified)}</span>
                    <span>•</span>
                    <span>📦 Size: {(fileData.size / 1024).toFixed(1)} KB</span>
                </div>
                <button
                    onClick={fetchFile}
                    className="text-pink-600 hover:text-pink-800"
                >
                    ↻ Refresh
                </button>
            </div>

            {/* Markdown Content */}
            <div className="p-8 overflow-y-auto max-h-[calc(100vh-24rem)]">
                <div className="prose prose-pink max-w-none">
                    <ReactMarkdown
                        components={{
                            h1: ({ node, ...props }) => <h1 className="text-3xl font-bold text-gray-900 mb-4 mt-6" {...props} />,
                            h2: ({ node, ...props }) => <h2 className="text-2xl font-bold text-gray-800 mb-3 mt-5" {...props} />,
                            h3: ({ node, ...props }) => <h3 className="text-xl font-bold text-gray-700 mb-2 mt-4" {...props} />,
                            p: ({ node, ...props }) => <p className="text-gray-700 mb-3 leading-relaxed" {...props} />,
                            ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-3 space-y-1" {...props} />,
                            ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-3 space-y-1" {...props} />,
                            li: ({ node, ...props }) => <li className="text-gray-700" {...props} />,
                            code: ({ node, inline, ...props }: any) =>
                                inline ? (
                                    <code className="bg-pink-100 text-pink-800 px-2 py-1 rounded text-sm font-mono" {...props} />
                                ) : (
                                    <code className="block bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-3" {...props} />
                                ),
                            blockquote: ({ node, ...props }) => (
                                <blockquote className="border-l-4 border-pink-400 pl-4 italic text-gray-600 my-4" {...props} />
                            ),
                            a: ({ node, ...props }) => (
                                <a className="text-pink-600 hover:text-pink-800 underline" {...props} />
                            ),
                            hr: ({ node, ...props }) => <hr className="my-6 border-pink-200" {...props} />,
                            table: ({ node, ...props }) => (
                                <div className="overflow-x-auto mb-4">
                                    <table className="min-w-full border border-pink-200" {...props} />
                                </div>
                            ),
                            th: ({ node, ...props }) => (
                                <th className="bg-pink-100 border border-pink-200 px-4 py-2 text-left font-semibold" {...props} />
                            ),
                            td: ({ node, ...props }) => (
                                <td className="border border-pink-200 px-4 py-2" {...props} />
                            ),
                        }}
                    >
                        {fileData.content}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
};

export default MarkdownViewer;
