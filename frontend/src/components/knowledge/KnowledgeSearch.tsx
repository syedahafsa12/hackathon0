import React, { useState } from 'react';
import { KnowledgeEntry } from '../../../../shared/types';

interface KnowledgeSearchProps {
  onSearch: (query: string) => void;
  onSelectEntry: (entry: KnowledgeEntry) => void;
}

const KnowledgeSearch: React.FC<KnowledgeSearchProps> = ({ onSearch, onSelectEntry }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <div className="kawaii-card p-4">
      <h3 className="font-bold text-pink-600 mb-3">Search Knowledge</h3>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your knowledge vault..."
          className="flex-1 kawaii-input"
        />
        <button
          type="submit"
          className="kawaii-button bg-gradient-to-r from-pink-500 to-purple-600 text-white"
        >
          Search
        </button>
      </form>
    </div>
  );
};

export default KnowledgeSearch;