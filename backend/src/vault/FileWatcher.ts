import chokidar from 'chokidar';
import { join } from 'path';
import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { VaultManager } from './VaultManager';

export interface WatchEvent {
  type: 'create' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: string;
}

export interface ApprovalEvent {
  type: 'approved' | 'rejected' | 'created';
  filePath: string;
  requestId: string;
  actionType: string;
  context: string;
  movePath?: string;
}

export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher;
  private vaultPath: string;
  private logger: Logger;
  private vaultManager: VaultManager;
  private isWatching = false;

  constructor(vaultManager: VaultManager) {
    super();
    this.vaultManager = vaultManager;
    this.vaultPath = vaultManager.getVaultPath();
    this.logger = new Logger('FileWatcher');
  }

  async start(): Promise<void> {
    if (this.isWatching) {
      this.logger.warn('FileWatcher already running');
      return;
    }

    this.logger.info('Starting FileWatcher...');

    this.watcher = chokidar.watch(this.vaultPath, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      depth: 3,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    this.setupEventHandlers();

    this.watcher.on('ready', () => {
      this.isWatching = true;
      this.logger.info('FileWatcher ready');
    });

    this.watcher.on('error', (error: Error) => {
      this.logger.error('FileWatcher error', error);
    });
  }

  stop(): void {
    if (this.watcher && this.isWatching) {
      this.watcher.close();
      this.isWatching = false;
      this.logger.info('FileWatcher stopped');
    }
  }

  private setupEventHandlers(): void {
    this.watcher
      .on('addDir', (path) => this.handleDirectoryEvent('addDir', path))
      .on('unlinkDir', (path) => this.handleDirectoryEvent('unlinkDir', path))
      .on('add', (path) => this.handleFileEvent('create', path))
      .on('change', (path) => this.handleFileEvent('change', path))
      .on('unlink', (path) => this.handleFileEvent('unlink', path));
  }

  private async handleDirectoryEvent(
    type: 'addDir' | 'unlinkDir',
    path: string
  ): Promise<void> {
    const event: WatchEvent = {
      type,
      path,
      timestamp: new Date().toISOString()
    };

    this.emit('directoryChange', event);
    this.logger.debug(`Directory ${type}: ${path}`);
  }

  private async handleFileEvent(
    type: 'create' | 'change' | 'unlink',
    path: string
  ): Promise<void> {
    const event: WatchEvent = {
      type,
      path,
      timestamp: new Date().toISOString()
    };

    this.emit('fileChange', event);
    this.logger.debug(`File ${type}: ${path}`);

    // Special handling for approval workflow
    if (type === 'unlink') {
      await this.handleFileMove(path);
    }

    if (type === 'create' || type === 'change') {
      await this.validateFile(path);
    }
  }

  private async handleFileMove(sourcePath: string): Promise<void> {
    const relativePath = sourcePath.replace(this.vaultPath, '').replace(/^[/\\]/, '');

    if (relativePath.startsWith('Pending_Approval/')) {
      this.logger.info(`Approval file moved: ${sourcePath}`);

      try {
        const fileContent = await import('fs').then(fs => fs.promises.readFile(sourcePath, 'utf8'));
        const { data } = await import('gray-matter').then(gm => gm(fileContent));

        const approvalEvent: ApprovalEvent = {
          type: 'moved',
          filePath: sourcePath,
          requestId: data.requestId || 'unknown',
          actionType: data.actionType || 'unknown',
          context: data.context || 'unknown'
        };

        // Determine if file was approved or rejected based on destination
        if (relativePath.includes('/Approved/')) {
          approvalEvent.type = 'approved';
          approvalEvent.movePath = sourcePath.replace('Pending_Approval', 'Approved');
          await this.vaultManager.logAction('approval_granted', `File approved: ${data.actionType} - ${data.context}`, {
            requestId: data.requestId,
            actionType: data.actionType
          });
        } else if (relativePath.includes('/Rejected/')) {
          approvalEvent.type = 'rejected';
          approvalEvent.movePath = sourcePath.replace('Pending_Approval', 'Rejected');
          await this.vaultManager.logAction('approval_denied', `File rejected: ${data.actionType} - ${data.context}`, {
            requestId: data.requestId,
            actionType: data.actionType
          });
        }

        this.emit('approval', approvalEvent);
      } catch (error) {
        this.logger.error('Failed to process moved approval file', error);
      }
    }
  }

  private async validateFile(filePath: string): Promise<void> {
    const relativePath = filePath.replace(this.vaultPath, '').replace(/^[/\\]/, '');

    if (relativePath.startsWith('Pending_Approval/') && filePath.endsWith('.md')) {
      try {
        const fileContent = await import('fs').then(fs => fs.promises.readFile(filePath, 'utf8'));
        const { data } = await import('gray-matter').then(gm => gm(fileContent));

        // Check required fields in frontmatter
        const requiredFields = ['actionType', 'requestId', 'timestamp'];
        const missingFields = requiredFields.filter(field => !data[field]);

        if (missingFields.length > 0) {
          this.logger.warn(`Approval file missing required fields: ${missingFields.join(', ')} in ${filePath}`);
          this.emit('approvalValidationFailed', {
            filePath,
            missingFields
          });
        }
      } catch (error) {
        this.logger.error(`Failed to validate file: ${filePath}`, error);
      }
    }
  }

  getVaultPath(): string {
    return this.vaultPath;
  }

  isActive(): boolean {
    return this.isWatching;
  }
}