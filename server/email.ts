/**
 * Email Service
 * Handles sending transactional emails to users
 */

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

// Email templates
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private supabase: ReturnType<typeof createClient> | null = null;

  private constructor() {
    this.initializeTransporter();
    this.initializeSupabase();
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initializeTransporter() {
    // Using Supabase built-in email or a configured SMTP service
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;
    const fromEmail = process.env.FROM_EMAIL || 'noreply@wefoundit.org';

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
    } else {
      console.warn(
        'Email service not fully configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD env vars.'
      );
    }
  }

  private initializeSupabase() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SECRET_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });
    }
  }

  async sendEmail(
    to: string,
    template: EmailTemplate,
    metadata?: { userId?: string; reportId?: string; foundItemId?: string; alertType?: string }
  ): Promise<boolean> {
    if (!this.transporter) {
      console.error('Email transporter not configured');
      return false;
    }

    try {
      const fromEmail = process.env.FROM_EMAIL || 'noreply@found-it-here.app';

      const result = await this.transporter.sendMail({
        from: fromEmail,
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      // Record the email alert in database
      if (this.supabase && metadata?.userId) {
        await this.recordEmailAlert(
          metadata.userId,
          metadata.alertType || 'transactional',
          to,
          template.subject,
          metadata.reportId,
          metadata.foundItemId,
          'sent'
        );
      }

      console.log(`Email sent to ${to}:`, result.messageId);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);

      // Record failed email attempt
      if (this.supabase && metadata?.userId) {
        await this.recordEmailAlert(
          metadata.userId,
          metadata.alertType || 'transactional',
          to,
          template.subject,
          metadata.reportId,
          metadata.foundItemId,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      return false;
    }
  }

  private async recordEmailAlert(
    userId: string,
    alertType: string,
    email: string,
    subject: string,
    reportId?: string,
    foundItemId?: string,
    status: string = 'sent',
    errorMessage?: string
  ): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase!.rpc('record_email_alert', {
        p_user_id: userId,
        p_alert_type: alertType,
        p_email: email,
        p_subject: subject,
        p_report_id: reportId || null,
        p_found_item_id: foundItemId || null,
        p_status: status,
        p_error_message: errorMessage || null,
      } as any);
    } catch (error) {
      console.error('Failed to record email alert:', error);
    }
  }

  // Template generators
  static generateLostItemSubmittedTemplate(
    userName: string,
    itemName: string,
    category: string
  ): EmailTemplate {
    const subject = `Your Lost Item Report: ${itemName}`;
    const html = `
      <h2>Lost Item Report Received</h2>
      <p>Hi ${userName},</p>
      <p>We've received your report for your lost <strong>${itemName}</strong> (${category}).</p>
      
      <h3>What happens next?</h3>
      <ul>
        <li>Our system will continuously scan new items added to the inventory</li>
        <li>When a matching item is found, we'll send you an immediate email alert</li>
        <li>You can check your dashboard anytime to view potential matches</li>
      </ul>
      
      <p>Items are often found within the first few days!</p>
      
      <p>Best regards,<br>FoundIt Team</p>
    `;
    const text = `
Lost Item Report Received

Hi ${userName},

We've received your report for your lost ${itemName} (${category}).

What happens next?
- Our system will continuously scan new items added to the inventory
- When a matching item is found, we'll send you an immediate email alert
- You can check your dashboard anytime to view potential matches

Items are often found within the first few days!

Best regards,
FoundIt Team
    `;

    return { subject, html, text };
  }

  static generateMatchFoundTemplate(
    userName: string,
    lostItemName: string,
    foundItemName: string,
    matchScore: number,
    dashboardUrl: string
  ): EmailTemplate {
    const matchPercentage = Math.round(matchScore * 100);
    const subject = `🎉 Potential Match Found: ${foundItemName}`;
    const html = `
      <h2>Potential Match Found!</h2>
      <p>Hi ${userName},</p>
      <p>Great news! We found a potential match for your lost item.</p>
      
      <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3>Lost Item</h3>
        <p><strong>${lostItemName}</strong></p>
        
        <h3>Found Item</h3>
        <p><strong>${foundItemName}</strong></p>
        
        <h3>Match Confidence</h3>
        <p><strong>${matchPercentage}%</strong></p>
      </div>
      
      <p>
        <a href="${dashboardUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
          View Full Details
        </a>
      </p>
      
      <p style="color: #666; font-size: 12px;">
        This is an automated match based on the details you provided. Please verify the match before claiming the item.
      </p>
      
      <p>Best regards,<br>FoundIt Team</p>
    `;
    const text = `
Potential Match Found!

Hi ${userName},

Great news! We found a potential match for your lost item.

Lost Item: ${lostItemName}
Found Item: ${foundItemName}
Match Confidence: ${matchPercentage}%

View the full details here: ${dashboardUrl}

This is an automated match based on the details you provided. Please verify the match before claiming the item.

Best regards,
FoundIt Team
    `;

    return { subject, html, text };
  }

  static generateMatchesFoundBatchTemplate(
    userName: string,
    matchCount: number,
    dashboardUrl: string
  ): EmailTemplate {
    const subject = `🎉 ${matchCount} Potential Match${matchCount > 1 ? 'es' : ''} Found!`;
    const html = `
      <h2>Potential Matches Found!</h2>
      <p>Hi ${userName},</p>
      <p>Exciting news! We found <strong>${matchCount}</strong> potential match${
        matchCount > 1 ? 'es' : ''
      } for one or more of your lost items.</p>
      
      <p>
        <a href="${dashboardUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
          Review All Matches
        </a>
      </p>
      
      <p>Our matching algorithm considers multiple factors like item description, color, brand, and location. Please review each match carefully before proceeding.</p>
      
      <p>Best regards,<br>Found It Here Team</p>
    `;
    const text = `
Potential Matches Found!

Hi ${userName},

Exciting news! We found ${matchCount} potential match${
        matchCount > 1 ? 'es' : ''
      } for one or more of your lost items.

Review all matches here: ${dashboardUrl}

Our matching algorithm considers multiple factors like item description, color, brand, and location. Please review each match carefully before proceeding.

Best regards,
Found It Here Team
    `;

    return { subject, html, text };
  }
}

export default EmailService;
