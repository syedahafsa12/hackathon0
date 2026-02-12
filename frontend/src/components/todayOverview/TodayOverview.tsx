import React, { useState, useEffect, useCallback } from 'react';
import { Task, CalendarEvent } from '../../../../shared/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface PriorityItem {
  id: string;
  type: 'task' | 'event' | 'deadline' | 'email';
  title: string;
  description?: string;
  time?: Date;
  priority: 'do-now' | 'do-next' | 'can-wait';
  originalPriority?: string;
  status?: string;
}

interface TodayOverviewProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const TodayOverview: React.FC<TodayOverviewProps> = ({
  autoRefresh = true,
  refreshInterval = 30000
}) => {
  const [items, setItems] = useState<PriorityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculatePriority = useCallback((
    item: any,
    type: 'task' | 'event' | 'deadline' | 'email',
    now: Date
  ): 'do-now' | 'do-next' | 'can-wait' => {
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Events happening now or within 1 hour = do-now
    if (type === 'event') {
      const eventStart = new Date(item.startTime || item.startTime);
      const hoursUntil = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntil <= 1 && hoursUntil >= -2) return 'do-now';
      if (hoursUntil <= 4) return 'do-next';
      return 'can-wait';
    }

    // Tasks with high/critical priority and due today = do-now
    if (type === 'task' || type === 'deadline') {
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      const isHighPriority = ['high', 'critical'].includes(item.priority);

      if (isHighPriority && dueDate && dueDate <= todayEnd) return 'do-now';
      if (dueDate && dueDate <= todayEnd) return 'do-next';
      if (isHighPriority) return 'do-next';
      return 'can-wait';
    }

    // Emails marked as important = do-next
    if (type === 'email') {
      if (['critical', 'high'].includes(item.importance)) return 'do-now';
      if (item.importance === 'medium') return 'do-next';
      return 'can-wait';
    }

    return 'can-wait';
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('[TodayOverview] Fetching data...');

      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);

      // Fetch tasks, calendar events, and emails in parallel
      const [tasksRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/tasks`).catch(() => null),
        fetch(`${API_BASE_URL}/api/calendar/events`).catch(() => null),
      ]);

      const priorityItems: PriorityItem[] = [];

      // Process tasks
      if (tasksRes?.ok) {
        const tasksData = await tasksRes.json();
        if (tasksData.success && tasksData.data?.tasks) {
          tasksData.data.tasks
            .filter((t: Task) => t.status !== 'completed' && t.status !== 'cancelled')
            .forEach((task: Task) => {
              const dueDate = task.dueDate ? new Date(task.dueDate) : undefined;
              // Include if due today, overdue, or high priority
              const isRelevant = !dueDate ||
                dueDate <= todayEnd ||
                ['high', 'critical'].includes(task.priority);

              if (isRelevant) {
                priorityItems.push({
                  id: task.id,
                  type: 'task',
                  title: task.title,
                  description: task.description,
                  time: dueDate,
                  priority: calculatePriority(task, 'task', now),
                  originalPriority: task.priority,
                  status: task.status
                });
              }
            });
        }
      }

      // Process calendar events
      if (eventsRes?.ok) {
        const eventsData = await eventsRes.json();
        if (eventsData.success && eventsData.data?.events) {
          eventsData.data.events
            .filter((e: CalendarEvent) => {
              const start = new Date(e.startTime);
              return start >= todayStart && start <= todayEnd;
            })
            .forEach((event: CalendarEvent) => {
              priorityItems.push({
                id: event.id,
                type: 'event',
                title: event.title,
                description: event.location,
                time: new Date(event.startTime),
                priority: calculatePriority(event, 'event', now)
              });
            });
        }
      }

      // Sort by priority and time
      const priorityOrder = { 'do-now': 0, 'do-next': 1, 'can-wait': 2 };
      priorityItems.sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        if (a.time && b.time) return a.time.getTime() - b.time.getTime();
        return 0;
      });

      console.log('[TodayOverview] Processed items:', priorityItems.length);
      setItems(priorityItems);
      setError(null);
    } catch (err) {
      console.error('[TodayOverview] Error:', err);
      setError('Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [calculatePriority]);

  useEffect(() => {
    fetchAllData();

    if (autoRefresh) {
      const interval = setInterval(fetchAllData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchAllData, autoRefresh, refreshInterval]);

  const doNowItems = items.filter(i => i.priority === 'do-now');
  const doNextItems = items.filter(i => i.priority === 'do-next');
  const canWaitItems = items.filter(i => i.priority === 'can-wait');

  const formatTime = (date?: Date) => {
    if (!date) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'event': return '📅';
      case 'task': return '✓';
      case 'deadline': return '⏰';
      case 'email': return '✉️';
      default: return '•';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'event': return 'text-purple-600';
      case 'task': return 'text-pink-600';
      case 'deadline': return 'text-red-600';
      case 'email': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const PrioritySection = ({
    title,
    items,
    bgColor,
    borderColor,
    emptyText
  }: {
    title: string;
    items: PriorityItem[];
    bgColor: string;
    borderColor: string;
    emptyText: string;
  }) => (
    <div className={`rounded-xl p-3 ${bgColor} border-l-4 ${borderColor}`}>
      <h4 className="font-semibold text-sm text-gray-700 mb-2">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 5).map(item => (
            <li key={item.id} className="flex items-start gap-2">
              <span className={`text-sm ${getTypeColor(item.type)}`}>
                {getTypeIcon(item.type)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                {item.time && (
                  <p className="text-xs text-gray-500">{formatTime(item.time)}</p>
                )}
              </div>
            </li>
          ))}
          {items.length > 5 && (
            <li className="text-xs text-gray-400">+{items.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );

  return (
    <div className="kawaii-card p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-pink-600">Today's Priorities</h3>
        <button
          onClick={fetchAllData}
          className="text-sm text-pink-600 hover:text-pink-800 transition-colors"
          disabled={loading}
        >
          {loading ? '...' : '↻'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="text-center py-6">
          <div className="flex justify-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce"></div>
            <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-75"></div>
            <div className="w-2 h-2 rounded-full bg-pink-300 animate-bounce delay-150"></div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <PrioritySection
            title="Do Now"
            items={doNowItems}
            bgColor="bg-red-50"
            borderColor="border-red-400"
            emptyText="Nothing urgent"
          />

          <PrioritySection
            title="Do Next"
            items={doNextItems}
            bgColor="bg-yellow-50"
            borderColor="border-yellow-400"
            emptyText="Queue is clear"
          />

          <PrioritySection
            title="Can Wait"
            items={canWaitItems}
            bgColor="bg-green-50"
            borderColor="border-green-400"
            emptyText="All caught up!"
          />
        </div>
      )}

      <div className="mt-4 text-xs text-gray-400 text-center">
        Last updated: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
};

export default TodayOverview;
