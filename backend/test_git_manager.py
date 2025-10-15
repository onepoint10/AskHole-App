"""
Test script for PromptGitManager

This script tests all Git operations without touching the production database.
It creates a temporary test repository and performs all operations.
"""

import os
import sys
import tempfile
import shutil
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from src.git_manager import PromptGitManager


def print_section(title):
    """Print a formatted section header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def test_initialization():
    """Test 1: Repository initialization."""
    print_section("TEST 1: Repository Initialization")

    try:
        # Create temporary directory
        temp_dir = Path(tempfile.mkdtemp(prefix="test_git_"))
        print(f"Creating test repository at: {temp_dir}")

        # Initialize Git manager
        git_manager = PromptGitManager(repo_path=str(temp_dir))

        # Verify repository exists
        assert git_manager.repo is not None, "Repository not initialized"
        assert git_manager.repo_path.exists(), "Repository path doesn't exist"
        assert git_manager.prompts_dir.exists(), "Prompts directory doesn't exist"

        print("✓ Repository initialized successfully")
        print(f"  Repo path: {git_manager.repo_path}")
        print(f"  Prompts dir: {git_manager.prompts_dir}")

        # Check initial commit
        commits = list(git_manager.repo.iter_commits())
        print(f"✓ Initial commit created: {commits[0].hexsha[:7]}")

        return git_manager, temp_dir

    except Exception as e:
        print(f"✗ Test failed: {e}")
        raise


def test_save_prompt(git_manager):
    """Test 2: Save prompt to Git."""
    print_section("TEST 2: Save Prompt")

    try:
        # Test data
        prompt_id = 1
        content = "# Test Prompt\n\nThis is a test prompt for Git versioning."
        commit_message = "Initial commit for test prompt"
        author_name = "Test User"

        print(f"Saving prompt #{prompt_id}...")

        # Save prompt
        commit_hash = git_manager.save_prompt(
            prompt_id=prompt_id,
            content=content,
            commit_message=commit_message,
            author_name=author_name
        )

        print(f"✓ Prompt saved successfully")
        print(f"  Commit hash: {commit_hash}")
        print(f"  Short hash: {commit_hash[:7]}")

        # Verify file exists
        file_path = git_manager._get_prompt_file_path(prompt_id)
        assert file_path.exists(), "Prompt file not created"
        print(f"✓ File created: {file_path}")

        # Verify content
        saved_content = file_path.read_text()
        assert saved_content == content, "Content mismatch"
        print(f"✓ Content verified")

        return commit_hash

    except Exception as e:
        print(f"✗ Test failed: {e}")
        raise


def test_get_prompt_content(git_manager, commit_hash):
    """Test 3: Read prompt content."""
    print_section("TEST 3: Get Prompt Content")

    try:
        prompt_id = 1

        # Read current content
        print(f"Reading prompt #{prompt_id} (current version)...")
        content = git_manager.get_prompt_content(prompt_id)
        print(f"✓ Content retrieved:")
        print(f"  Length: {len(content)} characters")
        print(f"  Preview: {content[:50]}...")

        # Read from specific commit
        print(f"\nReading prompt #{prompt_id} from commit {commit_hash[:7]}...")
        content_from_commit = git_manager.get_prompt_content(prompt_id, commit_hash)
        assert content == content_from_commit, "Content mismatch between HEAD and commit"
        print(f"✓ Content from commit matches current content")

        return content

    except Exception as e:
        print(f"✗ Test failed: {e}")
        raise


def test_update_prompt(git_manager):
    """Test 4: Update prompt (create new version)."""
    print_section("TEST 4: Update Prompt")

    try:
        prompt_id = 1
        updated_content = "# Test Prompt (Updated)\n\nThis prompt has been updated with new content.\n\nAdded a new paragraph!"
        commit_message = "Updated test prompt with more content"
        author_name = "Test User"

        print(f"Updating prompt #{prompt_id}...")

        # Save updated version
        commit_hash = git_manager.save_prompt(
            prompt_id=prompt_id,
            content=updated_content,
            commit_message=commit_message,
            author_name=author_name
        )

        print(f"✓ Prompt updated successfully")
        print(f"  New commit hash: {commit_hash[:7]}")

        # Verify updated content
        current_content = git_manager.get_prompt_content(prompt_id)
        assert current_content == updated_content, "Content not updated"
        print(f"✓ Content updated correctly")

        return commit_hash

    except Exception as e:
        print(f"✗ Test failed: {e}")
        raise


def test_version_history(git_manager):
    """Test 5: Get version history."""
    print_section("TEST 5: Get Version History")

    try:
        prompt_id = 1

        print(f"Getting version history for prompt #{prompt_id}...")
        history = git_manager.get_version_history(prompt_id)

        print(f"✓ Retrieved {len(history)} commits")

        for i, commit_info in enumerate(history, 1):
            print(f"\n  Commit {i}:")
            print(f"    Hash: {commit_info['commit_hash'][:7]}")
            print(f"    Author: {commit_info['author']}")
            print(f"    Date: {commit_info['date']}")
            print(f"    Message: {commit_info['message']}")

        # Should have at least 2 commits (initial + update)
        assert len(history) >= 2, "Expected at least 2 commits"
        print(f"\n✓ Version history verified")

        return history

    except Exception as e:
        print(f"✗ Test failed: {e}")
        raise


def test_diff(git_manager, history):
    """Test 6: Generate diff between versions."""
    print_section("TEST 6: Generate Diff")

    try:
        prompt_id = 1

        # Get commits (newest first, so reverse for from->to)
        if len(history) < 2:
            print("⚠ Skipping diff test (need at least 2 commits)")
            return

        from_commit = history[1]['commit_hash']  # Older commit
        to_commit = history[0]['commit_hash']    # Newer commit

        print(f"Generating diff from {from_commit[:7]} to {to_commit[:7]}...")

        diff = git_manager.get_diff(prompt_id, from_commit, to_commit)

        print(f"✓ Diff generated:")
        print("-" * 60)
        print(diff)
        print("-" * 60)

        # Verify diff contains expected markers
        assert "@@" in diff or "No differences" in diff, "Invalid diff format"
        print(f"✓ Diff format verified")

    except Exception as e:
        print(f"✗ Test failed: {e}")
        raise


def test_rollback(git_manager, history):
    """Test 7: Rollback to previous version."""
    print_section("TEST 7: Rollback Prompt")

    try:
        prompt_id = 1

        if len(history) < 2:
            print("⚠ Skipping rollback test (need at least 2 commits)")
            return

        # Rollback to first commit
        target_commit = history[-1]['commit_hash']  # Oldest commit
        commit_message = f"Rolled back to version {target_commit[:7]}"
        author_name = "Test User"

        print(f"Rolling back to commit {target_commit[:7]}...")

        # Get content before rollback
        content_before = git_manager.get_prompt_content(prompt_id)

        # Perform rollback
        new_commit_hash = git_manager.rollback_prompt(
            prompt_id=prompt_id,
            target_commit=target_commit,
            commit_message=commit_message,
            author_name=author_name
        )

        print(f"✓ Rollback successful")
        print(f"  New commit hash: {new_commit_hash[:7]}")

        # Get content after rollback
        content_after = git_manager.get_prompt_content(prompt_id)

        # Get original content
        original_content = git_manager.get_prompt_content(prompt_id, target_commit)

        # Verify rollback worked
        assert content_after == original_content, "Rollback content mismatch"
        assert content_after != content_before, "Content didn't change"
        print(f"✓ Content rolled back correctly")

        # Verify history still intact
        new_history = git_manager.get_version_history(prompt_id)
        assert len(new_history) > len(history), "History should have new rollback commit"
        print(f"✓ History preserved (now {len(new_history)} commits)")

    except Exception as e:
        print(f"✗ Test failed: {e}")
        raise


def test_delete_prompt(git_manager):
    """Test 8: Delete prompt file."""
    print_section("TEST 8: Delete Prompt")

    try:
        prompt_id = 1
        commit_message = "Deleted test prompt"
        author_name = "Test User"

        print(f"Deleting prompt #{prompt_id}...")

        # Delete prompt
        commit_hash = git_manager.delete_prompt_file(
            prompt_id=prompt_id,
            commit_message=commit_message,
            author_name=author_name
        )

        print(f"✓ Prompt deleted successfully")
        print(f"  Commit hash: {commit_hash[:7]}")

        # Verify file is gone
        file_path = git_manager._get_prompt_file_path(prompt_id)
        assert not file_path.exists(), "File still exists after deletion"
        print(f"✓ File removed from filesystem")

        # Verify can still read from history
        history = git_manager.get_version_history(prompt_id)
        if history:
            # Get content from last commit before deletion
            old_commit = history[1]['commit_hash'] if len(history) > 1 else history[0]['commit_hash']
            try:
                old_content = git_manager.get_prompt_content(prompt_id, old_commit)
                print(f"✓ Can still access content from history")
                print(f"  Content length: {len(old_content)} characters")
            except:
                pass

    except Exception as e:
        print(f"✗ Test failed: {e}")
        raise


def test_multiple_prompts(git_manager):
    """Test 9: Handle multiple prompts."""
    print_section("TEST 9: Multiple Prompts")

    try:
        print("Creating multiple test prompts...")

        # Create 5 test prompts
        for i in range(1, 6):
            content = f"# Test Prompt #{i}\n\nContent for prompt number {i}."
            commit_hash = git_manager.save_prompt(
                prompt_id=i,
                content=content,
                commit_message=f"Created test prompt #{i}",
                author_name="Test User"
            )
            print(f"  ✓ Created prompt #{i} ({commit_hash[:7]})")

        # Verify all files exist
        for i in range(1, 6):
            file_path = git_manager._get_prompt_file_path(i)
            assert file_path.exists(), f"Prompt #{i} file not found"

        print(f"✓ All 5 prompts created successfully")

        # Check repository stats
        total_commits = len(list(git_manager.repo.iter_commits()))
        print(f"✓ Total commits in repository: {total_commits}")

    except Exception as e:
        print(f"✗ Test failed: {e}")
        raise


def cleanup(temp_dir):
    """Clean up test repository."""
    print_section("Cleanup")

    try:
        print(f"Removing test repository at: {temp_dir}")
        shutil.rmtree(temp_dir)
        print("✓ Test repository removed")
    except Exception as e:
        print(f"⚠ Failed to clean up: {e}")


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("  GIT MANAGER TEST SUITE")
    print("=" * 60)
    print("\nThis will test all Git operations in a temporary repository.")
    print("No production data will be affected.\n")

    temp_dir = None

    try:
        # Test 1: Initialization
        git_manager, temp_dir = test_initialization()

        # Test 2: Save prompt
        initial_commit = test_save_prompt(git_manager)

        # Test 3: Read content
        test_get_prompt_content(git_manager, initial_commit)

        # Test 4: Update prompt
        test_update_prompt(git_manager)

        # Test 5: Version history
        history = test_version_history(git_manager)

        # Test 6: Diff
        test_diff(git_manager, history)

        # Test 7: Rollback
        test_rollback(git_manager, history)

        # Test 8: Delete prompt
        test_delete_prompt(git_manager)

        # Test 9: Multiple prompts
        test_multiple_prompts(git_manager)

        # Success summary
        print_section("TEST RESULTS")
        print("✓ ALL TESTS PASSED!")
        print("\nThe git_manager.py is working correctly.")
        print("You can now proceed with the migration.")

        return 0

    except Exception as e:
        print_section("TEST RESULTS")
        print(f"✗ TESTS FAILED: {e}")
        print("\nPlease fix the issues before running the migration.")
        return 1

    finally:
        # Cleanup
        if temp_dir and Path(temp_dir).exists():
            cleanup(temp_dir)


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
