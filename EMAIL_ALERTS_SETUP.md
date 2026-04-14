# Email Alerts System Documentation

## Overview

The Found It Here application now includes automatic email notifications for users who report lost items. When a matching item is added by the admin, the user receives an alert email immediately.

## Features

### 1. Lost Item Submission Confirmation
- When a user submits a lost item report, they automatically receive a confirmation email
- Email includes:
  - Acknowledgment of the lost item
  - Explanation of how the matching system works
  - Encouragement to check their dashboard for updates

### 2. Match Found Notifications
- When an admin adds a found item that matches a lost item report, affected users receive an alert email
- Emails include:
  - Match confidence score (percentage)
  - Details about both the lost and found items
  - Direct link to view full details on the dashboard

### 3. Batch Notifications
- If multiple lost items match a single found item, users receive a single notification listing all matches
- Reduces notification fatigue while keeping users informed

## Database Schema

### New Table: `email_alerts`

Tracks all email notifications sent to users:

```sql
CREATE TABLE public.email_alerts (
  id UUID PRIMARY KEY,
  user_id UUID -- References profiles.id
  report_id UUID -- References lost_item_reports.id (optional)
  found_item_id UUID -- References found_items.id (optional)
  alert_type TEXT -- 'lost_item_submitted' or 'match_found'
  email_sent_at TIMESTAMP
  email_address TEXT
  subject TEXT
  status TEXT -- 'sent', 'failed', 'bounced'
  error_message TEXT
  created_at TIMESTAMP
)
```

### Profile Column Addition

Added `email_notifications_enabled` (boolean, default: true) to `profiles` table to allow users to opt out of notifications.

## Configuration

### Environment Variables

Add the following to your `.env.local` file to enable email sending:

```env
# SMTP Configuration
SMTP_HOST=your-smtp-host.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@found-it-here.app

# App URL (for email links)
VITE_APP_URL=http://localhost:5173
```

### SMTP Providers

You can use any SMTP provider. Popular options:

- **Gmail**: 
  - Host: `smtp.gmail.com`
  - Port: `587`
  - User: Your Gmail address
  - Password: App-specific password (requires 2FA)

- **SendGrid**:
  - Host: `smtp.sendgrid.net`
  - Port: `587`
  - User: `apikey`
  - Password: SendGrid API key

- **Mailgun**:
  - Host: `smtp.mailgun.org`
  - Port: `587`
  - User: Your Mailgun username
  - Password: Your Mailgun password

- **AWS SES**: 
  - Host: `email-smtp.{region}.amazonaws.com`
  - Port: `587`
  - User: SMTP username from AWS
  - Password: SMTP password from AWS

## API Endpoints

### 1. Send Email Notification (Internal)
```
POST /api/notifications/email
```

**Request Body:**
```json
{
  "type": "lost_item_submitted",
  "userId": "uuid",
  "reportId": "uuid",
  "itemName": "string",
  "category": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email sent"
}
```

### 2. Notify Matches Found (Internal)
```
POST /api/notifications/match-found
```

**Request Body:**
```json
{
  "foundItemId": "uuid",
  "foundItemName": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sent match notifications to X user(s)",
  "userCount": number
}
```

### 3. Get Email Preferences
```
GET /api/user/email-preferences
Authorization: Bearer {token}
```

**Response:**
```json
{
  "email_notifications_enabled": boolean
}
```

### 4. Update Email Preferences
```
POST /api/user/email-preferences
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "email_notifications_enabled": boolean
}
```

**Response:**
```json
{
  "success": true,
  "email_notifications_enabled": boolean
}
```

### 5. Get Email Alert History
```
GET /api/user/email-alerts
Authorization: Bearer {token}
```

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "alert_type": "lost_item_submitted",
      "email_address": "user@example.com",
      "subject": "Your Lost Item Report",
      "status": "sent",
      "created_at": "2026-03-05T12:00:00Z"
    }
  ]
}
```

## Email Templates

### Lost Item Submitted Email

Sent when a user successfully reports a lost item.

**Subject:** `Your Lost Item Report: {itemName}`

**Content includes:**
- Acknowledgment of the lost item
- Category information
- How the matching system works
- Next steps

### Match Found Email

Sent when a matching item is found.

**Subject:** `🎉 Potential Match Found: {foundItemName}`

**Content includes:**
- Found item details
- Lost item details
- Match confidence percentage
- Link to dashboard
- Note about verifying the match

### Batch Matches Email

Sent when multiple matches are found in one action.

**Subject:** `🎉 {count} Potential Match(es) Found!`

**Content includes:**
- Count of matches found
- Link to review all matches
- Brief note about verification

## Flow Diagram

```
User Reports Lost Item
         ↓
  Create lost_item_report
         ↓
  Get user email from profiles
         ↓
  Check email_notifications_enabled
         ↓
  Send confirmation email
         ↓
  Create potential_matches records


Admin Adds Found Item
         ↓
  Create found_item
         ↓
  Find all potential_matches for this item
         ↓
  For each matching lost_item_report:
    ├─ Get user profile
    ├─ Check email_notifications_enabled
    └─ Send match_found email
         ↓
  Log email_alerts records
```

## Testing

### Local Testing

1. Configure SMTP in `.env.local` (use a test email service like Mailtrap)
2. Run the development server: `npm run dev:all`
3. Submit a lost item report
4. Check the test email inbox to verify confirmation email
5. Add a found item from admin dashboard
6. Verify match email is sent

### Email Debugging

Check the database for sent emails:
```sql
SELECT * FROM public.email_alerts 
ORDER BY created_at DESC 
LIMIT 20;
```

View failed emails:
```sql
SELECT * FROM public.email_alerts 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

## Troubleshooting

### Emails not sending

1. **Check environment variables**: Ensure SMTP credentials are correctly set in `.env.local`
2. **Verify SMTP credentials**: Test with your email provider
3. **Check server logs**: Look for error messages in the console
4. **Database check**: Verify email_alerts table shows 'failed' status with error message

### Users not receiving emails

1. **Check notification preferences**: Verify `email_notifications_enabled` is true
2. **Verify email address**: Check that user email is correct in profiles table
3. **SPAM folder**: Ask users to check spam/promotions
4. **Provider rate limits**: Some SMTP providers have rate limits

## Security Considerations

1. **Token Validation**: All user-facing endpoints validate Bearer tokens
2. **User Privacy**: Users can disable email notifications
3. **Email Addresses**: Stored in profiles table and email_alerts for audit trail
4. **Sensitive Info**: Error messages logged but not exposed to client
5. **SMTP Credentials**: Should be stored as environment variables, never in code

## Future Enhancements

- [ ] Email template customization
- [ ] Digest emails (daily/weekly summaries instead of individual alerts)
- [ ] SMS notifications as alternative
- [ ] Unsubscribe link in emails
- [ ] Email preference categories (matches, confirmations, etc.)
- [ ] HTML email with images
- [ ] Reply-to address for user questions
- [ ] Email read receipts tracking

## Support

For issues with the email system:

1. Check server logs for errors
2. Verify SMTP credentials and connectivity
3. Check email_alerts table for failure details
4. Test SMTP credentials with a mail client like Thunderbird
