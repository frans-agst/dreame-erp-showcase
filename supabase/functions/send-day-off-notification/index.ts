// supabase/functions/send-day-off-notification/index.ts
// Edge Function to send email notifications for day-off request status changes
// Uses Resend API for email delivery
// Requirements: 6.4

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  to: string;
  staffName: string;
  status: 'approved' | 'rejected';
  startDate: string;
  endDate: string;
  reviewerName?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const payload: NotificationPayload = await req.json();
    
    if (!payload.to || !payload.status || !payload.startDate || !payload.endDate) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, status, startDate, endDate' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format dates for display
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    };

    const startDateFormatted = formatDate(payload.startDate);
    const endDateFormatted = formatDate(payload.endDate);
    const statusText = payload.status === 'approved' ? 'Approved' : 'Rejected';
    const statusColor = payload.status === 'approved' ? '#10B981' : '#EF4444';

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Day-Off Request ${statusText}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #F2F3F5; border-radius: 24px; padding: 32px;">
    <div style="background-color: #FFFFFF; border-radius: 16px; padding: 24px; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05);">
      <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600;">
        Day-Off Request ${statusText}
      </h1>
      
      <p style="margin: 0 0 16px 0;">
        Hello ${payload.staffName},
      </p>
      
      <p style="margin: 0 0 24px 0;">
        Your day-off request has been <strong style="color: ${statusColor};">${statusText.toLowerCase()}</strong>.
      </p>
      
      <div style="background-color: #F2F3F5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #64748B; text-transform: uppercase;">
          Request Details
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Start Date:</td>
            <td style="padding: 8px 0; font-weight: 500;">${startDateFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">End Date:</td>
            <td style="padding: 8px 0; font-weight: 500;">${endDateFormatted}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Status:</td>
            <td style="padding: 8px 0;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background-color: ${payload.status === 'approved' ? '#D1FAE5' : '#FEE2E2'}; color: ${statusColor};">
                ${statusText}
              </span>
            </td>
          </tr>
          ${payload.reviewerName ? `
          <tr>
            <td style="padding: 8px 0; color: #64748B;">Reviewed By:</td>
            <td style="padding: 8px 0; font-weight: 500;">${payload.reviewerName}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      
      <p style="margin: 0; color: #64748B; font-size: 14px;">
        ${payload.status === 'approved' 
          ? 'Enjoy your time off! Please make sure to complete any pending tasks before your leave.'
          : 'If you have any questions about this decision, please contact your manager.'}
      </p>
    </div>
    
    <p style="margin: 24px 0 0 0; text-align: center; color: #64748B; font-size: 12px;">
      This is an automated message from Dreame ERP. Please do not reply to this email.
    </p>
  </div>
</body>
</html>
    `.trim();

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') || 'Dreame ERP <noreply@dreame.id>',
        to: [payload.to],
        subject: `Day-Off Request ${statusText} - ${startDateFormatted}`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Resend API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email notification sent successfully',
        emailId: result.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
