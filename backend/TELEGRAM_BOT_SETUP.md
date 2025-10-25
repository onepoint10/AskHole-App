# Telegram Bot Setup Guide

This guide explains how to set up and run the AskHole Telegram Recovery Bot for account linking and password recovery.

## Overview

The Telegram bot provides two main features:
1. **Account Linking**: Users can link their Telegram account to AskHole for password recovery
2. **Password Recovery**: Receive password reset links directly via Telegram (no email needed)

## Prerequisites

- Python 3.11+ with virtual environment activated
- Telegram account
- Telegram bot created via @BotFather
- Flask backend running on `http://localhost:5000`

## Step 1: Create Your Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow the prompts:
   - Choose a name (e.g., "AskHole Recovery Bot")
   - Choose a username (must end in 'bot', e.g., "askhole_recovery_bot")
4. **Save the bot token** - you'll need it for configuration
5. Optionally, set a description and profile picture

## Step 2: Configure Environment Variables

Edit `backend/.env` file with your bot credentials:

```bash
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz1234567890
TELEGRAM_BOT_USERNAME=your_bot_username
TELEGRAM_WEBHOOK_SECRET=your-secret-key-change-this
FRONTEND_URL=http://localhost:5173

# Flask Configuration (should already exist)
SECRET_KEY=your-secret-key-change-this-in-production
```

**Important**: Replace the placeholder values with your actual credentials:
- `TELEGRAM_BOT_TOKEN`: The token from @BotFather
- `TELEGRAM_BOT_USERNAME`: Your bot's username (without @)
- `TELEGRAM_WEBHOOK_SECRET`: A secure secret for API authentication
- `SECRET_KEY`: Your Flask application secret key

## Step 3: Install Dependencies

```bash
# Make sure you're in the project root
cd /Users/onepoint/ReactProjects/AskHole-App

# Activate virtual environment (IMPORTANT: .venv is at project root)
source .venv/bin/activate

# Install/update dependencies (including python-telegram-bot)
pip install -r backend/requirements.txt
```

## Step 4: Start the Backend Server

The bot requires the Flask backend to be running:

```bash
# In one terminal window
source .venv/bin/activate
python backend/src/main.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
```

## Step 5: Start the Telegram Bot

In a **separate terminal window**, run the bot:

```bash
# Navigate to project root
cd /Users/onepoint/ReactProjects/AskHole-App

# Activate virtual environment
source .venv/bin/activate

# Run the bot
python backend/telegram_bot.py
```

You should see:
```
╔════════════════════════════════════════╗
║   AskHole Telegram Recovery Bot       ║
║   Account Linking & Password Recovery  ║
╚════════════════════════════════════════╝

INFO - Bot configured: @your_bot_username
INFO - Backend URL: http://localhost:5000
INFO - 🤖 Starting Telegram bot...
INFO - Bot username: @your_bot_username
INFO - Bot is running. Press Ctrl+C to stop.
```

## Step 6: Test the Bot

1. **Find your bot** on Telegram by searching for `@your_bot_username`
2. **Start a conversation** by clicking "Start" or sending `/start`
3. **Generate a linking code**:
   - Open AskHole in your browser (`http://localhost:5173`)
   - Log in to your account
   - Go to Settings → Security → Telegram Linking
   - Click "Generate Linking Code"
   - Copy the 6-digit code
4. **Link your account**:
   - Send the 6-digit code to the bot
   - Wait for confirmation message
   - Your Telegram account is now linked!

## Bot Commands

- `/start` - Welcome message and instructions
- `/help` - Detailed usage guide and troubleshooting

## How It Works

### Account Linking Flow

```
Frontend                 Telegram Bot              Backend
   |                           |                       |
   |--- Generate Code -------->|                       |
   |<-- 6-digit code -----------|                       |
   |                           |                       |
User sends code to bot ------->|                       |
   |                           |                       |
   |                           |--- Validate Code ---->|
   |                           |<-- User Info ---------|
   |                           |                       |
   |<-- Success Message --------|                       |
```

### Password Recovery Flow

```
Frontend                 Backend              Telegram Bot
   |                        |                      |
   |--- Forgot Password --->|                      |
   |                        |--- Send Reset Link ->|
   |                        |                      |
   |                        |                User receives link
   |                        |                      |
```

## Architecture

### Components

1. **telegram_bot.py**: Main bot application
   - Handles incoming messages
   - Validates 6-digit codes
   - Integrates with Flask API

2. **backend/src/routes/auth.py**: API endpoints
   - `/api/auth/link_telegram/request` - Generate linking codes
   - `/api/auth/link_telegram/complete` - Complete account linking
   - `/api/auth/forgot_password` - Initiate password recovery

3. **backend/src/telegram_utils.py**: Utility functions
   - `send_telegram_message()` - Send messages via Bot API
   - Message formatting helpers

### Security

- ✅ Codes expire after 10 minutes
- ✅ Codes can only be used once
- ✅ Webhook secret authentication
- ✅ One Telegram account per user
- ✅ HTTPS communication with Telegram API

## Troubleshooting

### Bot doesn't respond to messages

**Check:**
1. Bot is running (`python backend/telegram_bot.py`)
2. Bot token is correct in `.env`
3. No firewall blocking Telegram API
4. Check logs for errors

**Solution:**
```bash
# Restart the bot
Ctrl+C (stop)
python backend/telegram_bot.py (start)
```

### "Code has expired" error

**Cause:** Linking codes expire after 10 minutes

**Solution:** Generate a new code in AskHole Settings

### "Invalid code" error

**Possible causes:**
- Code already used
- Incorrect code (typo)
- Code doesn't exist in database

**Solution:** Generate a fresh code and try again

### "Backend server not running" error

**Cause:** Flask backend is not accessible

**Solution:**
```bash
# Start backend in separate terminal
source .venv/bin/activate
python backend/src/main.py
```

### "This Telegram account is already linked"

**Cause:** Your Telegram account is already linked to another AskHole user

**Solution:**
- Unlink from the other account first (Settings → Security)
- Or use a different Telegram account

### Import errors when starting bot

**Cause:** python-telegram-bot not installed

**Solution:**
```bash
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## Production Deployment

For production deployment:

1. **Use webhooks instead of polling** (more efficient)
2. **Set secure environment variables**:
   - Strong `SECRET_KEY`
   - Strong `TELEGRAM_WEBHOOK_SECRET`
   - Use environment-specific URLs
3. **Use HTTPS** for backend API
4. **Run bot as a system service** (systemd, supervisor, etc.)
5. **Monitor logs** for errors and suspicious activity
6. **Rate limiting** to prevent abuse

### Example systemd Service

Create `/etc/systemd/system/askhole-telegram-bot.service`:

```ini
[Unit]
Description=AskHole Telegram Recovery Bot
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/AskHole-App
Environment="PATH=/path/to/.venv/bin"
ExecStart=/path/to/.venv/bin/python /path/to/backend/telegram_bot.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable askhole-telegram-bot
sudo systemctl start askhole-telegram-bot
sudo systemctl status askhole-telegram-bot
```

## Development Workflow

### Running Everything Together

1. **Terminal 1: Backend**
   ```bash
   source .venv/bin/activate
   python backend/src/main.py
   ```

2. **Terminal 2: Telegram Bot**
   ```bash
   source .venv/bin/activate
   python backend/telegram_bot.py
   ```

3. **Terminal 3: Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

### Stopping the Bot

- Press `Ctrl+C` in the terminal running the bot
- Bot will shut down gracefully
- Logs will show: "Bot stopped by user (Ctrl+C)"

## Logs and Debugging

The bot logs important events:

```
INFO - User 123456789 (username) started the bot
INFO - Received message from 123456789 (username): 123456
INFO - Successfully linked Telegram user 123456789 to AskHole user john_doe
WARNING - Failed to link account for user 123456789: Code has expired
ERROR - Update <Update> caused error: <error details>
```

**Enable debug logging:**

Edit `telegram_bot.py` line 29:
```python
level=logging.DEBUG  # Changed from logging.INFO
```

## FAQ

**Q: Can I use the same bot for multiple environments (dev/prod)?**
A: No, create separate bots for each environment. Use different bot tokens and usernames.

**Q: How many users can the bot handle?**
A: The bot uses polling by default, which is fine for small-medium usage. For high traffic, switch to webhooks.

**Q: Can users unlink their Telegram account?**
A: Yes, implement an unlink feature in the frontend Settings page that removes the `telegram_chat_id` from the user record.

**Q: What happens if the backend is down?**
A: The bot will show a connection error to users. Implement retry logic or queue messages for better resilience.

**Q: Can I customize the bot messages?**
A: Yes, edit the message strings in `telegram_bot.py` (functions like `start_command`, `handle_message`, etc.).

## Support

For issues or questions:
- Check the logs first (both bot and backend)
- Review this documentation
- Contact the development team
- File an issue on GitHub

## License

Same license as the main AskHole application (MIT).
