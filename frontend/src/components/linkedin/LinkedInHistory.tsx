import React from 'react';
import { LinkedInPost } from '../../../../shared/types';

interface LinkedInHistoryProps {
  posts: LinkedInPost[];
}

const LinkedInHistory: React.FC<LinkedInHistoryProps> = ({ posts }) => {
  return (
    <div className="kawaii-card p-6">
      <h3 className="text-xl font-bold text-pink-600 mb-4">LinkedIn Post History</h3>

      {posts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No LinkedIn posts found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <div key={post.id} className="p-4 bg-white rounded-xl border border-pink-100">
              <div className="flex justify-between items-start">
                <h4 className="font-semibold text-pink-600">{post.title}</h4>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  post.status === 'draft' ? 'bg-blue-100 text-blue-800' :
                  post.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                  post.status === 'posted' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {post.status}
                </span>
              </div>

              <p className="text-sm text-gray-600 mt-2 line-clamp-3">
                {post.content.substring(0, 150)}...
              </p>

              <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                <span>Created: {new Date(post.createdAt).toLocaleDateString()}</span>
                {post.postedDate && (
                  <span>Posted: {new Date(post.postedDate).toLocaleDateString()}</span>
                )}
                {post.scheduledDate && !post.postedDate && (
                  <span>Scheduled: {new Date(post.scheduledDate).toLocaleDateString()}</span>
                )}
              </div>

              {post.engagementMetrics && Object.keys(post.engagementMetrics).length > 0 && (
                <div className="flex gap-3 mt-2 text-xs">
                  {post.engagementMetrics.likes && (
                    <span>👍 {post.engagementMetrics.likes}</span>
                  )}
                  {post.engagementMetrics.comments && (
                    <span>💬 {post.engagementMetrics.comments}</span>
                  )}
                  {post.engagementMetrics.shares && (
                    <span>🔄 {post.engagementMetrics.shares}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LinkedInHistory;