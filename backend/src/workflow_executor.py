"""
Workflow Executor for Sequential Prompt Execution (DFG)

This module provides the engine for executing prompt sequences
in workflow spaces, chaining outputs from one prompt as inputs to the next.
"""

import time
import logging
from typing import List, Dict, Optional, Any
from src.models.workflow_space import WorkflowSpace
from src.models.chat import PromptTemplate
from src.git_manager import PromptGitManager
from src.gemini_client import GeminiClient
from src.openrouter_client import OpenRouterClient
from src.custom_client import CustomClient

logger = logging.getLogger(__name__)


class WorkflowExecutor:
    """
    Executes prompt sequences with output chaining.

    This class handles the execution of Data Flow Graph (DFG) workflows,
    where prompts are executed sequentially and the output of one prompt
    becomes the input for the next.
    """

    def __init__(
        self,
        workflow_space: WorkflowSpace,
        gemini_client: Optional[GeminiClient] = None,
        openrouter_client: Optional[OpenRouterClient] = None,
        custom_clients: Optional[Dict[str, CustomClient]] = None,
        git_manager: Optional[PromptGitManager] = None
    ):
        """
        Initialize the workflow executor.

        Args:
            workflow_space: The WorkflowSpace object containing prompt sequence
            gemini_client: Initialized Gemini client (if using Gemini models)
            openrouter_client: Initialized OpenRouter client (if using OpenRouter)
            custom_clients: Dictionary of custom clients by provider name
            git_manager: Git manager for fetching prompt content
        """
        self.workspace = workflow_space
        self.gemini_client = gemini_client
        self.openrouter_client = openrouter_client
        self.custom_clients = custom_clients or {}
        self.git_manager = git_manager
        self.results: List[Dict[str, Any]] = []

    def execute(
        self,
        initial_input: str = "",
        model: str = "gemini-2.5-flash",
        temperature: float = 1.0,
        stop_on_error: bool = True,
        progress_callback: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Execute the prompt sequence.

        Args:
            initial_input: Optional initial input for the first prompt
            model: AI model to use for all prompts (e.g., "gemini-2.5-flash")
            temperature: Temperature setting for AI generation (0.0 to 2.0)
            stop_on_error: Whether to stop execution if a step fails
            progress_callback: Optional callback function that receives progress events.
                              Called with (event_type, step_number, data) where:
                              - event_type: 'start', 'complete', or 'error'
                              - step_number: current step index (1-based)
                              - data: dict with relevant event data

        Returns:
            Dictionary containing:
                - success: Overall success status (bool)
                - results: List of results for each step
                - final_output: Output from the last successful step
                - total_time: Total execution time in seconds
        """
        start_time = time.time()
        self.results = []

        try:
            # Get prompt sequence from workspace
            prompt_sequence = self.workspace.get_prompt_sequence_details()

            if not prompt_sequence:
                return {
                    'success': False,
                    'error': 'No prompts in sequence',
                    'results': [],
                    'final_output': '',
                    'total_time': 0
                }

            logger.info(f"Starting workflow execution for workspace {self.workspace.id} "
                       f"with {len(prompt_sequence)} prompts, model={model}")

            # Track the current input (starts with initial_input, then becomes previous output)
            current_input = initial_input

            # Execute each prompt in sequence
            for step_number, prompt_info in enumerate(prompt_sequence, start=1):
                step_start_time = time.time()

                # Emit 'start' event
                if progress_callback:
                    progress_callback('start', step_number, {
                        'prompt_id': prompt_info['id'],
                        'prompt_title': prompt_info['title'],
                        'total_steps': len(prompt_sequence)
                    })

                try:
                    # Fetch prompt content from Git if available
                    prompt_content = self._get_prompt_content(prompt_info['id'])

                    if not prompt_content:
                        error_msg = f"Prompt {prompt_info['id']} content not found"
                        logger.error(error_msg)
                        self._add_error_result(
                            step_number,
                            prompt_info,
                            current_input,
                            error_msg,
                            time.time() - step_start_time
                        )

                        # Emit 'error' event
                        if progress_callback:
                            progress_callback('error', step_number, {
                                'prompt_id': prompt_info['id'],
                                'prompt_title': prompt_info['title'],
                                'error': error_msg,
                                'execution_time': time.time() - step_start_time
                            })

                        if stop_on_error:
                            break
                        continue

                    # Format prompt with current input
                    formatted_prompt = self._format_prompt_with_input(prompt_content, current_input)

                    logger.debug(f"Step {step_number}: Executing prompt {prompt_info['id']} "
                               f"({prompt_info['title']})")

                    # Execute the prompt
                    output = self._execute_single_prompt(
                        formatted_prompt,
                        model,
                        temperature
                    )

                    execution_time = time.time() - step_start_time

                    # Store successful result
                    result = {
                        'step': step_number,
                        'prompt_id': prompt_info['id'],
                        'prompt_title': prompt_info['title'],
                        'input': current_input if current_input else '(no input)',
                        'output': output,
                        'execution_time': execution_time,
                        'error': None
                    }
                    self.results.append(result)

                    # Emit 'complete' event
                    if progress_callback:
                        progress_callback('complete', step_number, result)

                    # Update current_input for next iteration
                    current_input = output

                    logger.info(f"Step {step_number} completed successfully in {execution_time:.2f}s")

                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Step {step_number} failed: {error_msg}", exc_info=True)

                    execution_time = time.time() - step_start_time
                    self._add_error_result(
                        step_number,
                        prompt_info,
                        current_input,
                        error_msg,
                        execution_time
                    )

                    # Emit 'error' event
                    if progress_callback:
                        progress_callback('error', step_number, {
                            'prompt_id': prompt_info['id'],
                            'prompt_title': prompt_info['title'],
                            'error': error_msg,
                            'execution_time': execution_time
                        })

                    if stop_on_error:
                        logger.info("Stopping execution due to error (stop_on_error=True)")
                        break
                    # Otherwise, continue to next prompt

            # Calculate final results
            total_time = time.time() - start_time
            successful_results = [r for r in self.results if r['error'] is None]
            final_output = successful_results[-1]['output'] if successful_results else ''
            overall_success = len(successful_results) == len(prompt_sequence)

            logger.info(f"Workflow execution completed. Success: {overall_success}, "
                       f"Completed: {len(successful_results)}/{len(prompt_sequence)}, "
                       f"Total time: {total_time:.2f}s")

            return {
                'success': overall_success,
                'results': self.results,
                'final_output': final_output,
                'total_time': total_time,
                'completed_steps': len(successful_results),
                'total_steps': len(prompt_sequence)
            }

        except Exception as e:
            logger.error(f"Workflow execution failed with unexpected error: {e}", exc_info=True)
            total_time = time.time() - start_time
            return {
                'success': False,
                'error': str(e),
                'results': self.results,
                'final_output': '',
                'total_time': total_time
            }

    def _get_prompt_content(self, prompt_id: int) -> Optional[str]:
        """
        Get prompt content from Git or database.

        Args:
            prompt_id: ID of the prompt

        Returns:
            Prompt content string, or None if not found
        """
        try:
            # Try to get from Git first (if Git manager is available)
            if self.git_manager:
                try:
                    content = self.git_manager.get_prompt_content(prompt_id)
                    if content:
                        return content
                except Exception as git_error:
                    logger.warning(f"Failed to get prompt {prompt_id} from Git: {git_error}")

            # Fallback to database
            prompt = PromptTemplate.query.get(prompt_id)
            if prompt and prompt.content:
                return prompt.content

            logger.error(f"Prompt {prompt_id} content not found in Git or database")
            return None

        except Exception as e:
            logger.error(f"Error getting prompt content for {prompt_id}: {e}")
            return None

    def _format_prompt_with_input(self, prompt_content: str, input_text: str) -> str:
        """
        Replace placeholder variables in prompt with input text.

        Supports the following placeholders:
        - {{input}}: Replaced with the input_text
        - {{previous_output}}: Alias for {{input}}

        If no placeholders are found and input_text is not empty,
        the input will be prepended to the prompt with a separator.

        Args:
            prompt_content: The prompt template content
            input_text: The text to insert into placeholders

        Returns:
            Formatted prompt with placeholders replaced or input prepended
        """
        # If no input text, return prompt as-is
        if not input_text or not input_text.strip():
            return prompt_content

        formatted = prompt_content

        # Check if prompt contains any placeholders
        has_placeholder = (
            '{{input}}' in formatted or
            '{{INPUT}}' in formatted or
            '{{previous_output}}' in formatted or
            '{{PREVIOUS_OUTPUT}}' in formatted
        )

        if has_placeholder:
            # Replace common placeholders
            formatted = formatted.replace('{{input}}', input_text)
            formatted = formatted.replace('{{previous_output}}', input_text)

            # Case-insensitive versions
            formatted = formatted.replace('{{INPUT}}', input_text)
            formatted = formatted.replace('{{PREVIOUS_OUTPUT}}', input_text)
        else:
            # No placeholders found - prepend the previous output with clear separation
            formatted = f"""Previous output:
---
{input_text}
---

Current task:
{prompt_content}"""

        return formatted

    def _execute_single_prompt(
        self,
        prompt_content: str,
        model: str,
        temperature: float
    ) -> str:
        """
        Execute a single prompt with the specified model.

        Args:
            prompt_content: The formatted prompt content
            model: Model name/identifier
            temperature: Temperature setting

        Returns:
            Generated output text

        Raises:
            Exception: If execution fails or no appropriate client is available
        """
        # Determine which client to use based on model
        client_type = self._determine_client_type(model)

        if client_type == 'gemini':
            if not self.gemini_client:
                raise Exception("Gemini client not available. Please configure API key.")
            return self._execute_with_gemini(prompt_content, model, temperature)

        elif client_type == 'openrouter':
            if not self.openrouter_client:
                raise Exception("OpenRouter client not available. Please configure API key.")
            return self._execute_with_openrouter(prompt_content, model, temperature)

        elif client_type == 'custom':
            # Find the appropriate custom client
            for provider_name, client in self.custom_clients.items():
                try:
                    if model in client.get_available_models():
                        return self._execute_with_custom(client, prompt_content, model, temperature)
                except Exception as e:
                    logger.debug(f"Model {model} not found in provider {provider_name}: {e}")
                    continue

            raise Exception(f"No custom client found for model {model}")

        else:
            raise Exception(f"Unknown client type for model {model}")

    def _determine_client_type(self, model: str) -> str:
        """
        Determine which client type to use based on model name.

        Args:
            model: Model name/identifier

        Returns:
            Client type: 'gemini', 'openrouter', or 'custom'
        """
        # Check if it's a Gemini model
        gemini_models = [
            'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite-preview-09-25',
            'gemini-2.5-flash-preview-09-2025', 'gemini-2.5-flash-lite',
            'gemini-embedding-001', 'gemini-2.0-flash'
        ]

        if any(model.startswith(gm.split('-')[0] + '-') or model == gm for gm in gemini_models):
            return 'gemini'

        # Check if it's in custom clients
        for client in self.custom_clients.values():
            try:
                if model in client.get_available_models():
                    return 'custom'
            except Exception:
                continue

        # Default to OpenRouter
        return 'openrouter'

    def _execute_with_gemini(self, prompt: str, model: str, temperature: float) -> str:
        """Execute prompt with Gemini client."""
        try:
            # Use generate_text for stateless prompt execution
            response = self.gemini_client.generate_text(
                prompt=prompt,
                model=model,
                temperature=temperature
            )
            return response
        except Exception as e:
            logger.error(f"Gemini execution failed: {e}")
            raise Exception(f"Gemini API error: {str(e)}")

    def _execute_with_openrouter(self, prompt: str, model: str, temperature: float) -> str:
        """Execute prompt with OpenRouter client."""
        try:
            # Use generate_text for stateless prompt execution
            response = self.openrouter_client.generate_text(
                prompt=prompt,
                model=model,
                temperature=temperature
            )
            return response
        except Exception as e:
            logger.error(f"OpenRouter execution failed: {e}")
            raise Exception(f"OpenRouter API error: {str(e)}")

    def _execute_with_custom(
        self,
        client: CustomClient,
        prompt: str,
        model: str,
        temperature: float
    ) -> str:
        """Execute prompt with custom client."""
        try:
            # CustomClient uses send_message which returns a dict with 'response' key
            result = client.send_message(
                session_id='workflow_temp',  # Temporary session for workflow
                message=prompt,
                model=model,
                temperature=temperature
            )
            # Extract the response text from the result dict
            if isinstance(result, dict) and 'response' in result:
                return result['response']
            else:
                return str(result)
        except Exception as e:
            logger.error(f"Custom client execution failed: {e}")
            raise Exception(f"Custom API error: {str(e)}")

    def _add_error_result(
        self,
        step_number: int,
        prompt_info: Dict[str, Any],
        input_text: str,
        error_message: str,
        execution_time: float
    ):
        """Add an error result to the results list."""
        self.results.append({
            'step': step_number,
            'prompt_id': prompt_info['id'],
            'prompt_title': prompt_info['title'],
            'input': input_text if input_text else '(no input)',
            'output': None,
            'execution_time': execution_time,
            'error': error_message
        })
