# Email Alerts System - Implementation Summary

## Overview
Implemented automatic email alerts for the Found It Here application. Users receive email notifications when they submit a lost item report and when matching items are added by the admin.

## Changes Made

### 1. Database Changes

#### New Migration File
- **File:** `supabase/migrations/20260305_email_alerts.sql`
- **Changes:**
  - Added `email_notifications_enabled` column to `profiles` table (boolean, default: true)
  - Created new `email_alerts` table to track all email notifications
  - Added indexes for efficient querying
  - Created `record_email_alert()` function for audit trail
  - Added RLS policies for security

#### New Table: `email_alerts`
```sql
Columns:
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key to profiles)
- report_id (UUID, Foreign Key to lost_item_reports, optional)
- found_item_id (UUID, Foreign Key to found_items, optional)
- alert_type (TEXT: 'lost_item_submitted' or 'match_found')
- email_sent_at (TIMESTAMP)
- email_address (TEXT)
- subject (TEXT)
- status (TEXT: 'sent', 'failed', 'bounced')
- error_message (TEXT)
- created_at (TIMESTAMP)
```

### 2. Backend Services

#### New Email Service
- **File:** `server/email.ts`
- **Features:**
  - Singleton `EmailService` class using nodemailer
  - Automatic email recording to database
  - Three email templates:
    1. Lost item submission confirmation
    2. Match found notification (single match)
    3. Match found notification (batch)
  - HTML and plain text versions of all templates
  - Graceful error handling

#### Email Templates
1. **Lost Item Submitted**
   - Subject: "Your Lost Item Report: {itemName}"
   - Explains how the matching system works
   - Encourages checking dashboard

2. **Match Found (Single)**
   - Subject: "🎉 Potential Match Found: {foundItemName}"
   - Shows lost vs found item details
   - Displays match confidence percentage
   - Includes dashboard link

3. **Matches Found (Batch)**
   - Subject: "🎉 X Potential Match(es) Found!"
   - Lists count of matches
   - Includes dashboard link

### 3. Database Layer Updates

#### File: `src/lib/database.ts`

**Updated Functions:**
- `createLostItemReport()` - Now triggers email notification for confirmation
- `createFoundItem()` - Now triggers email notifications for all affected users

**New Helper Functions:**
- `requestEmailNotification()` - Calls email endpoint for lost item submissions
- `requestMatchFoundNotifications()` - Calls email endpoint when matches are found

**Interfaces:**
```typescript
interface EmailNotificationRequest {
  type: "lost_item_submitted" | "match_found";
  reportId?: string;
  foundItemId?: string;
  userId?: string;
  itemName?: string;
  category?: string;
  matchScore?: number;
}
```

### 4. API Endpoints

#### File: `server/index.ts`

**New Endpoints:**

1. **POST `/api/notifications/email`**
   - Sends lost item confirmation emails
   - Checks user's notification preference
   - Records email delivery status

2. **POST `/api/notifications/match-found`**
   - Finds all potential matches for a new found item
   - Groups matches by user
   - Sends personalized email to each affected user
   - Handles both single and batch match scenarios

3. **GET `/api/user/email-preferences`**
   - Retrieves user's email notification setting
   - Requires Bearer token authentication

4. **POST `/api/user/email-preferences`**
   - Updates user's email notification preference
   - Allows users to opt-in/out of emails
   - Requires Bearer token authentication

5. **GET `/api/user/email-alerts`**
   - Returns user's email alert history
   - Limited to last 50 alerts
   - Requires Bearer token authentication

### 5. Dependencies

#### Updated `package.json`
- Added `nodemailer` (v6.9.10) - SMTP email library
- Added `@types/nodemailer` (v6.4.14) - TypeScript types

## Configuration

### Required Environment Variables

Add to `.env.local`:

```env
# SMTP Email Service
SMTP_HOST=smtp.gmail.com          # Your SMTP server
SMTP_PORT=587                      # Usually 587 for TLS
SMTP_USER=your-email@gmail.com    # SMTP username
SMTP_PASSWORD=your-app-password   # SMTP password
FROM_EMAIL=noreply@found-it-here.app

# Application URL (for email links)
VITE_APP_URL=http://localhost:5173
```

### SMTP Provider Options
- Gmail (recommended for testing)
- SendGrid (recommended for production)
- Mailgun
- Mailtrap (recommended for development)
- AWS SES
- Office 365
- Or any SMTP service

See `EMAIL_CONFIG_EXAMPLES.md` for detailed setup instructions for each provider.

## Usage Flow

### Lost Item Submission Flow
```
User submits lost item report
    ↓
createLostItemReport() creates record
    ↓
requestEmailNotification() triggered
    ↓
Client sends to /api/notifications/email
    ↓
Server checks user's notification preference
    ↓
EmailService sends confirmation email
    ↓
Email recorded in email_alerts table
```

### Match Found Flow
```
Admin adds new found item
    ↓
createFoundItem() creates record
    ↓
requestMatchFoundNotifications() triggered
    ↓
Client sends to /api/notifications/match-found
    ↓
Server finds all potential matches
    ↓
For each user with matching lost items:
  ├─ Check notification preference
  ├─ Send personalized match email
  └─ Record in email_alerts table
```

## Error Handling

### Email Failures
- Failed emails are recorded in `email_alerts` table with status='failed'
- Error messages are logged for debugging
- Email sending failures don't block core operations
- Users can check their dashboard even if email fails

### User Opt-out
- Users can disable notifications via API
- Setting `email_notifications_enabled = false` prevents all emails
- Still creates notification records in database for audit trail

## Testing

### Local Testing
1. Install dependencies: `npm install`
2. Configure SMTP in `.env.local` (use Mailtrap for testing)
3. Run dev server: `npm run dev:all`
4. Submit a lost item report
5. Check Mailtrap inbox for confirmation email
6. Add a matching found item from admin dashboard
7. Verify match found email is received

### Database Verification
```sql
-- Check sent emails
SELECT * FROM email_alerts WHERE status = 'sent' ORDER BY created_at DESC;

-- Check failed emails
SELECT * FROM email_alerts WHERE status = 'failed' ORDER BY created_at DESC;

-- Check user preferences
SELECT id, email, email_notifications_enabled FROM profiles;
```

## Security Considerations

1. **Token Validation**: All user endpoints validate Bearer tokens
2. **User Isolation**: Users can only access their own email preferences and alerts
3. **Opt-out Support**: Users can disable notifications anytime
4. **Audit Trail**: All emails logged in database
5. **Credential Security**: SMTP credentials stored only in environment variables
6. **Rate Limiting**: Consider adding rate limiting for email endpoints in production

## Monitoring & Analytics

### Email Metrics
- Total emails sent: `SELECT COUNT(*) FROM email_alerts WHERE status = 'sent'`
- Failure rate: `SELECT COUNT(*) FROM email_alerts WHERE status = 'failed'`
- Alert type breakdown: `SELECT alert_type, COUNT(*) FROM email_alerts GROUP BY alert_type`

### User Engagement
```sql
SELECT 
  alert_type,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(*) as total_emails
FROM email_alerts
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY alert_type;
```

## Future Enhancements

- [ ] HTML email templates with images
- [ ] Email digest/summary emails (daily/weekly)
- [ ] SMS notifications as alternative
- [ ] Unsubscribe links in emails
- [ ] Email preference granularity (matches vs confirmations)
- [ ] Email read receipt tracking
- [ ] Reply-to functionality
- [ ] Rate limiting on email endpoints
- [ ] Email template customization UI
- [ ] Bounce/complaint handling

## Documentation Files

1. **EMAIL_ALERTS_SETUP.md** - Complete system documentation
2. **EMAIL_CONFIG_EXAMPLES.md** - SMTP provider setup guides
3. This file - Implementation summary

## Next Steps

1. Choose an SMTP provider (Gmail for testing, SendGrid for production)
2. Add SMTP credentials to `.env.local`
3. Run database migrations: `supabase migration up`
4. Test locally with Mailtrap or MailHog
5. Monitor email_alerts table for successful delivery
6. Deploy to production with chosen SMTP provider
7. Monitor email logs and user engagement

## Support & Debugging

### Common Issues

**Emails not sending:**
- Check SMTP credentials are correct
- Verify FROM_EMAIL domain reputation
- Check email provider logs
- Look at email_alerts table for error messages

**Users not receiving emails:**
- Verify email addresses in profiles table
- Check user's notification preference
- Check spam/promotions folder
- Verify email provider isn't blocking

**Server errors:**
- Check server logs for nodemailer errors
- Verify SMTP configuration
- Test SMTP connection with telnet
- Check firewall for port 587 access

For detailed troubleshooting, see EMAIL_ALERTS_SETUP.md.
