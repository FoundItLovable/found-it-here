# Email Configuration Examples

## Gmail (Recommended for testing)

### Prerequisites
1. Enable 2-Step Verification on your Google Account
2. Create an App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Select Mail and Windows Computer (or your OS)
   - Google will generate a 16-character password

### Configuration
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
FROM_EMAIL=your-email@gmail.com
```

---

## SendGrid (Production-ready)

### Prerequisites
1. Create a SendGrid account: https://sendgrid.com
2. Create an API Key:
   - Go to Settings → API Keys
   - Create a new API Key with Mail Send access
   - Copy the full key (note: you won't see it again)

### Configuration
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
FROM_EMAIL=your-verified-sender@your-domain.com
```

**Note:** You need to verify the sender email address in SendGrid before sending.

---

## Mailgun

### Prerequisites
1. Create a Mailgun account: https://mailgun.com
2. Add and verify your domain
3. Get SMTP credentials from Domain Settings

### Configuration
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASSWORD=your-mailgun-smtp-password
FROM_EMAIL=noreply@your-domain.mailgun.org
```

---

## Mailtrap (Development/Testing)

### Prerequisites
1. Create a free Mailtrap account: https://mailtrap.io
2. Create an inbox
3. Get SMTP credentials from the inbox settings

### Configuration
```env
SMTP_HOST=live.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-username
SMTP_PASSWORD=your-mailtrap-api-token
FROM_EMAIL=noreply@found-it-here-test.com
```

**Note:** All emails sent to Mailtrap are captured and displayed in the web interface. Perfect for testing without sending real emails.

---

## AWS SES (Simple Email Service)

### Prerequisites
1. Create an AWS account
2. Go to SES in AWS Console
3. Verify your sender email or domain
4. Create SMTP credentials:
   - Go to Account Dashboard → Create SMTP Credentials
   - Download the credentials

### Configuration
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-user
SMTP_PASSWORD=your-ses-smtp-password
FROM_EMAIL=your-verified-email@your-domain.com
```

**Note:** Replace `us-east-1` with your AWS region. Also ensure the sending email is verified in SES.

---

## Microsoft Office 365

### Prerequisites
1. Have an Office 365 account
2. Enable SMTP authentication in your account

### Configuration
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.onmicrosoft.com
SMTP_PASSWORD=your-office365-password
FROM_EMAIL=your-email@yourdomain.onmicrosoft.com
```

---

## Local Development (MailHog)

For local development without sending real emails:

### Installation
```bash
# Install MailHog (requires Go installed)
go install github.com/mailhog/MailHog@latest

# Run MailHog
MailHog
```

### Configuration
```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
FROM_EMAIL=noreply@localhost
```

### Access
- Web UI: http://localhost:8025
- All emails sent will be captured and visible in the web interface

---

## Complete `.env.local` Template

```env
# Supabase
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@found-it-here.app

# Application URL (used in email links)
VITE_APP_URL=http://localhost:5173

# Gemini API (if using image analysis)
GEMINI_API_KEY=your-gemini-api-key
```

---

## Testing Your Configuration

1. **Test SMTP Connection:**
   ```bash
   telnet smtp.gmail.com 587
   ```

2. **Test with Node.js:**
   ```javascript
   import nodemailer from 'nodemailer';

   const transporter = nodemailer.createTransport({
     host: process.env.SMTP_HOST,
     port: parseInt(process.env.SMTP_PORT),
     secure: parseInt(process.env.SMTP_PORT) === 465,
     auth: {
       user: process.env.SMTP_USER,
       pass: process.env.SMTP_PASSWORD,
     },
   });

   transporter.verify((error, success) => {
     if (error) {
       console.error('SMTP error:', error);
     } else {
       console.log('SMTP connection successful');
     }
   });
   ```

3. **Monitor Emails During Development:**
   - Check email_alerts table in Supabase
   - For Mailtrap/MailHog, check the web UI
   - Check spam folder for real emails

---

## Recommendations by Use Case

### Local Development
- Use **Mailtrap** (free tier available) or **MailHog** (completely local)
- Easy to inspect emails without Gmail/SendGrid setup

### Staging/Testing
- Use **Mailtrap** inbox for your staging domain
- Captures all test emails safely

### Production
- Use **SendGrid** (best reliability and deliverability)
- Alternative: **Mailgun** (good documentation)
- Alternative: **AWS SES** (if already using AWS)

### Small Budget
- **Gmail** works well for small volumes (<2,000 emails/day)
- Use app passwords for security
- Monitor account activity to avoid suspension

---

## Email Delivery Best Practices

1. **Set appropriate FROM address**: Should match your domain for better deliverability
2. **Monitor bounce rates**: Check email_alerts table for failures
3. **Use descriptive subject lines**: Improves open rates
4. **Include unsubscribe option**: Legal requirement in many jurisdictions
5. **Test before production**: Always test with Mailtrap first
6. **Monitor SMTP logs**: Check for authentication failures
7. **Warm up sending**: Start with small volume and increase gradually
8. **Use authentication**: Always use SMTP_USER and SMTP_PASSWORD

---

## Troubleshooting SMTP Issues

### "Authentication failed"
- Double-check username and password
- For Gmail, ensure you're using an app password, not account password
- Check SMTP_PORT is correct (usually 587 for TLS)

### "Connection refused"
- Verify SMTP_HOST is correct
- Check firewall/network allows outbound port 587
- Test with: `telnet SMTP_HOST 587`

### "Emails not arriving"
- Check spam folder
- Verify FROM_EMAIL domain reputation
- Check email provider's bounce/complaint logs
- Some providers may be blocking your mail

### "Rate limit exceeded"
- SendGrid: 10,000 emails/day free tier
- Mailgun: Higher limits, check your plan
- Gmail: 500 emails/day limit via SMTP

---

## Security Notes

1. **Never commit `.env.local`** to git - add to `.gitignore`
2. **Use environment variables** for all credentials
3. **Rotate API keys** periodically
4. **Use SMTP passwords/tokens** instead of account passwords
5. **Limit SMTP user permissions** - most providers allow mail-only access
6. **Monitor failed attempts** - check error logs for abuse

