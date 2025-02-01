import { Database } from '@/types/supabase';
import { logger } from '@/utils/logger';
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs';
import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = createPagesServerClient<Database>({ req, res });
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { emailText, fromAddress, subject, orgId } = req.body;

    if (!emailText || !orgId) {
      logger.warn('Missing required fields in classification request', { fromAddress, subject, orgId });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify user has access to this organization
    const { data: orgMember, error: orgError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', session.user.id)
      .single();

    if (orgError || !orgMember) {
      logger.error('User not authorized for this organization', { 
        userId: session.user.id, 
        orgId,
        error: orgError 
      });
      return res.status(403).json({ error: 'Not authorized for this organization' });
    }

    // Get organization-specific classification rules
    const { data: org } = await supabase
      .from('organizations')
      .select('name, metadata')
      .eq('id', orgId)
      .single();

    // Include org-specific rules in the system prompt
    const orgSpecificRules = org?.metadata?.classification_rules || [];
    const orgName = org?.name || 'Unknown Organization';

    const systemPrompt = `You are an expert email classifier for ${orgName}'s helpdesk system. Your task is to determine if an incoming email is promotional/marketing/automated or requires a human response. You must analyze each email with sophisticated criteria while maintaining strict output format compliance.

DETAILED CLASSIFICATION RULES:

1. Mark as PROMOTIONAL (isPromotional: true) if the email:
   - Contains any marketing language or promotional offers
   - Is from a no-reply email address
   - Contains words like "newsletter", "update", "announcement", "offer", "discount"
   - Is an automated system notification (e.g., password changes, login alerts)
   - Contains tracking numbers or order confirmations
   - Is a social media notification or alert
   - Is a mass-sent newsletter or company update
   - Contains promotional imagery or multiple marketing links
   - Is an automated calendar invite or reminder
   - Contains phrases like "Don't miss out", "Limited time", "Special offer"
   - Is an automated receipt or transaction confirmation
   - Contains unsubscribe links or marketing footers
   - Is from known marketing domains or bulk email services
   - Uses HTML-heavy formatting typical of marketing emails
   ${orgSpecificRules.length > 0 ? '\nORGANIZATION-SPECIFIC RULES:\n' + orgSpecificRules.join('\n') : ''}

2. Mark as NEEDS_RESPONSE (isPromotional: false) if the email:
   - Contains direct questions requiring human judgment
   - Includes specific technical issues or bug reports
   - Contains personal or unique inquiries
   - References previous conversations or tickets
   - Includes screenshots or specific problem descriptions
   - Contains urgent support requests or time-sensitive issues
   - Includes phrases like "Please help", "I need assistance", "Can someone explain"
   - Contains detailed customer feedback requiring analysis
   - Includes business proposals or partnership inquiries
   - Contains specific account or service questions
   - Includes personal contact information for follow-up
   - References specific transactions or interactions
   - Contains unique situations not covered by FAQs
   - Shows signs of human authorship (typos, conversational tone)

OUTPUT FORMAT:
You must respond in this exact JSON format with only these two fields:
{
    "isPromotional": boolean,
    "reason": "Brief explanation of classification decision"
}`;

    const userPrompt = `Please classify this email:
From: ${fromAddress}
Subject: ${subject}
Content: ${emailText}`;

    // Log the classification request with org context
    logger.info('Starting email classification', {
      orgId,
      fromAddress,
      subject,
      contentLength: emailText.length,
      contentPreview: emailText.substring(0, 200) + (emailText.length > 200 ? '...' : '')
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 150,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      logger.error('No response from GPT', { completion });
      return res.status(500).json({ error: 'Classification failed' });
    }

    try {
      const classification = JSON.parse(response);
      
      // Log the classification result
      logger.info('Email classification complete', {
        orgId,
        fromAddress,
        subject,
        classification: {
          isPromotional: classification.isPromotional,
          reason: classification.reason
        }
      });

      return res.status(200).json(classification);
    } catch (parseError) {
      logger.error('Error parsing GPT response', { response, error: parseError });
      return res.status(500).json({ error: 'Invalid classification response' });
    }
  } catch (error) {
    logger.error('Error classifying email', { error });
    return res.status(500).json({ error: 'Internal Server Error' });
  }
} 