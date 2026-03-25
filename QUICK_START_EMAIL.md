# Email Alerts System - Quick Start Guide

## What Was Added

A complete automatic email notification system for your Found It Here application.

## Key Features ✨

✅ **Automatic Confirmation Emails**
- Users receive an email when they submit a lost item report
- Explains the matching process and next steps

✅ **Match Found Alerts**
- Automatic email when an admin adds a found item that matches lost items
- Includes match confidence score
- Direct link to dashboard

✅ **User Control**
- Users can enable/disable email notifications anytime
- Opt-out setting stored per user
- API to check and update preferences

✅ **Email Audit Trail**
- Every email logged to database
- Track sent, failed, and bounced emails
- See email delivery history

## Quick Start (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Add Email Configuration to `.env.local`

**Option A: Gmail (Testing)**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com
VITE_APP_URL=http://localhost:5173
```

**Option B: Mailtrap (No Real Emails)**
Get free account at https://mailtrap.io, then:
```env
SMTP_HOST=live.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASSWORD=your-mailtrap-token
FROM_EMAIL=test@found-it-here.app
VITE_APP_URL=http://localhost:5173
```

See `EMAIL_CONFIG_EXAMPLES.md` for more providers.

### Step 3: Apply Database Migration
```bash
# If using Supabase CLI
supabase db push

# Or manually run the migration in Supabase dashboard:
# Copy contents of supabase/migrations/20260305_email_alerts.sql
# Paste in SQL Editor and run
```

### Step 4: Start the Application
```bash
npm run dev:all
```

### Step 5: Test
1. Go to http://localhost:5173
2. Submit a lost item report
3. Check email inbox (or Mailtrap inbox)
4. You should receive a confirmation email

## File Structure

```
Your Project
├── EMAIL_ALERTS_SETUP.md          ← Full documentation
├── EMAIL_CONFIG_EXAMPLES.md        ← SMTP setup guides
├── EMAIL_IMPLEMENTATION_SUMMARY.md ← What was added
├── supabase/
│   └── migrations/
│       └── 20260305_email_alerts.sql  ← Database changes
├── server/
│   ├── email.ts                        ← Email service (NEW)
│   └── index.ts                        ← API endpoints added
├── src/
│   └── lib/
│       └── database.ts                 ← Updated to trigger emails
└── package.json                        ← Added nodemailer
```

## What Happens When...

### User Reports Lost Item 📝
```
User fills out form → Submit
       ↓
Lost item saved to database
       ↓
Confirmation email sent automatically
       ↓
User sees success message
       ↓
User gets email with next steps
```

### Admin Adds Found Item 🎉
```
Admin uploads found item → Submit
       ↓
Found item saved to database
       ↓
System finds all matching lost items
       ↓
For each matching user:
  - Check if they want emails ✓
  - Send personalized match email 📧
  - Log email in database 📝
       ↓
Admin sees item created
```

## API Endpoints for Your Frontend

If you want to add email preferences UI:

### Get User's Email Settings
```javascript
const response = await fetch('/api/user/email-preferences', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${authToken}`
  }
});
const { email_notifications_enabled } = await response.json();
```

### Update Email Preferences
```javascript
const response = await fetch('/api/user/email-preferences', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  },
  body: JSON.stringify({
    email_notifications_enabled: true // or false
  })
});
```

### View Email History
```javascript
const response = await fetch('/api/user/email-alerts', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${authToken}`
  }
});
const { alerts } = await response.json();
// alerts = array of email objects
```

## Database Tables

### New Table: `email_alerts`
Automatically created by migration. Stores:
- Email address
- Email type (confirmation or match found)
- Subject line
- Delivery status (sent, failed, bounced)
- Error message (if failed)
- Timestamp

### Updated Table: `profiles`
New column added:
- `email_notifications_enabled` (boolean, default: true)

## Monitoring & Debugging

### Check Sent Emails
```sql
SELECT * FROM email_alerts 
WHERE status = 'sent' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Failed Emails
```sql
SELECT * FROM email_alerts 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

### Check User Preferences
```sql
SELECT email, email_notifications_enabled 
FROM profiles 
WHERE email_notifications_enabled = false;
```

## Email Templates

The system includes 3 templates automatically:

1. **Lost Item Confirmation**
   - Sent when user reports an item
   - Includes item details
   - Explains matching process

2. **Match Found (Single)**
   - Sent when one item matches
   - Shows match score
   - Links to dashboard

3. **Match Found (Multiple)**
   - Sent when multiple items match one found item
   - Lists all matches
   - Links to dashboard

## Production Checklist

Before going live:

- [ ] Choose SMTP provider (SendGrid recommended)
- [ ] Set up SMTP credentials
- [ ] Test email delivery
- [ ] Set up email domain authentication (SPF/DKIM)
- [ ] Monitor email delivery rates
- [ ] Test user preferences UI
- [ ] Deploy to production
- [ ] Monitor email_alerts table for failures

## Troubleshooting

### No emails sending?
1. Check `.env.local` has SMTP credentials
2. Verify SMTP provider is correct
3. Look at server console for errors
4. Check `email_alerts` table for status='failed'

### SMTP authentication failed?
1. Double-check username and password
2. For Gmail, use app password (not account password)
3. Check SMTP_PORT is 587 (not 25)

### Emails going to spam?
1. Use your own domain in FROM_EMAIL
2. Set up email authentication (SPF, DKIM)
3. Use a reputation-managed provider like SendGrid

## Need Help?

1. **Full Documentation:** See `EMAIL_ALERTS_SETUP.md`
2. **Setup Guides:** See `EMAIL_CONFIG_EXAMPLES.md`
3. **What Was Changed:** See `EMAIL_IMPLEMENTATION_SUMMARY.md`
4. **Check Server Logs:** Look for error messages
5. **Check Database:** See `email_alerts` table for details

## Next Steps

1. ✅ Dependencies installed
2. ✅ Database migration ready
3. ✅ Email service configured
4. ⏭️ Add SMTP credentials to `.env.local`
5. ⏭️ Run database migration
6. ⏭️ Test locally
7. ⏭️ Deploy to production

Good luck! 🎉

