import React, { useState } from 'react';

interface LinkedInPostGeneratorProps {
  onGenerate: (topic: string, tone: string) => void;
}

const LinkedInPostGenerator: React.FC<LinkedInPostGeneratorProps> = ({ onGenerate }) => {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('professional');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      onGenerate(topic, tone);
    }
  };

  return (
    <div className="kawaii-card p-6">
      <h3 className="text-xl font-bold text-pink-600 mb-4">LinkedIn Post Generator</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What would you like to write about?"
            className="kawaii-input w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="kawaii-input w-full"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="inspirational">Inspirational</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full kawaii-button bg-gradient-to-r from-pink-500 to-purple-600 text-white"
        >
          Generate Post
        </button>
      </form>
    </div>
  );
};

export default LinkedInPostGenerator;