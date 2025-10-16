"""
Git Manager for Prompt Versioning

This module provides Git-based version control for prompts,
storing each prompt as a separate file with full commit history.
"""

import os
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict
from git import Repo, Actor, GitCommandError, InvalidGitRepositoryError
from git.exc import NoSuchPathError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PromptGitManager:
    """
    Manages Git operations for prompt versioning.

    Each prompt is stored as a markdown file in the repository
    with full version history tracked via Git commits.
    """

    def __init__(self, repo_path: str = None):
        """
        Initialize the Git repository manager.

        Args:
            repo_path: Path to the Git repository. Defaults to backend/src/prompts_repo/
        """
        if repo_path is None:
            # Default location: backend/src/prompts_repo/
            base_dir = Path(__file__).parent
            repo_path = base_dir / "prompts_repo"

        self.repo_path = Path(repo_path)
        self.prompts_dir = self.repo_path / "prompts"
        self.repo = None

        # Initialize or open repository
        try:
            self._initialize_repo()
        except Exception as e:
            logger.error(f"Failed to initialize Git repository: {e}")
            raise

    def _initialize_repo(self):
        """Initialize Git repository if it doesn't exist, or open existing one."""
        try:
            # Try to open existing repository
            self.repo = Repo(str(self.repo_path))
            logger.info(f"Opened existing Git repository at {self.repo_path}")
        except (InvalidGitRepositoryError, NoSuchPathError):
            # Repository doesn't exist, create it
            logger.info(f"Initializing new Git repository at {self.repo_path}")
            self.repo_path.mkdir(parents=True, exist_ok=True)
            self.repo = Repo.init(str(self.repo_path))

            # Create prompts directory
            self.prompts_dir.mkdir(exist_ok=True)

            # Create initial commit
            readme_path = self.repo_path / "README.md"
            readme_path.write_text("# AskHole Prompts Repository\n\nThis repository stores all prompts with version history.\n")
            self.repo.index.add([str(readme_path)])
            self.repo.index.commit(
                "Initial commit: Initialize prompts repository",
                author=Actor("AskHole System", "system@askhole.local")
            )
            logger.info("Created initial commit")

        # Configure Git to handle UTF-8 properly
        with self.repo.config_writer() as config:
            config.set_value("i18n", "commitEncoding", "utf-8")
            config.set_value("i18n", "logOutputEncoding", "utf-8")
        logger.info("Configured Git for UTF-8 encoding")

    def _get_prompt_file_path(self, prompt_id: int) -> Path:
        """Get the file path for a prompt."""
        return self.prompts_dir / f"{prompt_id}.md"

    def _get_relative_path(self, file_path: Path) -> str:
        """Get path relative to repo root."""
        return str(file_path.relative_to(self.repo_path))

    def save_prompt(
        self,
        prompt_id: int,
        content: str,
        commit_message: str,
        author_name: str,
        author_email: str = None
    ) -> str:
        """
        Save prompt content to file and create a Git commit.

        Args:
            prompt_id: The prompt ID
            content: The prompt content
            commit_message: Commit message
            author_name: Name of the author
            author_email: Email of the author (defaults to username@askhole.local)

        Returns:
            Commit hash (SHA)

        Raises:
            Exception: If commit fails
        """
        try:
            # Ensure prompts directory exists
            self.prompts_dir.mkdir(exist_ok=True)

            # Get file path
            file_path = self._get_prompt_file_path(prompt_id)
            relative_path = self._get_relative_path(file_path)

            # Write content to file
            file_path.write_text(content, encoding='utf-8')
            logger.info(f"Wrote content to {file_path}")

            # Prepare author
            if not author_email:
                author_email = f"{author_name}@askhole.local"
            author = Actor(author_name, author_email)

            # Stage the file
            self.repo.index.add([relative_path])

            # Create commit
            commit = self.repo.index.commit(
                commit_message,
                author=author,
                committer=author
            )

            commit_hash = commit.hexsha
            logger.info(f"Created commit {commit_hash[:7]} for prompt {prompt_id}")

            return commit_hash

        except Exception as e:
            logger.error(f"Failed to save prompt {prompt_id}: {e}")
            raise Exception(f"Failed to save prompt to Git: {str(e)}")

    def get_prompt_content(
        self,
        prompt_id: int,
        commit_hash: Optional[str] = None
    ) -> str:
        """
        Read prompt content from file at specific commit.

        Args:
            prompt_id: The prompt ID
            commit_hash: Specific commit hash (None for HEAD)

        Returns:
            Prompt content as string

        Raises:
            FileNotFoundError: If prompt file doesn't exist
            Exception: If Git operation fails
        """
        try:
            file_path = self._get_prompt_file_path(prompt_id)
            relative_path = self._get_relative_path(file_path)

            if commit_hash:
                # Read from specific commit using git show command
                try:
                    import subprocess
                    result = subprocess.run(
                        ['git', 'show', f'{commit_hash}:{relative_path}'],
                        cwd=self.repo_path,
                        capture_output=True,
                        text=True,
                        encoding='utf-8',
                        check=True
                    )
                    content = result.stdout
                except subprocess.CalledProcessError as e:
                    if 'does not exist' in e.stderr or 'exists on disk, but not in' in e.stderr:
                        raise FileNotFoundError(f"Prompt {prompt_id} not found in commit {commit_hash[:7]}")
                    raise Exception(f"Git show failed: {e.stderr}")
            else:
                # Read from current file (HEAD)
                if not file_path.exists():
                    raise FileNotFoundError(f"Prompt file not found: {file_path}")
                content = file_path.read_text(encoding='utf-8')

            return content

        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to read prompt {prompt_id}: {e}")
            raise Exception(f"Failed to read prompt from Git: {str(e)}")

    def get_version_history(self, prompt_id: int, max_count: int = 50) -> List[Dict]:
        """
        Get commit history for a specific prompt.

        Args:
            prompt_id: The prompt ID
            max_count: Maximum number of commits to return

        Returns:
            List of commit dictionaries with keys:
            - commit_hash: Full SHA
            - short_hash: First 7 characters of SHA
            - author: Author name
            - author_email: Author email
            - date: Commit date (ISO format)
            - timestamp: Unix timestamp
            - message: Commit message
        """
        try:
            file_path = self._get_prompt_file_path(prompt_id)
            relative_path = self._get_relative_path(file_path)

            # Check if file exists
            if not file_path.exists():
                logger.warning(f"Prompt file {file_path} does not exist, returning empty history")
                return []

            # Use git log command directly to avoid GitPython parsing issues
            import subprocess
            result = subprocess.run(
                [
                    'git', 'log',
                    f'-{max_count}',
                    '--format=%H|%an|%ae|%ct|%s',  # hash|author|email|timestamp|subject
                    '--',
                    relative_path
                ],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                encoding='utf-8',
                check=True
            )

            history = []
            for line in result.stdout.strip().split('\n'):
                if not line:
                    continue

                parts = line.split('|', 4)  # Split into max 5 parts
                if len(parts) >= 5:
                    commit_hash, author, email, timestamp_str, message = parts
                    timestamp = int(timestamp_str)

                    history.append({
                        'commit_hash': commit_hash,
                        'short_hash': commit_hash[:7],
                        'author': author,
                        'author_email': email,
                        'date': datetime.fromtimestamp(timestamp).isoformat(),
                        'timestamp': timestamp,
                        'message': message
                    })

            logger.info(f"Retrieved {len(history)} commits for prompt {prompt_id}")
            return history

        except subprocess.CalledProcessError as e:
            logger.error(f"Git log command failed for prompt {prompt_id}: {e.stderr}")
            return []
        except Exception as e:
            logger.error(f"Failed to get version history for prompt {prompt_id}: {e}")
            return []

    def get_diff(
        self,
        prompt_id: int,
        from_commit: str,
        to_commit: str
    ) -> str:
        """
        Generate diff between two commits for a prompt.

        Args:
            prompt_id: The prompt ID
            from_commit: Source commit hash
            to_commit: Target commit hash

        Returns:
            Diff string in unified format

        Raises:
            Exception: If diff generation fails
        """
        try:
            file_path = self._get_prompt_file_path(prompt_id)
            relative_path = self._get_relative_path(file_path)

            # Use git diff command for proper unified diff format
            import subprocess
            result = subprocess.run(
                ['git', 'diff', from_commit, to_commit, '--', relative_path],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                encoding='utf-8',
                check=False  # Don't raise on non-zero exit (empty diff returns 0 anyway)
            )

            diff_text = result.stdout.strip()

            if not diff_text:
                # No differences - return a message
                return "No differences found"

            return diff_text

        except Exception as e:
            logger.error(f"Failed to generate diff for prompt {prompt_id}: {e}")
            raise Exception(f"Failed to generate diff: {str(e)}")

    def rollback_prompt(
        self,
        prompt_id: int,
        target_commit: str,
        commit_message: str,
        author_name: str,
        author_email: str = None
    ) -> str:
        """
        Rollback prompt to a previous version (creates new commit).

        This doesn't rewrite history - it creates a new commit with
        the content from the target commit.

        Args:
            prompt_id: The prompt ID
            target_commit: Commit hash to rollback to
            commit_message: Message for the rollback commit
            author_name: Name of the author
            author_email: Email of the author

        Returns:
            New commit hash

        Raises:
            Exception: If rollback fails
        """
        try:
            # Get content from target commit
            content = self.get_prompt_content(prompt_id, target_commit)

            # Save as new commit
            commit_hash = self.save_prompt(
                prompt_id=prompt_id,
                content=content,
                commit_message=commit_message,
                author_name=author_name,
                author_email=author_email
            )

            logger.info(f"Rolled back prompt {prompt_id} to {target_commit[:7]}, new commit: {commit_hash[:7]}")
            return commit_hash

        except Exception as e:
            logger.error(f"Failed to rollback prompt {prompt_id}: {e}")
            raise Exception(f"Failed to rollback prompt: {str(e)}")

    def delete_prompt_file(
        self,
        prompt_id: int,
        commit_message: str,
        author_name: str,
        author_email: str = None
    ) -> str:
        """
        Delete prompt file and commit the deletion.

        Args:
            prompt_id: The prompt ID
            commit_message: Commit message
            author_name: Name of the author
            author_email: Email of the author

        Returns:
            Commit hash

        Raises:
            Exception: If deletion fails
        """
        try:
            file_path = self._get_prompt_file_path(prompt_id)
            relative_path = self._get_relative_path(file_path)

            if not file_path.exists():
                logger.warning(f"Prompt file {file_path} does not exist, skipping deletion")
                return None

            # Remove file from filesystem
            file_path.unlink()

            # Prepare author
            if not author_email:
                author_email = f"{author_name}@askhole.local"
            author = Actor(author_name, author_email)

            # Stage deletion
            self.repo.index.remove([relative_path])

            # Commit deletion
            commit = self.repo.index.commit(
                commit_message,
                author=author,
                committer=author
            )

            commit_hash = commit.hexsha
            logger.info(f"Deleted prompt {prompt_id}, commit: {commit_hash[:7]}")

            return commit_hash

        except Exception as e:
            logger.error(f"Failed to delete prompt {prompt_id}: {e}")
            raise Exception(f"Failed to delete prompt file: {str(e)}")

    def file_exists(self, prompt_id: int) -> bool:
        """Check if prompt file exists."""
        file_path = self._get_prompt_file_path(prompt_id)
        return file_path.exists()
