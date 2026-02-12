import React from 'react';
import TaskItem from './TaskItem';
import { Task } from '../../../../shared/types';

interface TaskListProps {
  tasks: Task[];
  onTaskUpdate: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, onTaskUpdate, onTaskDelete }) => {
  const pendingTasks = tasks.filter(task => task.status === 'pending');
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');

  return (
    <div className="space-y-6">
      {inProgressTasks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-purple-600 mb-2">In Progress</h3>
          <div className="space-y-2">
            {inProgressTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={onTaskUpdate}
                onDelete={onTaskDelete}
              />
            ))}
          </div>
        </div>
      )}

      {pendingTasks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-pink-600 mb-2">Pending</h3>
          <div className="space-y-2">
            {pendingTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={onTaskUpdate}
                onDelete={onTaskDelete}
              />
            ))}
          </div>
        </div>
      )}

      {completedTasks.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-green-600 mb-2">Completed</h3>
          <div className="space-y-2">
            {completedTasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                onUpdate={onTaskUpdate}
                onDelete={onTaskDelete}
              />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>You have no tasks yet. Add one using the chat!</p>
        </div>
      )}
    </div>
  );
};

export default TaskList;