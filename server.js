const express = require('express');
const path = require('path');
const { EmailClassifier } = require('./services/emailClassifier');
const { AIDraftGenerator } = require('./services/aiDraftGenerator');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://your-supabase-instance.supabase.co';
const supabaseKey = 'your-supabase-key';
const supabaseSecret = 'your-supabase-secret';
const supabase = createClient(supabaseUrl, supabaseKey, supabaseSecret);

const app = express();
const port = 3000;

app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

// New email processing endpoint
app.post('/api/process-email', async (req, res) => {
  try {
    const email = req.body;
    const { aiDraft } = req.body;

    // Step 1: Promotional check
    if (EmailClassifier.isPromotional(email)) {
      return res.status(200).json({ 
        processed: true, 
        action: 'archived',
        reason: 'Promotional content detected'
      });
    }

    // Step 2: Generate AI draft
    const draftService = new AIDraftGenerator();
    const draft = await draftService.generateDraft(email.body, '');
    
    // Step 3: Store draft in database
    const { data, error } = await supabase
      .from('processed_messages')
      .upsert({
        message_id: email.id,
        ai_draft: draft.choices[0].message.content,
        processed_at: new Date().toISOString()
      })
      .select();

    if (error) throw new Error('Database storage failed: ' + error.message);

    const { data: insertData, error: insertError } = await supabase
      .from('processed_messages')
      .insert({
        ...req.body,
        ai_draft: aiDraft
      });

    if (insertError) throw new Error('Database storage failed: ' + insertError.message);

    res.status(201).json({
      processed: true,
      draft: draft.choices[0].message.content
    });

  } catch (error) {
    console.error('Processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
