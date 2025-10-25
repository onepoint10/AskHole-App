"""
Test script to verify the retry logic in Gemini client
This simulates 503 errors to test the retry mechanism
"""

import time
from unittest.mock import Mock, patch
from google.api_core.exceptions import ServiceUnavailable
from src.gemini_client import GeminiClient


def test_retry_with_503_error():
    """Test that the retry decorator works with 503 errors"""
    print("\n" + "="*70)
    print("TEST: Simulating 503 errors with retry logic")
    print("="*70)

    # Create a mock that will fail 3 times with 503, then succeed
    call_count = 0

    def mock_api_call(*args, **kwargs):
        nonlocal call_count
        call_count += 1

        if call_count <= 3:
            # Simulate 503 error
            print(f"\n[MOCK] API call #{call_count} - Raising 503 ServiceUnavailable")
            error = ServiceUnavailable("The model is overloaded. Please try again later.")
            error.code = 503
            raise error
        else:
            # Success on 4th attempt
            print(f"\n[MOCK] API call #{call_count} - SUCCESS!")
            return "Test response from Gemini"

    # Test the retry logic
    start_time = time.time()

    try:
        # Use the decorator directly
        from src.gemini_client import GeminiClient
        decorated_func = GeminiClient.retry_on_google_api_error()(mock_api_call)

        result = decorated_func()
        elapsed = time.time() - start_time

        print(f"\n{'='*70}")
        print(f"SUCCESS: Function completed after {call_count} attempts")
        print(f"Total time: {elapsed:.1f} seconds")
        print(f"Result: {result}")
        print(f"{'='*70}\n")

        # Verify timing (should be approximately 3 retries * 15 seconds = ~45 seconds)
        expected_min_time = 3 * 15  # 3 retries, 15 seconds each
        expected_max_time = 3 * 16 + 5  # Account for jitter and processing

        if expected_min_time <= elapsed <= expected_max_time:
            print(f"✅ Timing verification PASSED: {elapsed:.1f}s within expected range ({expected_min_time}-{expected_max_time}s)")
        else:
            print(f"⚠️  Timing verification WARNING: {elapsed:.1f}s outside expected range ({expected_min_time}-{expected_max_time}s)")

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        raise


def test_retry_exhaustion():
    """Test that the retry decorator fails after max attempts"""
    print("\n" + "="*70)
    print("TEST: Verifying retry exhaustion after max attempts")
    print("="*70)

    call_count = 0

    def mock_failing_api_call(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        print(f"\n[MOCK] API call #{call_count} - Raising 503 ServiceUnavailable")
        error = ServiceUnavailable("The model is overloaded. Please try again later.")
        error.code = 503
        raise error

    start_time = time.time()

    try:
        from src.gemini_client import GeminiClient
        decorated_func = GeminiClient.retry_on_google_api_error()(mock_failing_api_call)

        result = decorated_func()
        print(f"\n❌ TEST FAILED: Should have raised exception after 5 attempts\n")

    except Exception as e:
        elapsed = time.time() - start_time

        print(f"\n{'='*70}")
        print(f"Expected behavior: Exception raised after exhausting retries")
        print(f"Total attempts: {call_count}")
        print(f"Total time: {elapsed:.1f} seconds")
        print(f"Error message: {e}")
        print(f"{'='*70}\n")

        if call_count == 5:
            print(f"✅ Retry count verification PASSED: Made exactly 5 attempts")
        else:
            print(f"❌ Retry count verification FAILED: Expected 5 attempts, got {call_count}")

        # Verify timing (should be approximately 4 retries * 15 seconds = ~60 seconds)
        # Note: 5 attempts = 1 initial + 4 retries
        expected_min_time = 4 * 15  # 4 retries, 15 seconds each
        expected_max_time = 4 * 16 + 5  # Account for jitter and processing

        if expected_min_time <= elapsed <= expected_max_time:
            print(f"✅ Timing verification PASSED: {elapsed:.1f}s within expected range ({expected_min_time}-{expected_max_time}s)")
        else:
            print(f"⚠️  Timing verification WARNING: {elapsed:.1f}s outside expected range ({expected_min_time}-{expected_max_time}s)")

        if "failed after 5 retries" in str(e).lower() or "retry attempts exhausted" in str(e).lower():
            print(f"✅ Error message verification PASSED: Contains retry information")
        else:
            print(f"⚠️  Error message verification WARNING: Message should mention retry exhaustion")


def test_immediate_success():
    """Test that successful calls don't trigger retries"""
    print("\n" + "="*70)
    print("TEST: Verifying no retries on immediate success")
    print("="*70)

    call_count = 0

    def mock_successful_api_call(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        print(f"\n[MOCK] API call #{call_count} - SUCCESS on first try!")
        return "Immediate success response"

    start_time = time.time()

    try:
        from src.gemini_client import GeminiClient
        decorated_func = GeminiClient.retry_on_google_api_error()(mock_successful_api_call)

        result = decorated_func()
        elapsed = time.time() - start_time

        print(f"\n{'='*70}")
        print(f"Total attempts: {call_count}")
        print(f"Total time: {elapsed:.1f} seconds")
        print(f"Result: {result}")
        print(f"{'='*70}\n")

        if call_count == 1:
            print(f"✅ Call count verification PASSED: Made exactly 1 attempt (no retries)")
        else:
            print(f"❌ Call count verification FAILED: Expected 1 attempt, got {call_count}")

        if elapsed < 5:
            print(f"✅ Timing verification PASSED: Completed quickly ({elapsed:.1f}s)")
        else:
            print(f"❌ Timing verification FAILED: Took too long ({elapsed:.1f}s)")

    except Exception as e:
        print(f"\n❌ TEST FAILED: Should not raise exception on success: {e}\n")
        raise


if __name__ == "__main__":
    print("\n" + "="*70)
    print("GEMINI CLIENT RETRY LOGIC TEST SUITE")
    print("="*70)
    print("\nThis test suite verifies the 503 retry mechanism:")
    print("- Fixed 15-second intervals between retries")
    print("- Maximum 5 retry attempts")
    print("- Transparent operation (automatic retries)")
    print("- Proper error reporting after exhaustion")
    print("\n" + "="*70)

    try:
        # Test 1: Retry with eventual success
        test_immediate_success()

        # Test 2: Retry with eventual success after failures
        print("\n⚠️  NOTE: The next test will take ~45 seconds (3 retries × 15 seconds)")
        input("Press Enter to continue with retry success test...")
        test_retry_with_503_error()

        # Test 3: Retry exhaustion
        print("\n⚠️  NOTE: The next test will take ~60 seconds (4 retries × 15 seconds)")
        input("Press Enter to continue with retry exhaustion test...")
        test_retry_exhaustion()

        print("\n" + "="*70)
        print("ALL TESTS COMPLETED SUCCESSFULLY! ✅")
        print("="*70 + "\n")

    except Exception as e:
        print("\n" + "="*70)
        print(f"TEST SUITE FAILED: {e}")
        print("="*70 + "\n")
        import traceback
        traceback.print_exc()
