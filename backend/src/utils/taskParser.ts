import openaiService from '../services/openaiService';

export class TaskParser {
  async parseNaturalLanguageTask(input: string): Promise<{ title: string; description?: string; dueDate?: Date; priority?: 'low' | 'medium' | 'high' | 'critical' }> {
    try {
      // Use the OpenAI service to process the natural language input
      const result = await openaiService.processNaturalLanguageTask(input);

      // Default priority based on urgency keywords
      let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';

      const lowerInput = input.toLowerCase();

      if (lowerInput.includes('urgent') || lowerInput.includes('asap') || lowerInput.includes('today') || lowerInput.includes('now')) {
        priority = 'high';
      } else if (lowerInput.includes('critical') || lowerInput.includes('emergency')) {
        priority = 'critical';
      } else if (lowerInput.includes('later') || lowerInput.includes('whenever')) {
        priority = 'low';
      }

      return {
        title: result.title,
        description: result.description,
        dueDate: result.dueDate,
        priority
      };
    } catch (error) {
      console.error('Error parsing natural language task:', error);

      // Return a basic interpretation in case of error
      return {
        title: input.substring(0, 50),
        description: input,
        priority: 'medium'
      };
    }
  }

  // Helper function to extract date from text (simple implementation)
  private extractDate(text: string): Date | null {
    // Look for date patterns like "tomorrow", "next week", specific dates, etc.
    const datePatterns = [
      /tomorrow/i,
      /today/i,
      /next week/i,
      /next month/i,
      /\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
      /\d{2}-\d{2}-\d{4}/, // MM-DD-YYYY
    ];

    for (const pattern of datePatterns) {
      if (pattern.test(text)) {
        // This is a simplified implementation
        // In a real app, you'd want more sophisticated date parsing
        if (pattern.test('tomorrow')) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          return tomorrow;
        } else if (pattern.test('today')) {
          return new Date();
        }
        // Add more date parsing logic as needed
      }
    }

    return null;
  }

  // Helper function to extract priority from text
  private extractPriority(text: string): 'low' | 'medium' | 'high' | 'critical' {
    const highPriorityKeywords = ['urgent', 'asap', 'today', 'now', 'immediately'];
    const criticalPriorityKeywords = ['critical', 'emergency', 'crisis', 'vital'];
    const lowPriorityKeywords = ['later', 'whenever', 'someday', 'eventually'];

    const lowerText = text.toLowerCase();

    for (const keyword of criticalPriorityKeywords) {
      if (lowerText.includes(keyword)) {
        return 'critical';
      }
    }

    for (const keyword of highPriorityKeywords) {
      if (lowerText.includes(keyword)) {
        return 'high';
      }
    }

    for (const keyword of lowPriorityKeywords) {
      if (lowerText.includes(keyword)) {
        return 'low';
      }
    }

    return 'medium';
  }
}

export default new TaskParser();