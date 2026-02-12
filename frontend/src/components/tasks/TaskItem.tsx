import React from 'react';
import { Task } from '../../../../shared/types';

interface TaskItemProps {
  task: Task;
  onUpdate: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onUpdate, onDelete }) => {
  const handleStatusChange = (newStatus: 'pending' | 'in-progress' | 'completed' | 'cancelled') => {
    onUpdate({ ...task, status: newStatus });
  };

  return (
    <div className="kawaii-card p-4 flex items-start gap-3">
      <div className={`flex-shrink-0 w-4 h-4 rounded-full mt-1 ${
        task.status === 'completed' ? 'bg-green-500' :
        task.status === 'in-progress' ? 'bg-yellow-500' :
        task.status === 'cancelled' ? 'bg-red-500' : 'bg-pink-500'
      }`}></div>

      <div className="flex-1">
        <div className="flex justify-between items-start">
          <h4 className="font-medium">{task.title}</h4>
          <span className={`text-xs px-2 py-1 rounded-full ${
            task.priority === 'critical' ? 'bg-red-100 text-red-800' :
            task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {task.priority}
          </span>
        </div>

        {task.description && (
          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
        )}

        {task.dueDate && (
          <p className="text-xs text-gray-500 mt-2">
            Due: {new Date(task.dueDate).toLocaleDateString()}
          </p>
        )}

        <div className="flex gap-2 mt-3">
          {task.status !== 'completed' && (
            <button
              onClick={() => handleStatusChange('completed')}
              className="text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
            >
              Complete
            </button>
          )}

          {task.status !== 'in-progress' && task.status !== 'completed' && (
            <button
              onClick={() => handleStatusChange('in-progress')}
              className="text-xs bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
            >
              Start
            </button>
          )}

          <button
            onClick={() => onDelete(task.id)}
            className="text-xs bg-gradient-to-r from-red-500 to-rose-600 text-white px-3 py-1 rounded-full hover:opacity-90 transition-opacity"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskItem;