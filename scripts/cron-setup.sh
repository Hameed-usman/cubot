#!/bin/bash
# Cubot Cron Job Setup Script
# Run this script on your Linux server to set up a daily background scraping task.

APP_DIR=$(pwd)
LOG_FILE="$APP_DIR/cron-crawler.log"
CRON_JOB="0 0 * * * cd $APP_DIR && npm run crawl >> $LOG_FILE 2>&1"

# Check if cron job already exists
if crontab -l | grep -q "npm run crawl"; then
    echo "✅ Cron job for Cubot crawler already exists."
else
    # Add new cron job to run every midnight
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "🎉 Success! Cron job added."
    echo "🕒 The Cubot crawler will now run automatically every day at Midnight (00:00)."
    echo "📄 Logs will be saved to: $LOG_FILE"
fi
