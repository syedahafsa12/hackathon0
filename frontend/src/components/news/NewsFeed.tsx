import React from 'react';
import { NewsDigest } from '../../../../shared/types';

interface NewsFeedProps {
  articles: NewsDigest[];
  onRefresh?: () => void;
}

const NewsFeed: React.FC<NewsFeedProps> = ({ articles, onRefresh }) => {
  // Group articles by category
  const articlesByCategory: Record<string, NewsDigest[]> = {
    'AI': [],
    'tech': [],
    'world-impact': []
  };

  articles.forEach(article => {
    if (articlesByCategory[article.category]) {
      articlesByCategory[article.category].push(article);
    }
  });

  return (
    <div className="kawaii-card p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-pink-600">News Feed</h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="kawaii-button bg-gradient-to-r from-pink-500 to-purple-600 text-white text-sm px-4 py-2"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="space-y-6">
        {Object.entries(articlesByCategory).map(([category, categoryArticles]) => (
          categoryArticles.length > 0 && (
            <div key={category}>
              <h4 className="font-semibold text-lg mb-3 flex items-center">
                <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                  category === 'AI' ? 'bg-blue-500' :
                  category === 'tech' ? 'bg-green-500' :
                  'bg-yellow-500'
                }`}></span>
                {category === 'world-impact' ? 'World Impact' : category.charAt(0).toUpperCase() + category.slice(1)}
              </h4>

              <div className="space-y-4">
                {categoryArticles.map(article => (
                  <div key={article.id} className="p-4 bg-white rounded-xl border border-pink-100">
                    <div className="flex justify-between items-start">
                      <h5 className="font-medium text-pink-600">{article.source}</h5>
                      <span className="text-xs text-gray-500">
                        {new Date(article.publishedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mt-2">{article.content}</p>

                    <div className="mt-3 flex justify-between items-center">
                      <span className="text-xs px-2 py-1 bg-pink-100 text-pink-800 rounded-full">
                        {article.category}
                      </span>
                      <button className="text-xs text-pink-600 hover:underline">
                        Read more
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>

      {articles.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No news articles found. Try refreshing or checking back later.</p>
        </div>
      )}
    </div>
  );
};

export default NewsFeed;