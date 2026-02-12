import React, { useState, useEffect, useCallback } from 'react';
import { LinkedInPost } from '../../../../shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface LinkedInPanelProps {
  autoRefresh?: boolean;
}

const LinkedInPanel: React.FC<LinkedInPanelProps> = ({ autoRefresh = true }) => {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generation form state
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('professional');
  const [showForm, setShowForm] = useState(false);

  // View state
  const [selectedPost, setSelectedPost] = useState<LinkedInPost | null>(null);
  const [markingAsPosted, setMarkingAsPosted] = useState(false);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[LinkedInPanel] Fetching posts...');

      const response = await fetch(`${API_BASE_URL}/api/linkedin/posts`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[LinkedInPanel] Received:', result);

      if (result.success && result.data?.posts) {
        setPosts(result.data.posts);
        setError(null);
      }
    } catch (err) {
      console.error('[LinkedInPanel] Error:', err);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    try {
      setGenerating(true);
      setError(null);
      console.log('[LinkedInPanel] Generating post...');

      const response = await fetch(`${API_BASE_URL}/api/linkedin/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, tone })
      });

      if (!response.ok) {
        throw new Error('Failed to generate post');
      }

      const result = await response.json();
      console.log('[LinkedInPanel] Generated:', result);

      if (result.success && result.data?.post) {
        setPosts(prev => [result.data.post, ...prev]);
        setTopic('');
        setShowForm(false);
      }
    } catch (err) {
      console.error('[LinkedInPanel] Error generating:', err);
      setError('Failed to generate post');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkAsPosted = async (postId: string) => {
    try {
      setMarkingAsPosted(true);
      setError(null);
      console.log('[LinkedInPanel] Marking as posted:', postId);

      const response = await fetch(`${API_BASE_URL}/api/linkedin/posts/${postId}/posted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to update');
      }

      const result = await response.json();
      console.log('[LinkedInPanel] Updated:', result);

      // Update local state
      setPosts(prev =>
        prev.map(p => p.id === postId ? { ...p, status: 'posted' as const, postedDate: new Date() } : p)
      );

      // Close modal on success
      setSelectedPost(null);
    } catch (err) {
      console.error('[LinkedInPanel] Error updating:', err);
      setError('Failed to mark as posted');
      // Still close modal on error to avoid stuck UI
      setSelectedPost(null);
    } finally {
      setMarkingAsPosted(false);
    }
  };

  const draftPosts = posts.filter(p => p.status === 'draft');
  const postedPosts = posts.filter(p => p.status === 'posted');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'posted': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="kawaii-card p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-pink-600">LinkedIn Posts</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
        >
          {showForm ? 'Cancel' : '+ Generate'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Generate Form */}
      {showForm && (
        <form onSubmit={handleGenerate} className="mb-4 p-4 bg-blue-50 rounded-xl">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What topic should I write about?"
            className="kawaii-input w-full mb-2 text-sm border-blue-200"
            required
          />
          <div className="flex gap-2">
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="kawaii-input text-sm flex-1 border-blue-200"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="inspirational">Inspirational</option>
              <option value="educational">Educational</option>
            </select>
            <button
              type="submit"
              disabled={generating || !topic.trim()}
              className="kawaii-button bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm px-4 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </form>
      )}

      {/* Posts List */}
      {loading && posts.length === 0 ? (
        <div className="text-center py-6">
          <div className="flex justify-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-blue-300 animate-bounce"></div>
            <div className="w-2 h-2 rounded-full bg-blue-300 animate-bounce delay-75"></div>
            <div className="w-2 h-2 rounded-full bg-blue-300 animate-bounce delay-150"></div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {/* Draft Posts */}
          {draftPosts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-yellow-600 mb-2">Drafts</h4>
              {draftPosts.map(post => (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="p-3 bg-white rounded-xl border border-blue-100 mb-2 cursor-pointer hover:bg-blue-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <h5 className="font-medium text-gray-800 text-sm">{post.title}</h5>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(post.status)}`}>
                      {post.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{post.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Created: {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Posted Posts */}
          {postedPosts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-green-600 mb-2">Posted</h4>
              {postedPosts.slice(0, 3).map(post => (
                <div
                  key={post.id}
                  className="p-3 bg-white rounded-xl border border-green-100 mb-2 opacity-75"
                >
                  <div className="flex justify-between items-start">
                    <h5 className="font-medium text-gray-700 text-sm">{post.title}</h5>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(post.status)}`}>
                      {post.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Posted: {post.postedDate ? new Date(post.postedDate).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {posts.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <div className="text-3xl mb-2">💼</div>
              <p>No LinkedIn posts yet</p>
              <p className="text-xs mt-1">Generate a post to get started!</p>
            </div>
          )}
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-blue-600">{selectedPost.title}</h3>
              <button
                onClick={() => setSelectedPost(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <span className={`inline-block text-xs px-2 py-1 rounded-full mb-4 ${getStatusColor(selectedPost.status)}`}>
              {selectedPost.status}
            </span>

            <div className="p-4 bg-gray-50 rounded-xl mb-4">
              <p className="text-gray-700 whitespace-pre-wrap">{selectedPost.content}</p>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Created: {new Date(selectedPost.createdAt).toLocaleString()}
            </p>

            {selectedPost.status === 'draft' && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedPost.content);
                  }}
                  className="flex-1 kawaii-button bg-gray-100 text-gray-700 text-sm py-2 hover:bg-gray-200"
                  disabled={markingAsPosted}
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={() => handleMarkAsPosted(selectedPost.id)}
                  disabled={markingAsPosted}
                  className="flex-1 kawaii-button bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm py-2 disabled:opacity-50"
                >
                  {markingAsPosted ? 'Updating...' : 'I Posted This'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400 text-center">
        {postedPosts.length} posted · {draftPosts.length} drafts
      </div>
    </div>
  );
};

export default LinkedInPanel;
