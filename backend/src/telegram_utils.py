"""
Telegram Bot API utilities for sending messages.
"""
import requests
import os
import logging

logger = logging.getLogger(__name__)


def get_telegram_bot_token():
    """
    Get Telegram Bot Token from environment variable.

    Returns:
        str: Telegram Bot Token or None if not configured
    """
    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not token:
        logger.warning('TELEGRAM_BOT_TOKEN environment variable not set')
    return token


def send_telegram_message(chat_id, message, parse_mode='HTML'):
    """
    Send a message to a Telegram user using the Telegram Bot API.

    Args:
        chat_id (str|int): Telegram chat ID of the recipient
        message (str): Message text to send
        parse_mode (str): Message formatting mode ('HTML', 'Markdown', or None)

    Returns:
        tuple: (success: bool, response: dict|None, error: str|None)

    Example:
        success, response, error = send_telegram_message(
            chat_id='123456789',
            message='<b>Password Reset</b>\\n\\nClick here: https://example.com/reset'
        )
    """
    bot_token = get_telegram_bot_token()

    if not bot_token:
        error_msg = 'Telegram Bot Token not configured. Set TELEGRAM_BOT_TOKEN environment variable.'
        logger.error(error_msg)
        return False, None, error_msg

    # Telegram Bot API endpoint
    api_url = f'https://api.telegram.org/bot{bot_token}/sendMessage'

    # Prepare payload
    payload = {
        'chat_id': str(chat_id),
        'text': message
    }

    if parse_mode:
        payload['parse_mode'] = parse_mode

    try:
        # Send POST request to Telegram API
        response = requests.post(
            api_url,
            json=payload,
            timeout=10  # 10 second timeout
        )

        # Check response status
        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                logger.info(f'Successfully sent Telegram message to chat_id: {chat_id}')
                return True, result, None
            else:
                error_msg = result.get('description', 'Unknown Telegram API error')
                logger.error(f'Telegram API error: {error_msg}')
                return False, result, error_msg
        else:
            error_msg = f'Telegram API returned status {response.status_code}: {response.text}'
            logger.error(error_msg)
            return False, None, error_msg

    except requests.exceptions.Timeout:
        error_msg = 'Telegram API request timed out'
        logger.error(error_msg)
        return False, None, error_msg
    except requests.exceptions.RequestException as e:
        error_msg = f'Failed to send Telegram message: {str(e)}'
        logger.error(error_msg)
        return False, None, error_msg
    except Exception as e:
        error_msg = f'Unexpected error sending Telegram message: {str(e)}'
        logger.error(error_msg)
        return False, None, error_msg


def format_password_reset_message(reset_url, username):
    """
    Format a password reset message with HTML formatting.

    Args:
        reset_url (str): The password reset URL with token
        username (str): User's username

    Returns:
        str: Formatted HTML message
    """
    message = f"""
<b>🔐 Password Reset Request</b>

Hello <b>{username}</b>!

You have requested to reset your password. Click the link below to continue:

{reset_url}

⏰ This link will expire in <b>30 minutes</b>.

If you did not request this password reset, please ignore this message.

---
<i>AskHole Security Team</i>
    """.strip()

    return message


def format_telegram_link_instructions(code):
    """
    Format instructions for linking Telegram account.

    Args:
        code (str): The 6-digit linking code

    Returns:
        str: Formatted HTML message
    """
    message = f"""
<b>🔗 Link Your Telegram Account</b>

Your verification code is:

<code>{code}</code>

⏰ This code will expire in <b>10 minutes</b>.

To complete the linking process, send this code to the AskHole bot.

---
<i>AskHole Security Team</i>
    """.strip()

    return message
