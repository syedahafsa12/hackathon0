import { PrismaClient } from '@prisma/client';
import knowledgeService from '../knowledge/knowledgeService';
import openaiService from '../openaiService';

const prisma = new PrismaClient();

export class KnowledgeAgent {
  async processKnowledgeCommand(userId: string, command: string) {
    try {
      // Parse the command to determine intent
      const intent = this.identifyIntent(command);

      switch (intent) {
        case 'save_information':
          return await this.handleSaveInformation(userId, command);
        case 'search_information':
          return await this.handleSearchInformation(userId, command);
        case 'retrieve_information':
          return await this.handleRetrieveInformation(userId, command);
        case 'update_information':
          return await this.handleUpdateInformation(userId, command);
        case 'delete_information':
          return await this.handleDeleteInformation(userId, command);
        default:
          return {
            success: false,
            message: 'Unable to understand the knowledge command. Try phrases like "remember that I prefer coffee over tea" or "what do I know about React development?"'
          };
      }
    } catch (error) {
      console.error('Error processing knowledge command:', error);
      throw error;
    }
  }

  private identifyIntent(command: string): string {
    const lowerCommand = command.toLowerCase();

    if (lowerCommand.includes('remember') || lowerCommand.includes('save') || lowerCommand.includes('store') ||
        lowerCommand.includes('note') || lowerCommand.includes('keep') || lowerCommand.includes('add to knowledge')) {
      return 'save_information';
    } else if (lowerCommand.includes('search') || lowerCommand.includes('find') || lowerCommand.includes('lookup') ||
               lowerCommand.includes('what do') || lowerCommand.includes('tell me about') || lowerCommand.includes('do i know')) {
      return 'search_information';
    } else if (lowerCommand.includes('recall') || lowerCommand.includes('remind') || lowerCommand.includes('what was') ||
               lowerCommand.includes('show me') || lowerCommand.includes('give me')) {
      return 'retrieve_information';
    } else if (lowerCommand.includes('update') || lowerCommand.includes('change') || lowerCommand.includes('modify') ||
               lowerCommand.includes('edit')) {
      return 'update_information';
    } else if (lowerCommand.includes('delete') || lowerCommand.includes('remove') || lowerCommand.includes('forget') ||
               lowerCommand.includes('erase')) {
      return 'delete_information';
    } else {
      // Default to search for commands that might be asking about known information
      return 'search_information';
    }
  }

  private async handleSaveInformation(userId: string, command: string) {
    // Extract the information to save
    // This is a simplified implementation - in reality, you'd want more sophisticated NLP
    let infoToSave = command;

    // Remove common phrases like "remember that" or "save that"
    const phrasesToRemove = [
      'remember that ',
      'save that ',
      'store that ',
      'note that ',
      'keep in mind that ',
      'add to knowledge that ',
      'remember ',
      'save ',
      'store ',
      'note ',
      'keep in mind ',
      'add to knowledge '
    ];

    for (const phrase of phrasesToRemove) {
      if (infoToSave.toLowerCase().startsWith(phrase)) {
        infoToSave = infoToSave.substring(phrase.length);
        break;
      }
    }

    // Create a title based on the content
    const title = this.generateTitle(infoToSave);

    // Determine a category based on content
    const category = this.categorizeInformation(infoToSave);

    // Create the knowledge entry
    const entry = await knowledgeService.createKnowledgeEntry(userId, {
      title,
      content: infoToSave,
      category,
      tags: this.extractTags(infoToSave)
    });

    return {
      success: true,
      message: `I've saved the information "${title}" to your knowledge vault under the "${category}" category.`,
      entry: entry
    };
  }

  private async handleSearchInformation(userId: string, command: string) {
    // Extract search query from command
    let searchQuery = command;

    // Remove common search phrases
    const searchPhrases = [
      'search for ',
      'find ',
      'lookup ',
      'what do i know about ',
      'tell me about ',
      'do i know about ',
      'search ',
      'find information about ',
      'what information do i have about '
    ];

    for (const phrase of searchPhrases) {
      const idx = searchQuery.toLowerCase().indexOf(phrase);
      if (idx !== -1) {
        searchQuery = searchQuery.substring(idx + phrase.length);
        break;
      }
    }

    // Perform search
    const entries = await knowledgeService.searchKnowledgeEntries(userId, searchQuery);

    if (entries.length === 0) {
      return {
        success: true,
        message: `I couldn't find any information related to "${searchQuery}" in your knowledge vault.`,
        entries: []
      };
    }

    return {
      success: true,
      message: `I found ${entries.length} piece(s) of information related to "${searchQuery}":`,
      entries: entries
    };
  }

  private async handleRetrieveInformation(userId: string, command: string) {
    // This is similar to search but might be more specific
    // For now, we'll treat it similarly to search
    return this.handleSearchInformation(userId, command);
  }

  private async handleUpdateInformation(userId: string, command: string) {
    // Extract information to update and new content
    // This is a simplified implementation

    // For now, we'll just search for similar content and update the most relevant one
    // In a real implementation, you'd need more sophisticated matching

    // Get all entries to find the one to update
    const allEntries = await knowledgeService.getKnowledgeEntriesByUserId(userId);

    // For simplicity, we'll just update the most recent entry that matches keywords
    const keywords = this.extractKeywords(command);
    let entryToUpdate = null;

    for (const entry of allEntries) {
      for (const keyword of keywords) {
        if (entry.title.toLowerCase().includes(keyword) || entry.content.toLowerCase().includes(keyword)) {
          entryToUpdate = entry;
          break;
        }
      }
      if (entryToUpdate) break;
    }

    if (!entryToUpdate) {
      return {
        success: false,
        message: 'Could not find the specific information to update. Please be more specific.'
      };
    }

    // Extract new content from command
    const newContent = this.extractNewContent(command, entryToUpdate.content);

    // Update the entry
    const updatedEntry = await knowledgeService.updateKnowledgeEntry(entryToUpdate.id, userId, {
      content: newContent
    });

    return {
      success: true,
      message: `I've updated the information "${entryToUpdate.title}" in your knowledge vault.`,
      entry: updatedEntry
    };
  }

  private async handleDeleteInformation(userId: string, command: string) {
    // Extract information to delete
    // This is a simplified implementation

    // Get all entries to find the one to delete
    const allEntries = await knowledgeService.getKnowledgeEntriesByUserId(userId);

    // For simplicity, we'll just delete the most recent entry that matches keywords
    const keywords = this.extractKeywords(command);
    let entryToDelete = null;

    for (const entry of allEntries) {
      for (const keyword of keywords) {
        if (entry.title.toLowerCase().includes(keyword) || entry.content.toLowerCase().includes(keyword)) {
          entryToDelete = entry;
          break;
        }
      }
      if (entryToDelete) break;
    }

    if (!entryToDelete) {
      return {
        success: false,
        message: 'Could not find the specific information to delete. Please be more specific.'
      };
    }

    // Delete the entry
    await knowledgeService.deleteKnowledgeEntry(entryToDelete.id, userId);

    return {
      success: true,
      message: `I've deleted the information "${entryToDelete.title}" from your knowledge vault.`
    };
  }

  private generateTitle(content: string): string {
    // Create a title based on the first part of the content
    // Limit to 50 characters and remove punctuation at the end
    let title = content.substring(0, 50).trim();

    // Remove trailing punctuation
    title = title.replace(/[.!?:;]+$/, '');

    return title || 'Untitled Entry';
  }

  private categorizeInformation(content: string): string {
    // Simple categorization based on keywords
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('work') || lowerContent.includes('job') || lowerContent.includes('project') ||
        lowerContent.includes('meeting') || lowerContent.includes('client')) {
      return 'work';
    } else if (lowerContent.includes('personal') || lowerContent.includes('family') || lowerContent.includes('home') ||
               lowerContent.includes('health') || lowerContent.includes('fitness')) {
      return 'personal';
    } else if (lowerContent.includes('tech') || lowerContent.includes('programming') || lowerContent.includes('code') ||
               lowerContent.includes('software') || lowerContent.includes('computer')) {
      return 'technology';
    } else if (lowerContent.includes('finance') || lowerContent.includes('money') || lowerContent.includes('budget') ||
               lowerContent.includes('investment')) {
      return 'finance';
    } else if (lowerContent.includes('idea') || lowerContent.includes('thought') || lowerContent.includes('concept')) {
      return 'ideas';
    } else {
      return 'general';
    }
  }

  private extractTags(content: string): string[] {
    // Extract tags based on hashtags or keywords
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();

    // Look for common tags
    if (lowerContent.includes('important') || lowerContent.includes('urgent')) {
      tags.push('important');
    }
    if (lowerContent.includes('todo') || lowerContent.includes('task')) {
      tags.push('task');
    }
    if (lowerContent.includes('idea') || lowerContent.includes('thought')) {
      tags.push('idea');
    }
    if (lowerContent.includes('reference') || lowerContent.includes('info')) {
      tags.push('reference');
    }

    // Return up to 3 tags
    return tags.slice(0, 3);
  }

  private extractKeywords(command: string): string[] {
    // Extract keywords from the command
    const lowerCommand = command.toLowerCase();

    // Remove common words
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];

    // Extract words longer than 2 characters that aren't stop words
    const words = lowerCommand.split(/\W+/).filter(word =>
      word.length > 2 && !stopWords.includes(word)
    );

    return [...new Set(words)]; // Remove duplicates
  }

  private extractNewContent(command: string, oldContent: string): string {
    // Extract the new content from the command
    // This is a simplified implementation

    // Look for phrases indicating new content
    const updateIndicators = [
      'change to ',
      'update to ',
      'new content: ',
      'becomes ',
      'is now '
    ];

    for (const indicator of updateIndicators) {
      const idx = command.toLowerCase().indexOf(indicator);
      if (idx !== -1) {
        return command.substring(idx + indicator.length).trim();
      }
    }

    // If no specific update indication, return the original command
    return command;
  }
}

export default new KnowledgeAgent();