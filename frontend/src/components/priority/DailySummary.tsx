import React from 'react';

interface DailySummaryProps {
  summary: {
    date: Date;
    items: Array<{
      id: string;
      type: string;
      priority: number;
      title: string;
      description: string;
      dueDate?: Date;
      item: any;
    }>;
    summary: {
      totalItems: number;
      tasks: number;
      events: number;
      emails: number;
    };
  };
}

const DailySummary: React.FC<DailySummaryProps> = ({ summary }) => {
  // Group items by priority level
  const criticalItems = summary.items.filter(item => item.priority <= 3);
  const highPriorityItems = summary.items.filter(item => item.priority > 3 && item.priority <= 5);
  const regularItems = summary.items.filter(item => item.priority > 5);

  return (
    <div className="kawaii-card p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-pink-600">
          Daily Summary for {new Date(summary.date).toLocaleDateString()}
        </h3>
        <span className="text-sm bg-pink-100 text-pink-800 px-3 py-1 rounded-full">
          {summary.summary.totalItems} items
        </span>
      </div>

      {summary.summary.totalItems === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p>🎉 All caught up! No urgent items today.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {criticalItems.length > 0 && (
            <div>
              <h4 className="font-bold text-red-600 mb-2 flex items-center">
                <span className="mr-2">🚨</span> Critical Priority ({criticalItems.length})
              </h4>
              <div className="space-y-2">
                {criticalItems.map(item => (
                  <div key={item.id} className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-600">{item.description}</div>
                    {item.dueDate && (
                      <div className="text-xs text-red-600 mt-1">
                        Due: {new Date(item.dueDate).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {highPriorityItems.length > 0 && (
            <div>
              <h4 className="font-bold text-orange-600 mb-2 flex items-center">
                <span className="mr-2">🔥</span> High Priority ({highPriorityItems.length})
              </h4>
              <div className="space-y-2">
                {highPriorityItems.map(item => (
                  <div key={item.id} className="bg-orange-50 border-l-4 border-orange-500 p-3 rounded">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-600">{item.description}</div>
                    {item.dueDate && (
                      <div className="text-xs text-orange-600 mt-1">
                        Due: {new Date(item.dueDate).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {regularItems.length > 0 && (
            <div>
              <h4 className="font-bold text-blue-600 mb-2 flex items-center">
                <span className="mr-2">📋</span> Regular Tasks ({regularItems.length})
              </h4>
              <div className="space-y-2">
                {regularItems.map(item => (
                  <div key={item.id} className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-600">{item.description}</div>
                    {item.dueDate && (
                      <div className="text-xs text-blue-600 mt-1">
                        Due: {new Date(item.dueDate).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-pink-100 flex justify-around text-center">
        <div className="bg-pink-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-pink-600">{summary.summary.tasks}</div>
          <div className="text-xs text-pink-800">Tasks</div>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{summary.summary.events}</div>
          <div className="text-xs text-purple-800">Events</div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{summary.summary.emails}</div>
          <div className="text-xs text-blue-800">Emails</div>
        </div>
      </div>
    </div>
  );
};

export default DailySummary;