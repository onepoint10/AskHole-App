"""
Telegram Bot for AskHole - Account Linking and Password Recovery

This bot listens for messages from users and processes:
1. Account linking with 6-digit codes
2. Password recovery notifications

The bot integrates with the Flask backend API to complete user operations.
"""

import os
import re
import logging
import requests
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters
)

# Load environment variables from backend/.env
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Configuration from environment variables
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
TELEGRAM_BOT_USERNAME = os.environ.get('TELEGRAM_BOT_USERNAME', 'AskHoleRecoveryBot')
TELEGRAM_WEBHOOK_SECRET = os.environ.get('TELEGRAM_WEBHOOK_SECRET', 'change-me-in-production')
BACKEND_URL = os.environ.get('BACKEND_URL', 'http://localhost:5000')

# Regex pattern for 6-digit verification codes
CODE_PATTERN = re.compile(r'^\d{6}$')


def validate_config():
    """
    Validate that all required environment variables are set.

    Raises:
        ValueError: If required configuration is missing
    """
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError(
            'TELEGRAM_BOT_TOKEN environment variable is not set. '
            'Please configure it in backend/.env file.'
        )

    logger.info(f'Bot configured: @{TELEGRAM_BOT_USERNAME}')
    logger.info(f'Backend URL: {BACKEND_URL}')


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle the /start command - send welcome message with instructions.

    Args:
        update: The update object from Telegram
        context: The context object with bot and user data
    """
    user = update.effective_user
    welcome_message = f"""
👋 Welcome to AskHole Recovery Bot, {user.first_name}!

I can help you with:

🔗 **Account Linking**
Send me the 6-digit code from your AskHole account settings to link your Telegram account.

🔐 **Password Recovery**
Once linked, you'll receive password reset notifications directly via Telegram.

📝 **How to Link Your Account**:
1. Log in to your AskHole account
2. Go to Settings → Security → Telegram Linking
3. Click "Generate Linking Code"
4. Send the 6-digit code to me

That's it! Your Telegram account will be linked securely.

Need help? Use /help for more information.
    """.strip()

    await update.message.reply_text(welcome_message)
    logger.info(f'User {user.id} ({user.username}) started the bot')


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle the /help command - send usage instructions.

    Args:
        update: The update object from Telegram
        context: The context object with bot and user data
    """
    help_message = """
🆘 **AskHole Recovery Bot Help**

**Commands:**
• /start - Show welcome message
• /help - Show this help message

**Account Linking:**
To link your Telegram account with AskHole:

1. Open AskHole in your browser
2. Navigate to Settings → Security
3. Click "Generate Linking Code"
4. Copy the 6-digit code
5. Send the code to this bot
6. Wait for confirmation

**Verification Code Format:**
• Must be exactly 6 digits (e.g., 123456)
• Case-sensitive
• Valid for 10 minutes
• Can only be used once

**Password Recovery:**
Once your account is linked, you'll receive password reset links directly via Telegram. No need to check email!

**Security:**
• Never share your verification codes with anyone
• Each code expires after 10 minutes
• Codes can only be used once
• Your Telegram account can only be linked to one AskHole account

**Troubleshooting:**
• "Code has expired" - Generate a new code in AskHole settings
• "Invalid code" - Make sure you copied the code correctly
• "Already linked" - This Telegram account is already linked to another user

Need more help? Contact AskHole support.
    """.strip()

    await update.message.reply_text(help_message)
    logger.info(f'User {update.effective_user.id} requested help')


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle incoming text messages - check for 6-digit verification codes.

    This function:
    1. Validates the message format (6 digits)
    2. Calls the Flask backend API to complete linking
    3. Sends appropriate response to the user

    Args:
        update: The update object from Telegram
        context: The context object with bot and user data
    """
    message_text = update.message.text.strip()
    user = update.effective_user
    chat_id = update.effective_chat.id

    logger.info(f'Received message from {user.id} ({user.username}): {message_text}')

    # Check if message is a 6-digit code
    if not CODE_PATTERN.match(message_text):
        # Not a code - provide helpful feedback
        await update.message.reply_text(
            "❓ I didn't recognize that command.\n\n"
            "To link your Telegram account, send me the 6-digit code from AskHole.\n\n"
            "Use /help for more information."
        )
        return

    # Valid code format - attempt to link account
    await update.message.reply_text(
        "🔄 Processing your verification code...\n"
        "Please wait a moment."
    )

    try:
        # Call Flask backend API to complete linking
        success, response_data, error_message = await link_telegram_account(
            code=message_text,
            telegram_chat_id=str(chat_id)
        )

        if success:
            # Linking successful
            user_info = response_data.get('user', {})
            username = user_info.get('username', 'User')

            success_message = f"""
✅ **Account Linked Successfully!**

Your Telegram account has been linked to AskHole user: **{username}**

🎉 You're all set! You will now receive:
• Password reset notifications
• Security alerts
• Account recovery links

Your account is now more secure with Telegram integration.

Thank you for using AskHole! 🚀
            """.strip()

            await update.message.reply_text(success_message)
            logger.info(f'Successfully linked Telegram user {chat_id} to AskHole user {username}')

        else:
            # Linking failed - show error to user
            error_emoji = "❌"

            # Provide user-friendly error messages
            if "expired" in error_message.lower():
                error_emoji = "⏰"
                user_message = (
                    f"{error_emoji} **Code Expired**\n\n"
                    "Your verification code has expired (codes are valid for 10 minutes).\n\n"
                    "Please generate a new code in AskHole Settings → Security → Telegram Linking."
                )
            elif "already used" in error_message.lower() or "invalid" in error_message.lower():
                user_message = (
                    f"{error_emoji} **Invalid Code**\n\n"
                    "This code is invalid or has already been used.\n\n"
                    "Please generate a new code in AskHole Settings → Security → Telegram Linking."
                )
            elif "already linked" in error_message.lower():
                error_emoji = "⚠️"
                user_message = (
                    f"{error_emoji} **Account Already Linked**\n\n"
                    "This Telegram account is already linked to another AskHole user.\n\n"
                    "Each Telegram account can only be linked to one AskHole account. "
                    "If you need to unlink, please do so in AskHole Settings first."
                )
            elif "not found" in error_message.lower():
                user_message = (
                    f"{error_emoji} **User Not Found**\n\n"
                    "The user associated with this code could not be found.\n\n"
                    "Please try generating a new code or contact support if this issue persists."
                )
            else:
                # Generic error message
                user_message = (
                    f"{error_emoji} **Linking Failed**\n\n"
                    f"{error_message}\n\n"
                    "Please try again or contact support if the issue persists."
                )

            await update.message.reply_text(user_message)
            logger.warning(f'Failed to link account for user {chat_id}: {error_message}')

    except Exception as e:
        # Unexpected error
        logger.error(f'Error processing code for user {chat_id}: {str(e)}', exc_info=True)
        await update.message.reply_text(
            "❌ **An unexpected error occurred**\n\n"
            "We couldn't process your verification code. Please try again later.\n\n"
            "If this issue persists, please contact AskHole support."
        )


async def link_telegram_account(code: str, telegram_chat_id: str) -> tuple:
    """
    Call the Flask backend API to complete Telegram account linking.

    Args:
        code: The 6-digit verification code
        telegram_chat_id: The user's Telegram chat ID

    Returns:
        tuple: (success: bool, response_data: dict, error_message: str)
    """
    api_url = f'{BACKEND_URL}/api/auth/link_telegram/complete'

    payload = {
        'code': code,
        'telegram_chat_id': telegram_chat_id,
        'secret_key': TELEGRAM_WEBHOOK_SECRET
    }

    try:
        # Make POST request to backend
        logger.info(f'Calling API: {api_url}')
        logger.debug(f'Payload: {payload}')

        response = requests.post(
            api_url,
            json=payload,
            timeout=10  # 10 second timeout
        )

        logger.info(f'Response status: {response.status_code}')
        logger.debug(f'Response content: {response.text[:200]}')  # Log first 200 chars

        # Try to parse JSON response
        try:
            response_data = response.json()
        except ValueError as json_err:
            # Response isn't valid JSON
            logger.error(f'Invalid JSON response from backend: {response.text[:500]}')
            error_message = (
                f'Backend returned invalid response (status {response.status_code}). '
                f'Expected JSON but got: {response.text[:100]}'
            )
            return False, None, error_message

        if response.status_code == 200:
            # Success
            return True, response_data, None
        else:
            # API returned error
            error_message = response_data.get('error', 'Unknown error occurred')
            return False, None, error_message

    except requests.exceptions.Timeout:
        error_message = 'Request timed out. The backend server may be down or slow.'
        logger.error(error_message)
        return False, None, error_message

    except requests.exceptions.ConnectionError as e:
        error_message = f'Could not connect to AskHole backend at {BACKEND_URL}. Please ensure the server is running.'
        logger.error(f'{error_message} Error: {str(e)}')
        return False, None, error_message

    except requests.exceptions.RequestException as e:
        error_message = f'Network error: {str(e)}'
        logger.error(f'Request failed: {error_message}')
        return False, None, error_message

    except Exception as e:
        error_message = f'Unexpected error: {str(e)}'
        logger.error(f'Unexpected error in link_telegram_account: {error_message}', exc_info=True)
        return False, None, error_message


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Handle errors that occur during bot operation.

    Args:
        update: The update object that caused the error (may be None)
        context: The context object containing the error
    """
    logger.error(f'Update {update} caused error: {context.error}', exc_info=context.error)

    # If we have an update with a message, notify the user
    if update and hasattr(update, 'message') and update.message:
        try:
            await update.message.reply_text(
                "⚠️ An error occurred while processing your request.\n"
                "Please try again later or contact support if the issue persists."
            )
        except Exception as e:
            logger.error(f'Failed to send error message to user: {str(e)}')


def main() -> None:
    """
    Main function to start the Telegram bot.

    This function:
    1. Validates configuration
    2. Creates the Application
    3. Registers handlers
    4. Starts polling for updates
    """
    try:
        # Validate configuration
        validate_config()

        # Create the Application
        logger.info('Building Telegram bot application...')
        application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

        # Register command handlers
        application.add_handler(CommandHandler('start', start_command))
        application.add_handler(CommandHandler('help', help_command))

        # Register message handler for text messages (excluding commands)
        application.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
        )

        # Register error handler
        application.add_error_handler(error_handler)

        # Start the bot
        logger.info('🤖 Starting Telegram bot...')
        logger.info(f'Bot username: @{TELEGRAM_BOT_USERNAME}')
        logger.info('Bot is running. Press Ctrl+C to stop.')

        # Run the bot until interrupted
        application.run_polling(allowed_updates=Update.ALL_TYPES)

    except ValueError as e:
        logger.error(f'Configuration error: {str(e)}')
        print(f'\n❌ Configuration Error: {str(e)}')
        print('\nPlease check your backend/.env file and ensure TELEGRAM_BOT_TOKEN is set.')
        exit(1)

    except KeyboardInterrupt:
        logger.info('Bot stopped by user (Ctrl+C)')
        print('\n👋 Bot stopped gracefully.')

    except Exception as e:
        logger.error(f'Fatal error: {str(e)}', exc_info=True)
        print(f'\n❌ Fatal Error: {str(e)}')
        exit(1)


if __name__ == '__main__':
    print('╔════════════════════════════════════════╗')
    print('║   AskHole Telegram Recovery Bot       ║')
    print('║   Account Linking & Password Recovery  ║')
    print('╚════════════════════════════════════════╝')
    print()
    main()
