import React, { useState, useEffect, useCallback } from 'react';
import { KnowledgeEntry } from '../../../../shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface KnowledgeVaultProps {
  entries?: KnowledgeEntry[];
  onSearch?: (query: string) => void;
  onSelectEntry?: (entry: KnowledgeEntry) => void;
  autoRefresh?: boolean;
}

const KnowledgeVault: React.FC<KnowledgeVaultProps> = ({
  entries: propEntries,
  onSearch,
  onSelectEntry,
  autoRefresh = true
}) => {
  const [entries, setEntries] = useState<KnowledgeEntry[]>(propEntries || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add entry form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [saving, setSaving] = useState(false);

  // Selected entry modal
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);

  const fetchEntries = useCallback(async (query?: string) => {
    try {
      setLoading(true);
      console.log('[KnowledgeVault] Fetching entries...');

      const url = query
        ? `${API_BASE_URL}/api/knowledge/search?query=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/api/knowledge`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[KnowledgeVault] Received:', result);

      if (result.success && result.data?.entries) {
        setEntries(result.data.entries);
        setError(null);
      } else if (result.success && result.data?.entry) {
        // Single entry from search
        setEntries([result.data.entry]);
      }
    } catch (err) {
      console.error('[KnowledgeVault] Error:', err);
      setError('Failed to load entries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!propEntries) {
      fetchEntries();
    }
  }, [fetchEntries, propEntries]);

  useEffect(() => {
    if (propEntries) {
      setEntries(propEntries);
    }
  }, [propEntries]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(searchQuery);
    }
    await fetchEntries(searchQuery);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      setSaving(true);
      console.log('[KnowledgeVault] Adding entry...');

      // Auto-generate title if not provided
      const title = newTitle.trim() || `Note - ${new Date().toLocaleDateString()}`;

      const response = await fetch(`${API_BASE_URL}/api/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: newContent,
          category: newCategory,
          tags: []
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      const result = await response.json();
      console.log('[KnowledgeVault] Saved:', result);

      if (result.success && result.data?.entry) {
        setEntries(prev => [result.data.entry, ...prev]);
        setNewContent('');
        setNewTitle('');
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('[KnowledgeVault] Error saving:', err);
      setError('Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectEntry = (entry: KnowledgeEntry) => {
    setSelectedEntry(entry);
    if (onSelectEntry) {
      onSelectEntry(entry);
    }
  };

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(entries.map(entry => entry.category).filter(Boolean)))];

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = searchQuery === '' ||
      entry.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.content?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || entry.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="kawaii-card p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-pink-600">Knowledge Vault</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
        >
          {showAddForm ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Add Entry Form */}
      {showAddForm && (
        <form onSubmit={handleAddEntry} className="mb-4 p-4 bg-pink-50 rounded-xl">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Title (optional, auto-generated if empty)"
            className="kawaii-input w-full mb-2 text-sm"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Paste text, brainstorm, jot down ideas..."
            className="kawaii-input w-full mb-2 text-sm h-24 resize-none"
            required
          />
          <div className="flex gap-2">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="kawaii-input text-sm flex-1"
            >
              <option value="general">General</option>
              <option value="ideas">Ideas</option>
              <option value="notes">Notes</option>
              <option value="research">Research</option>
              <option value="personal">Personal</option>
            </select>
            <button
              type="submit"
              disabled={saving || !newContent.trim()}
              className="kawaii-button bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm px-4 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your knowledge..."
            className="flex-1 kawaii-input"
          />
          <button
            type="submit"
            className="kawaii-button bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4"
            disabled={loading}
          >
            {loading ? '...' : 'Search'}
          </button>
        </div>
      </form>

      {/* Categories */}
      {categories.length > 1 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'bg-pink-100 text-pink-800 hover:bg-pink-200'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Entries List */}
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {loading && entries.length === 0 ? (
          <div className="text-center py-6">
            <div className="flex justify-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-75"></div>
              <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-150"></div>
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-3xl mb-2">📝</div>
            <p>No knowledge entries found.</p>
            <p className="text-xs mt-1">Add notes, ideas, or anything you want to remember!</p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <div
              key={entry.id}
              onClick={() => handleSelectEntry(entry)}
              className="p-4 bg-white rounded-xl border border-pink-100 cursor-pointer hover:bg-pink-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <h4 className="font-semibold text-pink-600">{entry.title}</h4>
                {entry.category && (
                  <span className="text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded-full">
                    {entry.category}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {entry.content?.substring(0, 100)}...
              </p>
              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {entry.tags.map(tag => (
                    <span key={tag} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Saved: {new Date(entry.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-pink-600">{selectedEntry.title}</h3>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            {selectedEntry.category && (
              <span className="inline-block text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded-full mb-4">
                {selectedEntry.category}
              </span>
            )}
            <p className="text-gray-700 whitespace-pre-wrap">{selectedEntry.content}</p>
            {selectedEntry.tags && selectedEntry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-4">
                {selectedEntry.tags.map(tag => (
                  <span key={tag} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-4">
              Created: {new Date(selectedEntry.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeVault;