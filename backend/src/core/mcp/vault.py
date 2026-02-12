"""
Vault folder operations for file-based state management.

Manages the vault folder structure for HITL workflow:
Plans/, Needs_Action/, Done/, Pending_Approval/, Approved/, Rejected/, Logs/
"""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any
import asyncio
import aiofiles

from ..logging.structured import StructuredLogger


class VaultFolder(str, Enum):
    """Vault folder types."""
    PLANS = "Plans"
    NEEDS_ACTION = "Needs_Action"
    DONE = "Done"
    PENDING_APPROVAL = "Pending_Approval"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    LOGS = "Logs"


@dataclass
class VaultPaths:
    """
    Path constants for vault folders.

    Attributes:
        root: Root vault directory
        plans: Plans folder path
        needs_action: Needs_Action folder path
        done: Done folder path
        pending_approval: Pending_Approval folder path
        approved: Approved folder path
        rejected: Rejected folder path
        logs: Logs folder path
    """
    root: Path

    @property
    def plans(self) -> Path:
        return self.root / VaultFolder.PLANS.value

    @property
    def needs_action(self) -> Path:
        return self.root / VaultFolder.NEEDS_ACTION.value

    @property
    def done(self) -> Path:
        return self.root / VaultFolder.DONE.value

    @property
    def pending_approval(self) -> Path:
        return self.root / VaultFolder.PENDING_APPROVAL.value

    @property
    def approved(self) -> Path:
        return self.root / VaultFolder.APPROVED.value

    @property
    def rejected(self) -> Path:
        return self.root / VaultFolder.REJECTED.value

    @property
    def logs(self) -> Path:
        return self.root / VaultFolder.LOGS.value

    def get_folder_path(self, folder: VaultFolder) -> Path:
        """Get path for a specific folder."""
        return self.root / folder.value


@dataclass
class VaultFile:
    """
    Represents a file in the vault.

    Attributes:
        path: Relative path within vault
        folder: Which folder it's in
        filename: File name
        content: Parsed JSON content
        created_at: File creation time
        modified_at: Last modification time
    """
    path: str
    folder: VaultFolder
    filename: str
    content: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    modified_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "path": self.path,
            "folder": self.folder.value,
            "filename": self.filename,
            "content": self.content,
            "created_at": self.created_at.isoformat(),
            "modified_at": self.modified_at.isoformat(),
        }


def write_atomic(path: Path, data: dict[str, Any]) -> None:
    """
    Write data to file atomically using temp file + rename.

    This prevents partial reads during concurrent access.

    Args:
        path: Target file path
        data: Data to write as JSON
    """
    dir_path = path.parent
    dir_path.mkdir(parents=True, exist_ok=True)

    # Write to temp file first
    fd, temp_path = tempfile.mkstemp(dir=str(dir_path), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=2, default=str)
        # Atomic rename
        os.replace(temp_path, path)
    except Exception:
        # Clean up temp file on error
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise


async def write_atomic_async(path: Path, data: dict[str, Any]) -> None:
    """
    Async version of atomic write.

    Args:
        path: Target file path
        data: Data to write as JSON
    """
    dir_path = path.parent
    dir_path.mkdir(parents=True, exist_ok=True)

    # Write to temp file first
    temp_path = path.with_suffix(".tmp")
    try:
        async with aiofiles.open(temp_path, "w") as f:
            await f.write(json.dumps(data, indent=2, default=str))
        # Atomic rename (sync, but very fast)
        os.replace(temp_path, path)
    except Exception:
        # Clean up temp file on error
        if temp_path.exists():
            temp_path.unlink()
        raise


class VaultManager:
    """
    Manages vault folder operations for HITL workflow.

    Provides atomic file operations, folder management,
    and file watching capabilities.
    """

    def __init__(self, root_path: str | Path, log_path: str | None = None):
        """
        Initialize vault manager.

        Args:
            root_path: Root path for vault folders
            log_path: Path for structured logs (optional)
        """
        self.paths = VaultPaths(root=Path(root_path))
        self.logger = StructuredLogger("vault:manager", log_path)
        self._observer = None  # For file watching
        self._event_handlers: dict[str, list] = {}

    async def initialize(self) -> None:
        """Initialize vault by creating all required folders."""
        self.logger.info("initialize", input_data={"root": str(self.paths.root)})
        await self.ensure_folders()

    async def ensure_folders(self) -> None:
        """Ensure all vault folders exist."""
        folders = [
            self.paths.plans,
            self.paths.needs_action,
            self.paths.done,
            self.paths.pending_approval,
            self.paths.approved,
            self.paths.rejected,
            self.paths.logs,
            self.paths.logs / "agents",
            self.paths.logs / "loop",
            self.paths.logs / "system",
        ]

        for folder in folders:
            folder.mkdir(parents=True, exist_ok=True)

        self.logger.info("ensure_folders", output_data={"folders_created": len(folders)})

    async def create_file(
        self,
        folder: VaultFolder,
        filename: str,
        content: dict[str, Any],
    ) -> VaultFile:
        """
        Create a new file in a vault folder.

        Args:
            folder: Target folder
            filename: File name (without extension, .json added)
            content: File content as dictionary

        Returns:
            VaultFile representing the created file
        """
        if not filename.endswith(".json"):
            filename = f"{filename}.json"

        folder_path = self.paths.get_folder_path(folder)
        file_path = folder_path / filename

        # Add metadata to content
        now = datetime.now()
        content_with_meta = {
            **content,
            "_vault_metadata": {
                "created_at": now.isoformat(),
                "modified_at": now.isoformat(),
                "folder": folder.value,
            }
        }

        await write_atomic_async(file_path, content_with_meta)

        vault_file = VaultFile(
            path=str(file_path.relative_to(self.paths.root)),
            folder=folder,
            filename=filename,
            content=content,
            created_at=now,
            modified_at=now,
        )

        self.logger.info(
            "create_file",
            input_data={"folder": folder.value, "filename": filename},
            output_data={"path": vault_file.path},
        )

        return vault_file

    async def read_file(self, folder: VaultFolder, filename: str) -> VaultFile | None:
        """
        Read a file from a vault folder.

        Args:
            folder: Source folder
            filename: File name

        Returns:
            VaultFile if found, None otherwise
        """
        if not filename.endswith(".json"):
            filename = f"{filename}.json"

        folder_path = self.paths.get_folder_path(folder)
        file_path = folder_path / filename

        if not file_path.exists():
            return None

        try:
            async with aiofiles.open(file_path, "r") as f:
                content = json.loads(await f.read())

            # Extract metadata
            metadata = content.pop("_vault_metadata", {})
            created_at = datetime.fromisoformat(metadata.get("created_at", datetime.now().isoformat()))
            modified_at = datetime.fromisoformat(metadata.get("modified_at", datetime.now().isoformat()))

            return VaultFile(
                path=str(file_path.relative_to(self.paths.root)),
                folder=folder,
                filename=filename,
                content=content,
                created_at=created_at,
                modified_at=modified_at,
            )
        except Exception as e:
            self.logger.error("read_file", e, input_data={"folder": folder.value, "filename": filename})
            return None

    async def move_file(
        self,
        filename: str,
        from_folder: VaultFolder,
        to_folder: VaultFolder,
        update_content: dict[str, Any] | None = None,
    ) -> VaultFile | None:
        """
        Move a file between vault folders.

        Args:
            filename: File name
            from_folder: Source folder
            to_folder: Destination folder
            update_content: Optional content updates

        Returns:
            VaultFile at new location, None if source not found
        """
        if not filename.endswith(".json"):
            filename = f"{filename}.json"

        from_path = self.paths.get_folder_path(from_folder) / filename
        to_path = self.paths.get_folder_path(to_folder) / filename

        if not from_path.exists():
            return None

        try:
            # Read current content
            async with aiofiles.open(from_path, "r") as f:
                content = json.loads(await f.read())

            # Update content if provided
            if update_content:
                content.update(update_content)

            # Update metadata
            now = datetime.now()
            if "_vault_metadata" in content:
                content["_vault_metadata"]["modified_at"] = now.isoformat()
                content["_vault_metadata"]["folder"] = to_folder.value
            else:
                content["_vault_metadata"] = {
                    "created_at": now.isoformat(),
                    "modified_at": now.isoformat(),
                    "folder": to_folder.value,
                }

            # Write to new location
            await write_atomic_async(to_path, content)

            # Remove from old location
            from_path.unlink()

            # Extract metadata for return
            metadata = content.pop("_vault_metadata", {})

            vault_file = VaultFile(
                path=str(to_path.relative_to(self.paths.root)),
                folder=to_folder,
                filename=filename,
                content=content,
                created_at=datetime.fromisoformat(metadata.get("created_at", now.isoformat())),
                modified_at=now,
            )

            self.logger.info(
                "move_file",
                input_data={"filename": filename, "from": from_folder.value, "to": to_folder.value},
            )

            return vault_file

        except Exception as e:
            self.logger.error("move_file", e, input_data={"filename": filename})
            return None

    async def list_folder(self, folder: VaultFolder) -> list[str]:
        """
        List all files in a vault folder.

        Args:
            folder: Folder to list

        Returns:
            List of filenames
        """
        folder_path = self.paths.get_folder_path(folder)

        if not folder_path.exists():
            return []

        files = [f.name for f in folder_path.iterdir() if f.is_file() and f.suffix == ".json"]
        return sorted(files)

    async def delete_file(self, folder: VaultFolder, filename: str) -> bool:
        """
        Delete a file from a vault folder.

        Args:
            folder: Folder containing the file
            filename: File name

        Returns:
            True if deleted, False if not found
        """
        if not filename.endswith(".json"):
            filename = f"{filename}.json"

        file_path = self.paths.get_folder_path(folder) / filename

        if not file_path.exists():
            return False

        try:
            file_path.unlink()
            self.logger.info("delete_file", input_data={"folder": folder.value, "filename": filename})
            return True
        except Exception as e:
            self.logger.error("delete_file", e, input_data={"folder": folder.value, "filename": filename})
            return False

    def start_watching(self) -> None:
        """Start watching vault folders for changes."""
        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler

            class VaultEventHandler(FileSystemEventHandler):
                def __init__(self, vault_manager: VaultManager):
                    self.vault_manager = vault_manager

                def on_created(self, event):
                    if not event.is_directory and event.src_path.endswith(".json"):
                        self.vault_manager._emit_event("file_created", event.src_path)

                def on_modified(self, event):
                    if not event.is_directory and event.src_path.endswith(".json"):
                        self.vault_manager._emit_event("file_modified", event.src_path)

                def on_moved(self, event):
                    if not event.is_directory and event.dest_path.endswith(".json"):
                        self.vault_manager._emit_event("file_moved", {
                            "from": event.src_path,
                            "to": event.dest_path,
                        })

                def on_deleted(self, event):
                    if not event.is_directory and event.src_path.endswith(".json"):
                        self.vault_manager._emit_event("file_deleted", event.src_path)

            self._observer = Observer()
            handler = VaultEventHandler(self)
            self._observer.schedule(handler, str(self.paths.root), recursive=True)
            self._observer.start()

            self.logger.info("start_watching", output_data={"path": str(self.paths.root)})

        except ImportError:
            self.logger.warn("start_watching", output_data={"error": "watchdog not installed"})

    def stop_watching(self) -> None:
        """Stop watching vault folders."""
        if self._observer:
            self._observer.stop()
            self._observer.join()
            self._observer = None
            self.logger.info("stop_watching")

    def on_event(self, event_type: str, handler) -> None:
        """Register event handler for vault events."""
        if event_type not in self._event_handlers:
            self._event_handlers[event_type] = []
        self._event_handlers[event_type].append(handler)

    def _emit_event(self, event_type: str, data: Any) -> None:
        """Emit event to registered handlers."""
        if event_type in self._event_handlers:
            for handler in self._event_handlers[event_type]:
                try:
                    handler(data)
                except Exception as e:
                    self.logger.error(f"event_handler:{event_type}", e)
