import React, { useState, useEffect, useCallback } from 'react';
import { fetchNews, getTodayNews, isCacheValid, formatTimestamp } from '@/services/agentService';
import { NewsDigest, NewsArticle } from '@/types/agentTypes';

interface NewsDigestProps {
  autoRefresh?: boolean;
}

const NewsDigestComponent: React.FC<NewsDigestProps> = ({ autoRefresh = false }) => {
  const [digest, setDigest] = useState<NewsDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const loadNews = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      let data: NewsDigest | null = null;

      if (!forceRefresh) {
        // Try to get today's news from cache/db first
        data = await getTodayNews();

        // Check if data is fresh (less than 24 hours old)
        if (data && !isCacheValid(data.fetchedAt, 24)) {
          data = null; // Mark as invalid so we fetch fresh
        }
      }

      if (!data) {
        // Fetch fresh news if forced or no valid cached data
        data = await fetchNews(forceRefresh);
      }

      setDigest(data);
    } catch (err: any) {
      console.error('[NewsDigest] Error:', err);
      setError('Failed to fetch news. Try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const toggleItem = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const getCategoryTheme = (category: string) => {
    switch (category) {
      case 'Tech': return { icon: '💻', bg: 'bg-blue-50/50', border: 'border-blue-300', text: 'text-blue-700', dot: 'bg-blue-500' };
      case 'AI': return { icon: '🤖', bg: 'bg-purple-50/50', border: 'border-purple-300', text: 'text-purple-700', dot: 'bg-purple-500' };
      case 'World-Impacting': return { icon: '🌍', bg: 'bg-green-50/50', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-500' };
      default: return { icon: '📰', bg: 'bg-gray-50/50', border: 'border-gray-300', text: 'text-gray-700', dot: 'bg-gray-500' };
    }
  };

  const NewsCategory = ({ title, articles }: { title: string, articles: NewsArticle[] }) => {
    const theme = getCategoryTheme(title);

    return (
      <div className={`rounded-2xl p-4 ${theme.bg} border border-${theme.border.split('-')[1]}-100 shadow-sm`}>
        <h4 className={`font-bold ${theme.text} mb-3 flex items-center gap-2`}>
          <span className="text-xl">{theme.icon}</span> {title}
          <span className="text-xs font-normal text-gray-400 ml-auto">({articles.length} updates)</span>
        </h4>

        <ul className="space-y-3">
          {articles.map((article, idx) => {
            const itemId = `${title}-${idx}`;
            const isExpanded = expandedItems.has(itemId);

            return (
              <li key={idx} className="bg-white/80 backdrop-blur-sm rounded-xl p-3 border border-pink-50 hover:border-pink-200 transition-all shadow-sm">
                <div
                  className="flex items-start gap-2 cursor-pointer"
                  onClick={() => toggleItem(itemId)}
                >
                  <span className={`w-2 h-2 rounded-full ${theme.dot} mt-1.5 flex-shrink-0`}></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 leading-tight">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-black text-pink-500 uppercase tracking-tighter">{article.source || 'Breaking News'}</span>
                      <span className="text-[10px] text-gray-300">•</span>
                      <span className="text-[10px] text-gray-400">Tap to expand</span>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-pink-50 animate-in fade-in slide-in-from-top-1 duration-200">
                        <p className="text-xs text-gray-600 leading-relaxed mb-3">
                          {article.summary}
                        </p>
                        {article.url && (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-pink-600 hover:text-pink-800 flex items-center gap-1 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Read Full Coverage <span className="text-[10px]">↗</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-300 mt-1">{isExpanded ? '▴' : '▾'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  if (loading && !digest) {
    return (
      <div className="kawaii-card p-6 animate-pulse">
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded w-24"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 bg-gray-100 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="kawaii-card p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-purple-100 rounded-full blur-3xl opacity-40 pointer-events-none"></div>

      <div className="flex justify-between items-center mb-6 relative z-10">
        <div>
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-purple-600">
            IntelliStream News
          </h3>
          {digest && (
            <p className="text-xs text-gray-400 mt-1 font-medium">
              Daily briefing summarized for you
            </p>
          )}
        </div>
        <button
          onClick={() => loadNews(true)}
          disabled={loading}
          className="kawaii-button bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm px-5 py-2.5 font-bold shadow-lg shadow-pink-200 hover:shadow-pink-300 transition-all disabled:opacity-50"
        >
          {loading ? 'Fetching...' : 'Fetch News'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl text-sm flex items-center gap-2 relative z-10">
          <span>🚨</span> {error}
        </div>
      )}

      {digest ? (
        <div className="space-y-5 relative z-10">
          <NewsCategory title="Tech" articles={digest.categories.Tech} />
          <NewsCategory title="AI" articles={digest.categories.AI} />
          <NewsCategory title="World-Impacting" articles={digest.categories['World-Impacting']} />

          <div className="pt-2 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              Fetched at {formatTimestamp(digest.fetchedAt)}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-16 relative z-10">
          <div className="text-7xl mb-6 animate-pulse">📰</div>
          <p className="text-gray-600 font-black text-xl">No Headlines Yet</p>
          <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">
            Click the fetch button to get your curated Daily News Digest.
          </p>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-pink-100 flex justify-center text-[9px] text-gray-300 font-bold uppercase tracking-widest">
        <span>News Agent V2 • AI-Powered Summarization</span>
      </div>
    </div>
  );
};

export default NewsDigestComponent;
