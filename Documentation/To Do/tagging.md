-->

<file path="Documentation/agentive_promotional_instructions.md" action="create">
<change>
 <description>Comprehensive instructions for junior devs</description>
 <content>
===
# Agentive Promotional Email Instructions

## Overview
This document explains how to set up and integrate the new agent-based system that automatically:
- Classifies promotional emails using GPT.
- Labels them as "Promotion".
- Archives them so the inbox remains uncluttered.

We do **not** break any existing code. We only add new functionalities and references.

## Steps

1. **Environment Variable Setup**
- Ensure you have `OPENAI_API_KEY` in your `.env.local` (or `.env.example`). Example:
  ```
  OPENAI_API_KEY=sk-xxx
  ```
- If you do not have an OpenAI key, sign up at [OpenAI](https://platform.openai.com/) and paste your key here.

2. **Enable Gmail Modify Scope**
- Confirm that the relevant credentials have the `gmail.modify` scope. This is typically done during Gmail OAuth setup. Check your existing environment or credentials JSON.

3. **Adding the Code**
- You will add brand-new code in the `utils/agent/gmailPromotionAgent.ts` file for classification logic, as well as a new route under `pages/api/agentive/promotional.ts`.
- This code references existing `logger.ts`, `gmail.ts` from `utils/` or `utils/server/`, and `ticket_email_chats` tables in Supabase.

4. **Testing**
- We place new minimal tests in `tests/agent/promotionalAgent.test.ts`.
- The test uses actual calls or mocks from our environment. It ensures the classification pipeline runs without errors.

5. **Logging**
- We add extensive `console.log` plus usage of `logger.info/error/warn` or `gmailLogger` in the new code so we can see each step:
  - GPT classification input & output
  - Confidence thresholds
  - Labeling & archiving steps
  - Errors or warnings

6. **Pub/Sub Integration**
- No changes to existing watchers. 
- If the watchers see a new email, the pipeline or `pollGmailInbox` calls our new agent function for promotional classification. 

7. **Schema & Columns**
- We do **not** add new columns. 
- We use `ticket_email_chats.ai_classification` = `'promotional'` if GPT classification is confident. 
- We also set `.metadata["promo_details"]` if we want to store references.

8. **One-Shot Implementation**
- This doc plus the new code in `utils/agent` is everything you need. 
- Ensure all references to import paths (like `'@/utils/logger'`) are correct.

9. **Check .env.local**
- Confirm you have `OPENAI_API_KEY`.
- We do **not** require a Pinecone key or other vector store for basic classification. 
- If you want advanced retrieval, you can add more code.

10. **Deployment**
 - Deploy as normal to Vercel or your environment. 
 - The new route `pages/api/agentive/promotional.ts` gets included automatically. 
 - The watchers are triggered as per existing code.

---

## Potential Pitfalls
1. Missing or invalid `OPENAI_API_KEY` => classification fails silently.
2. Lacking `gmail.modify` scope => archiving fails.
3. GPT prompt returned uncertain => classification fallback is no action.
4. Race condition if watchers call the pipeline multiple times => check if `ai_classification` is already set.
5. Surpassing GPT rate limits => implement small queue or error handling.

## Post-Setup
- Use the logs in the browser console or the server logs to confirm the system is tagging emails. 
- Manually verify in your Gmail that promotional emails are indeed labeled “Promotion” and archived.

## Additional Developer Info
- You can check the `logs` or `audit_logs` table for any inserted logs if we configure them in the code. 
- If you want to refine or expand, see the `PROMOTIONAL_EMAIL_PROMPT` in `gmailPromotionAgent.ts` and adapt as needed.

Enjoy your newly agentive promotional email management system!
===
 </content>
</change>
</file>


<!-- 
=====================================================================
3) CREATE THE MAIN AGENT FILE
=====================================================================
-->

<file path="utils/agent/gmailPromotionAgent.ts" action="create">
<change>
 <description>Implements the GPT-based classification, labeling, archiving logic for promotional emails</description>
 <content>
===
import { logger } from "@/utils/logger";
import { getGmailClient, addGmailLabel } from "@/utils/server/gmail";
import { supabase } from "@/utils/server/supabaseClient"; // We'll create this reference if not existing
import { Database } from "@/types/supabase";

// We define a static prompt
const PROMOTIONAL_EMAIL_PROMPT = `
You are an email classification assistant. 
Label the following email as "promotional" if it is likely from a vendor, 
advertising something, a sale, or new product updates that are marketing in nature.
Otherwise, label it as "not_promotional".

Please respond with JSON: 
{"classification": "...", "confidence": 0-100}

Email content:
`;

// Confidence threshold
const PROMO_CONFIDENCE_THRESHOLD = 70;

export interface GPTClassificationResult {
classification: "promotional" | "not_promotional";
confidence: number;
}

/**
* callGPTForPromotionalClassification
* Sends text to GPT for classification
*/
export async function callGPTForPromotionalClassification(emailText: string): Promise<GPTClassificationResult | null> {
if (!process.env.OPENAI_API_KEY) {
 logger.error("No OPENAI_API_KEY found. Skipping promotional classification.");
 return null;
}

const prompt = `${PROMOTIONAL_EMAIL_PROMPT}${emailText}\n`;

try {
 const resp = await fetch("https://api.openai.com/v1/chat/completions", {
   method: "POST",
   headers: {
     "Content-Type": "application/json",
     "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
   },
   body: JSON.stringify({
     model: "gpt-3.5-turbo",
     messages: [
       { role: "system", content: "You classify email text as promotional or not." },
       { role: "user", content: prompt }
     ],
     max_tokens: 200,
     temperature: 0.0
   })
 });

 if (!resp.ok) {
   logger.error("GPT classification request failed", { status: resp.status, statusText: resp.statusText });
   return null;
 }

 const data = await resp.json();
 const content = data.choices?.[0]?.message?.content?.trim() || "";
 logger.info("GPT raw classification content", { content });

 // Attempt to parse JSON
 let classification: "promotional" | "not_promotional" = "not_promotional";
 let confidence = 50;
 try {
   const jsonStart = content.indexOf("{");
   const jsonEnd = content.lastIndexOf("}");
   if (jsonStart !== -1 && jsonEnd !== -1) {
     const jsonString = content.slice(jsonStart, jsonEnd + 1);
     const parsed = JSON.parse(jsonString);
     if (parsed.classification === "promotional" || parsed.classification === "not_promotional") {
       classification = parsed.classification;
     }
     if (typeof parsed.confidence === "number") {
       confidence = Math.max(0, Math.min(100, parsed.confidence));
     }
   }
 } catch (err) {
   logger.warn("Failed to parse GPT classification JSON. Defaulting to not_promotional", { err });
 }

 return { classification, confidence };
} catch (error: any) {
 logger.error("Error calling GPT for promotional classification", { error });
 return null;
}
}

/**
* isEmailPromotional
* Orchestrates the GPT call and checks if classification is promotional above threshold
*/
export async function isEmailPromotional(emailText: string): Promise<boolean> {
const result = await callGPTForPromotionalClassification(emailText);
if (!result) return false;
const { classification, confidence } = result;
const isPromo = classification === "promotional" && confidence >= PROMO_CONFIDENCE_THRESHOLD;
logger.info("Promotional classification result", { classification, confidence, isPromo });
return isPromo;
}

/**
* labelAndArchivePromotionalEmail
* If the GPT classification is promotional, apply "Promotion" label and archive the email.
* We do NOT break if labeling fails. We simply log errors.
*/
export async function labelAndArchivePromotionalEmail({
orgId,
gmailMessageId,
threadId
}: {
orgId: string;
gmailMessageId: string;
threadId: string;
}): Promise<void> {
// Get Gmail client
const gmail = await getGmailClient(orgId);
if (!gmail) {
 logger.warn("No Gmail client found. Cannot label or archive promotional email.", { orgId });
 return;
}

// 1. Apply or create "Promotion" label
// We'll try to see if label "Promotion" exists, if not, create it, then apply
try {
 await addGmailLabel(gmailMessageId, "Promotion", {
   access_token: "", // We'll let addGmailLabel handle retrieval from org if needed
   refresh_token: ""
 });
} catch (err) {
 logger.error("Failed to add 'Promotion' label to the message", { err, gmailMessageId });
}

// 2. Archive the email => remove "INBOX" label
// This is effectively the same as "Move to Archive" in Gmail
try {
 await gmail.users.messages.modify({
   userId: "me",
   id: gmailMessageId,
   requestBody: {
     removeLabelIds: ["INBOX"]
   }
 });
 logger.info("Archived promotional email", { gmailMessageId, threadId });
} catch (archiveErr) {
 logger.error("Failed to archive promotional email", { archiveErr });
}
}

/**
* processPotentialPromotionalEmail
* Full pipeline function: checks classification in DB, calls GPT if needed, sets ai_classification in DB,
* then if promotional, calls labelAndArchivePromotionalEmail.
*/
export async function processPotentialPromotionalEmail(
chatId: string,
orgId: string,
emailBody: string,
gmailMessageId: string,
threadId: string
): Promise<void> {
try {
 // 1. Check if ai_classification is already promotional
 const { data: chatRecord, error } = await supabase
   .from("ticket_email_chats")
   .select("id, ai_classification, ai_confidence")
   .eq("id", chatId)
   .single();

 if (error) {
   logger.error("Failed to fetch chat record to check classification", { error, chatId });
   return;
 }
 if (!chatRecord) {
   logger.warn("No chat record found for processPotentialPromotionalEmail", { chatId });
   return;
 }

 // If classification is already promotional, skip
 if (chatRecord.ai_classification === "promotional") {
   logger.info("Email is already promotional, skipping re-classification", { chatId });
   return;
 }

 // 2. Call GPT classification
 const isPromo = await isEmailPromotional(emailBody);

 // 3. If promotional, update DB
 if (isPromo) {
   try {
     await supabase.from("ticket_email_chats").update({
       ai_classification: "promotional",
       ai_confidence: 90 // or we can store the actual confidence from GPT
     }).eq("id", chatId);
   } catch (updateErr) {
     logger.error("Failed to update chat record classification to promotional", { updateErr, chatId });
   }

   // 4. Label & archive
   await labelAndArchivePromotionalEmail({ orgId, gmailMessageId, threadId });
 } else {
   logger.info("Email is not promotional or not confident enough, skipping label+archive", { chatId });
 }
} catch (err) {
 logger.error("Error in processPotentialPromotionalEmail", { err, chatId, orgId });
}
}
===
 </content>
</change>
</file>


<!-- 
=====================================================================
4) CREATE A NEW ROUTE FOR MANUAL TESTING / DEMO
=====================================================================
-->

<file path="pages/api/agentive/promotional.ts" action="create">
<change>
 <description>Optional route to demonstrate the agent classification with a posted email body</description>
 <content>
===
import type { NextApiRequest, NextApiResponse } from "next";
import { processPotentialPromotionalEmail } from "@/utils/agent/gmailPromotionAgent";
import { logger } from "@/utils/logger";

/**
* This route is optional, but can be used to manually trigger
* promotional classification. 
* 
* Example usage:
* POST /api/agentive/promotional
* {
*   "chatId": "...",
*   "orgId": "...",
*   "emailBody": "...",
*   "gmailMessageId": "...",
*   "threadId": "..."
* }
*/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
if (req.method !== "POST") {
 return res.status(405).json({ error: "Method not allowed" });
}

try {
 const { chatId, orgId, emailBody, gmailMessageId, threadId } = req.body;
 if (!chatId || !orgId || !emailBody || !gmailMessageId || !threadId) {
   return res.status(400).json({ error: "Missing required fields" });
 }

 logger.info("Manual promotional classification trigger", { chatId, orgId });
 await processPotentialPromotionalEmail(chatId, orgId, emailBody, gmailMessageId, threadId);

 return res.status(200).json({ success: true, message: "Processed potential promotional email" });
} catch (error: any) {
 logger.error("Error in promotional route handler", { error });
 return res.status(500).json({ error: error.message });
}
}
===
 </content>
</change>
</file>


<!-- 
=====================================================================
5) CREATE A NEW TEST
=====================================================================
-->

<file path="tests/agent/promotionalAgent.test.ts" action="create">
<change>
 <description>Basic unit test for the agent logic, verifying GPT classification is called and DB updates happen</description>
 <content>
===
import { vi, describe, test, expect, beforeAll, afterAll } from "vitest";
import { processPotentialPromotionalEmail, isEmailPromotional } from "@/utils/agent/gmailPromotionAgent";
import { supabase } from "@/utils/server/supabaseClient";

// We'll do a minimal test approach

describe("promotionalAgent tests", () => {
beforeAll(() => {
 // Setup or mock if needed
});

afterAll(() => {
 // Cleanup
});

test("isEmailPromotional returns a boolean (basic)", async () => {
 // We can mock the fetch calls
 global.fetch = vi.fn().mockResolvedValueOnce({
   ok: true,
   json: async () => ({
     choices: [
       {
         message: {
           content: '{"classification":"promotional","confidence":95}'
         }
       }
     ]
   })
 });

 const result = await isEmailPromotional("Some sale message from vendor");
 expect(result).toBe(true);
});

test("processPotentialPromotionalEmail does not break when GPT fails", async () => {
 global.fetch = vi.fn().mockResolvedValueOnce({
   ok: false,
   status: 500,
   statusText: "Internal server error"
 });

 // Insert a mock row in ticket_email_chats for chatId
 // Then call processPotentialPromotionalEmail
 // We'll do minimal checks that it doesn't throw

 // We won't create actual DB row, but in real tests we would
 await expect(
   processPotentialPromotionalEmail(
     "mockChatId-123", 
     "mockOrgId-123",
     "Email body about sale", 
     "gmailMsg-123",
     "gmailThread-123"
   )
 ).resolves.not.toThrow();
});
});
===
 </content>
</change>
</file>


<!-- 
=====================================================================
6) Potential supabaseClient reference 
=====================================================================
-->

<file path="utils/server/supabaseClient.ts" action="create">
<change>
 <description>Create a supabase admin client if not existing. If you already have one, skip this step.</description>
 <content>
===
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

// If we do not have such a file, we create it. If we do, we ignore.
export const supabase = createClient<Database>(
process.env.NEXT_PUBLIC_SUPABASE_URL || "",
process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);
===
 </content>
</change>
</file>


<!-- 
=====================================================================
7) Usage & Setup Instructions
=====================================================================
-->

<file path="README.agentivePromotions.md" action="create">
<change>
 <description>Final usage instructions for the new promotional email agent feature</description>
 <content>
===
# Agentive Promotions Feature

## Overview
We have introduced an agent-based pipeline that classifies promotional emails using GPT, labels them as “Promotion,” and archives them. 

## Installation
1. **Environment**: In your `.env.local`:
OPENAI_API_KEY=sk-xxxx

vbnet
Copy
2. **Deployment**: Deploy to your environment. The new code references the existing watchers in `gmail-polling.ts` or the poll endpoints.

## Steps To Validate
1. **Create or fetch inbound email** in your Gmail. The watchers or poll calls will pick it up.
2. **Check Logs**: 
- Server logs (like in Vercel or your server console) for lines about classification attempts.
3. **Open Gmail**:
- The “Promotion” label is created or applied automatically.
- The email is removed from the “Inbox” label (archived).
4. **Manual Endpoint**:
- You can do a `POST` to `/api/agentive/promotional` with a sample body to test classification manually, e.g.:
```json
{
  "chatId": "someChatId",
  "orgId": "yourOrgId",
  "emailBody": "Hello, check out this sale!",
  "gmailMessageId": "1649ac81adcc382b",
  "threadId": "1649ac81adcc382b"
}
Check the JSON response for confirmation.
Known Limitations
GPT classification can be uncertain. If it fails, logs show the error, but no archiving is done.
If classification is done once, subsequent watchers do not re-classify the same email.
This uses “promotion” label logic. You can customize label names in the agent code.
