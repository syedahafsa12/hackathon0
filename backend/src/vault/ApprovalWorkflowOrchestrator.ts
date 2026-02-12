import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { FileWatcher } from './FileWatcher';
import { VaultManager } from './VaultManager';

export interface WorkflowEvent {
  type: 'approval_request' | 'approval_granted' | 'approval_denied' | 'workflow_complete';
  actionType: string;
  requestId: string;
  context: string;
  timestamp: string;
  decision?: 'approved' | 'rejected';
  details?: string;
}

export class ApprovalWorkflowOrchestrator extends EventEmitter {
  private logger: Logger;
  private fileWatcher: FileWatcher;
  private vaultManager: VaultManager;
  private isRunning = false;

  constructor(fileWatcher: FileWatcher, vaultManager: VaultManager) {
    super();
    this.fileWatcher = fileWatcher;
    this.vaultManager = vaultManager;
    this.logger = new Logger('WorkflowOrchestrator');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Workflow orchestrator already running');
      return;
    }

    this.logger.info('Starting Approval Workflow Orchestrator...');

    // Setup event handlers
    this.setupEventHandlers();

    this.isRunning = true;
    this.logger.info('Approval Workflow Orchestrator started');
  }

  stop(): void {
    this.isRunning = false;
    this.logger.info('Approval Workflow Orchestrator stopped');
  }

  private setupEventHandlers(): void {
    this.fileWatcher.on('approval', (event) => this.handleApprovalEvent(event));
    this.fileWatcher.on('approvalValidationFailed', (event) => this.handleValidationFailure(event));
  }

  async createApprovalRequest(
    actionType: string,
    context: string,
    content: string,
    metadata: any = {}
  ): Promise<string> {
    this.logger.info(`Creating approval request: ${actionType} - ${context}`);

    const approvalMetadata: any = {
      decisionCriteria: [
        'Verify action aligns with business goals',
        'Check for compliance with company handbook',
        'Assess potential risks and impacts'
      ],
      approvalThresholds: {},
      formatGuidelines: [
        'Review action type and context',
        'Verify all required fields are present',
        'Check for any potential issues'
      ],
      approvalProcess: [
        'Review file in Pending_Approval folder',
        'Move to Approved or Rejected folder',
        'File will be processed automatically'
      ],
      ...metadata
    };

    const filePath = await this.vaultManager.createApprovalFile(
      actionType,
      context,
      approvalMetadata,
      content
    );

    // Emit approval request event
    const approvalRequest: WorkflowEvent = {
      type: 'approval_request',
      actionType,
      requestId: approvalMetadata.requestId,
      context,
      timestamp: new Date().toISOString()
    };

    this.emit('approval_request', approvalRequest);
    await this.vaultManager.logAction('approval_request_created', `Approval request created: ${actionType} - ${context}`, {
      requestId: approvalMetadata.requestId,
      actionType,
      context
    });

    return filePath;
  }

  private async handleApprovalEvent(event: any): Promise<void> {
    this.logger.info(`Handling approval event: ${event.type} for ${event.actionType}`);

    const workflowEvent: WorkflowEvent = {
      type: event.type === 'approved' ? 'approval_granted' : 'approval_denied',
      actionType: event.actionType,
      requestId: event.requestId,
      context: event.context,
      timestamp: new Date().toISOString(),
      decision: event.type
    };

    this.emit('workflow_event', workflowEvent);

    // Log the approval decision
    await this.vaultManager.logAction(
      workflowEvent.type,
      `Approval ${workflowEvent.decision}: ${event.actionType} - ${event.context}`,
      {
        requestId: event.requestId,
        actionType: event.actionType,
        decision: workflowEvent.decision
      }
    );

    if (event.type === 'approved') {
      await this.processApprovedAction(event);
    } else {
      await this.processRejectedAction(event);
    }
  }

  private async processApprovedAction(event: any): Promise<void> {
    this.logger.info(`Processing approved action: ${event.actionType}`);

    // Move file to Debrief folder for documentation
    const sourcePath = event.movePath;
    const debriefPath = sourcePath.replace('Approved', 'Debrief');

    try {
      await import('fs').then(fs => fs.promises.rename(sourcePath, debriefPath));
      this.logger.info(`Moved approved file to debrief: ${debriefPath}`);

      // Emit workflow complete event
      const workflowEvent: WorkflowEvent = {
        type: 'workflow_complete',
        actionType: event.actionType,
        requestId: event.requestId,
        context: event.context,
        timestamp: new Date().toISOString(),
        decision: 'approved',
        details: `Action processed and moved to debrief folder`
      };

      this.emit('workflow_event', workflowEvent);

      await this.vaultManager.logAction(
        'workflow_complete',
        `Workflow completed for approved action: ${event.actionType}`,
        {
          requestId: event.requestId,
          actionType: event.actionType,
          decision: 'approved'
        }
      );

    } catch (error) {
      this.logger.error('Failed to move approved file to debrief', error);
      await this.vaultManager.logAction(
        'workflow_error',
        `Failed to process approved action: ${event.actionType}`,
        {
          requestId: event.requestId,
          actionType: event.actionType,
          error: error.message
        }
      );
    }
  }

  private async processRejectedAction(event: any): Promise<void> {
    this.logger.info(`Processing rejected action: ${event.actionType}`);

    // Move file to Debrief folder for documentation
    const sourcePath = event.movePath;
    const debriefPath = sourcePath.replace('Rejected', 'Debrief');

    try {
      await import('fs').then(fs => fs.promises.rename(sourcePath, debriefPath));
      this.logger.info(`Moved rejected file to debrief: ${debriefPath}`);

      // Emit workflow complete event
      const workflowEvent: WorkflowEvent = {
        type: 'workflow_complete',
        actionType: event.actionType,
        requestId: event.requestId,
        context: event.context,
        timestamp: new Date().toISOString(),
        decision: 'rejected',
        details: `Action rejected and moved to debrief folder`
      };

      this.emit('workflow_event', workflowEvent);

      await this.vaultManager.logAction(
        'workflow_complete',
        `Workflow completed for rejected action: ${event.actionType}`,
        {
          requestId: event.requestId,
          actionType: event.actionType,
          decision: 'rejected'
        }
      );

    } catch (error) {
      this.logger.error('Failed to move rejected file to debrief', error);
      await this.vaultManager.logAction(
        'workflow_error',
        `Failed to process rejected action: ${event.actionType}`,
        {
          requestId: event.requestId,
          actionType: event.actionType,
          error: error.message
        }
      );
    }
  }

  private async handleValidationFailure(event: any): Promise<void> {
    this.logger.warn('Approval file validation failed', event);

    // Log validation failure
    await this.vaultManager.logAction(
      'approval_validation_failed',
      `Approval file validation failed: ${event.filePath}`,
      {
        filePath: event.filePath,
        missingFields: event.missingFields
      }
    );

    // Emit event for monitoring
    this.emit('workflow_event', {
      type: 'approval_validation_failed',
      actionType: 'unknown',
      requestId: 'unknown',
      context: 'unknown',
      timestamp: new Date().toISOString(),
      details: `Validation failed for ${event.filePath}`
    });
  }

  getWorkflowStatus(): {
    isRunning: boolean;
    pendingApprovals: number;
    approvedActions: number;
    rejectedActions: number;
  } {
    return {
      isRunning: this.isRunning,
      pendingApprovals: 0, // TODO: Implement counting
      approvedActions: 0, // TODO: Implement counting
      rejectedActions: 0 // TODO: Implement counting
    };
  }
}

export { WorkflowEvent };