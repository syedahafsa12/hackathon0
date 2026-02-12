import React, { useState } from 'react';

interface PrioritySettingsProps {
  onSave: (settings: any) => void;
}

const PrioritySettings: React.FC<PrioritySettingsProps> = ({ onSave }) => {
  const [settings, setSettings] = useState({
    dailySummaryTime: '08:00',
    taskPrioritization: true,
    emailPrioritization: true,
    calendarIntegration: true,
    notificationFrequency: 'hourly',
    criticalThreshold: 24, // hours
    highPriorityThreshold: 48 // hours
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(settings);
  };

  return (
    <div className="kawaii-card p-6">
      <h3 className="text-xl font-bold text-pink-600 mb-4">Priority Settings</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daily Summary Time
          </label>
          <input
            type="time"
            name="dailySummaryTime"
            value={settings.dailySummaryTime}
            onChange={handleChange}
            className="kawaii-input w-full"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Enable Task Prioritization
          </span>
          <input
            type="checkbox"
            name="taskPrioritization"
            checked={settings.taskPrioritization}
            onChange={handleChange}
            className="h-4 w-4 text-pink-600 rounded focus:ring-pink-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Enable Email Prioritization
          </span>
          <input
            type="checkbox"
            name="emailPrioritization"
            checked={settings.emailPrioritization}
            onChange={handleChange}
            className="h-4 w-4 text-pink-600 rounded focus:ring-pink-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Calendar Integration
          </span>
          <input
            type="checkbox"
            name="calendarIntegration"
            checked={settings.calendarIntegration}
            onChange={handleChange}
            className="h-4 w-4 text-pink-600 rounded focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notification Frequency
          </label>
          <select
            name="notificationFrequency"
            value={settings.notificationFrequency}
            onChange={handleChange}
            className="kawaii-input w-full"
          >
            <option value="realtime">Real-time</option>
            <option value="hourly">Hourly</option>
            <option value="every3hours">Every 3 Hours</option>
            <option value="every6hours">Every 6 Hours</option>
            <option value="daily">Daily</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Critical Task Threshold (hours)
          </label>
          <input
            type="number"
            name="criticalThreshold"
            value={settings.criticalThreshold}
            onChange={handleChange}
            min="1"
            max="168"
            className="kawaii-input w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            High Priority Threshold (hours)
          </label>
          <input
            type="number"
            name="highPriorityThreshold"
            value={settings.highPriorityThreshold}
            onChange={handleChange}
            min="1"
            max="168"
            className="kawaii-input w-full"
          />
        </div>

        <button
          type="submit"
          className="w-full kawaii-button bg-gradient-to-r from-pink-500 to-purple-600 text-white"
        >
          Save Settings
        </button>
      </form>
    </div>
  );
};

export default PrioritySettings;