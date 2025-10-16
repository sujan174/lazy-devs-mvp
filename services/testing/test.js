const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs'); // Import the Node.js File System module

// --- PASTE YOUR DECRYPTION LOGIC HERE ---
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
// IMPORTANT: You MUST provide the same secret key used for encryption.
// It's best to load this from an environment variable.
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_SECRET || 'XBviaLAY1BdIbF70GUVfY1nYDVM8FiYa', 'utf8');

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_SECRET must be 32 bytes (32 characters) long.');
}

function decrypt(text) {
  try {
    const textParts = text.split(':');
    if (textParts.length < 2) {
      throw new Error("Invalid encrypted text format. Expected 'iv:encrypted'.");
    }
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("Decryption failed. Check your ENCRYPTION_SECRET and the encrypted token.", error);
    throw error;
  }
}

// --- TEST CONFIGURATION ---
// Replace these values with your actual test data.
const API_ENDPOINT = 'http://127.0.0.1:8000/process-transcript';
const ENCRYPTED_CLICKUP_TOKEN = "62cc2b6fd8bc580f4b662b951835c955:8b109a1a552aad7487e9bb1d2931885b68995bbf0de4293dac69c775bcc8f18d69e474f0f21c81f79ea91329208ba401aefb81d5c61e914d712dddf78f9559c628d1b9f6942c7e06109d5032a5f72df9";
const CLICKUP_SPACE_ID = '90165129622';
const TRANSCRIPT_TO_PROCESS = `[
  {
  "speaker": "Rupesh",
    "text": "Okay. So is everyone here? Hello?",
    "start_ms": 1680,
    "end_ms": 7200
  },
  {
    "speaker": "Shrujan",
    "text": "Yeah.",
    "start_ms": 9040,
    "end_ms": 9400
  },
  {
    "speaker": "sujan",
    "text": "Yeah.",
    "start_ms": 9400,
    "end_ms": 9760
  },
  {
    "speaker": "Rupesh",
    "text": "Yes. Good. So let's do a quick planning session. Let's start with the current board. Srujan, what's the latest main search API? The board says it's in review right now.",
    "start_ms": 10240,
    "end_ms": 28170
  },
  {
    "speaker": "sujan",
    "text": "Okay, I'll take that. I just finished the code review for it. Logic looks good enough. I just left one minor comment from the PR about adding some extra error handling for invalid zip codes. It's a small change, but it's important, so I'll address that later.",
    "start_ms": 30650,
    "end_ms": 50810
  },
  {
    "speaker": "Shrujan",
    "text": "Okay. Yeah, I just saw the comment right now. Thanks, Sujan. I'll make sure that change is pushed up by this afternoon. So right now there is no change in the status, but it's still in review.",
    "start_ms": 53060,
    "end_ms": 66340
  },
  {
    "speaker": "Rupesh",
    "text": "Okay, that's perfect. Let's talk about that. There was a search filter bug, right? The one where the location times. Where the location times out. The board says. The board says you're assigned on it.",
    "start_ms": 67620,
    "end_ms": 85300
  },
  {
    "speaker": "Shrujan",
    "text": "Yeah, about that. There's a good news on that. I found the root cause. It was a super inefficient database query and now I've completely rewritten it. So the fix is now live on the staging environment and it's ready for a full regression test. I'm pretty sure I can handle the QA myself.",
    "start_ms": 87860,
    "end_ms": 110190
  },
  {
    "speaker": "Rupesh",
    "text": "Okay, great work. That was a critical one. Now let's talk about the patient dashboard. Rick, how's the basic UI component coming.",
    "start_ms": 111470,
    "end_ms": 120990
  },
  {
    "speaker": "Unknown Speaker 1",
    "text": "Along.",
    "start_ms": 120990,
    "end_ms": 121310
  },
  {
    "speaker": "wrick",
    "text": "As we are talking about the ui? It's going well. I should have wrapped it by the end of the day. One thing I noticed while looking at the designs, we do not really have way for the new patients to fill out their intake forms and medical history. They have to do it all over the phone right now, which is, you know, I mean, it's not ideal.",
    "start_ms": 124510,
    "end_ms": 147800
  },
  {
    "speaker": "sujan",
    "text": "Ah, that's a huge opportunity for improvement. We can build some secure multi page digital intake from that they will fill right on the dashboard and after they sign up.",
    "start_ms": 149640,
    "end_ms": 159890
  },
  {
    "speaker": "Rupesh",
    "text": "Yeah, I love that. It would take our support team. It would save our support team so much time. Okay, let's scope this out. Sujan, can you take the lead on a new task to design the UI for a multi page digital patient intake form. It should have sections for medical history, insurance info, and I think also personal therapy goals.",
    "start_ms": 160770,
    "end_ms": 188040
  },
  {
    "speaker": "Shrujan",
    "text": "Yeah, yeah, sure.",
    "start_ms": 188520,
    "end_ms": 190680
  },
  {
    "speaker": "sujan",
    "text": "Got it.",
    "start_ms": 190680,
    "end_ms": 191240
  },
  {
    "speaker": "Rupesh",
    "text": "Okay, now for the back end. We need to save this new form data. How should we store it exactly? What do you guys think?",
    "start_ms": 192200,
    "end_ms": 205880
  },
  {
    "speaker": "Shrujan",
    "text": "I have an idea. We can probably extend our main user database schema. It would be structured and easy to query.",
    "start_ms": 207880,
    "end_ms": 217270
  },
  {
    "speaker": "wrick",
    "text": "I partially agree with you, but storing it as a flexible JSON blob in a separate document store is much faster to implement and it allows the product team to add new questions to the form without requiring a database migration every time. It's a classic structure versus physical flexibility debate.",
    "start_ms": 220070,
    "end_ms": 240970
  },
  {
    "speaker": "Unknown Speaker 1",
    "text": "Okay, okay.",
    "start_ms": 240970,
    "end_ms": 241570
  },
  {
    "speaker": "Rupesh",
    "text": "Yeah, I mean, both are valid points, but we can't resolve this right now. We'll see it later.",
    "start_ms": 241570,
    "end_ms": 248170
  },
  {
    "speaker": "Unknown Speaker 1",
    "text": "Right.",
    "start_ms": 248170,
    "end_ms": 248570
  },
  {
    "speaker": "Rupesh",
    "text": "It's back end work for this feature. We need a final decision on this offline. Let's move on. Srujan, any updates on the therapist profile?",
    "start_ms": 249290,
    "end_ms": 259650
  },
  {
    "speaker": "Shrujan",
    "text": "Um, I'm actually blocked on that one because I can't build the UI until we have the final API which fetches all the therapists data such as their specialty, their bio and picture, etc. Etc. So I don't think we still have a ticket for that API yet.",
    "start_ms": 259650,
    "end_ms": 281080
  },
  {
    "speaker": "Rupesh",
    "text": "Yeah, yeah, I think, I think you're right. That is a huge gap, meaning that API. Let's get a new task, let's sort it out. Sujan, this one's for you, I think.",
    "start_ms": 282600,
    "end_ms": 295800
  },
  {
    "speaker": "Unknown Speaker 1",
    "text": "Right.",
    "start_ms": 295800,
    "end_ms": 296160
  },
  {
    "speaker": "Rupesh",
    "text": "The title should be Build API to fetch Therapist profile data or something. You can decide it on your own, but this will unblock the UI work.",
    "start_ms": 296640,
    "end_ms": 306720
  },
  {
    "speaker": "Unknown Speaker 1",
    "text": "Right?",
    "start_ms": 306720,
    "end_ms": 307120
  },
  {
    "speaker": "Rupesh",
    "text": "Okay, so some important news, team. I'm excited to announce that new QA engineer Anika will be joining us next week and she'll be taking over a lot of manual testing from Sujan, which should free him up for now and so he can focus on more develop development work.",
    "start_ms": 310960,
    "end_ms": 331990
  },
  {
    "speaker": "sujan",
    "text": "That's nice. While we have everyone here, I want to propose a new process, GitHub. It's very hard to track.",
    "start_ms": 334630,
    "end_ms": 350540
  },
  {
    "speaker": "Rupesh",
    "text": "Okay, that's. That's a great point. We need to standardize, standardize this. Okay, team, new rule. From now on, all code reviews feedback must be submitted as a comment on the GitHub pull request itself.",
    "start_ms": 353580,
    "end_ms": 369280
  },
  {
    "speaker": "Unknown Speaker 1",
    "text": "Itself. Right.",
    "start_ms": 369350,
    "end_ms": 370630
  },
  {
    "speaker": "Rupesh",
    "text": "No more feedback in Slack or email. This is an official team progress change, so everyone must follow it.",
    "start_ms": 371270,
    "end_ms": 378150
  },
  {
    "speaker": "Unknown Speaker 1",
    "text": "Right.",
    "start_ms": 378150,
    "end_ms": 378470
  },
  {
    "speaker": "Rupesh",
    "text": "And now let's talk about the booking system. I think that was also left in our discussion for today. I was looking at the board and the design task for the payment flow is assigned to Sujan.",
    "start_ms": 379190,
    "end_ms": 389350
  },
  {
    "speaker": "Unknown Speaker 1",
    "text": "Right.",
    "start_ms": 389590,
    "end_ms": 389990
  },
  {
    "speaker": "Rupesh",
    "text": "Sujan, you're a lead designer on the features. I think you should be the one to handle it then. Srujan.",
    "start_ms": 391030,
    "end_ms": 400080
  },
  {
    "speaker": "sujan",
    "text": "Yeah, I think that makes sense. I'll do it.",
    "start_ms": 402000,
    "end_ms": 403760
  },
  {
    "speaker": "Rupesh",
    "text": "All right. So is Sujan okay with that?",
    "start_ms": 405440,
    "end_ms": 408560
  },
  {
    "speaker": "Shrujan",
    "text": "Yeah, yeah, it's cool.",
    "start_ms": 410000,
    "end_ms": 411840
  },
  {
    "speaker": "Rupesh",
    "text": "All right. All right, so I'm reassigning the task to design the multi step booking and payment flow from Srujan to Sujan.",
    "start_ms": 411840,
    "end_ms": 420120
  },
  {
    "speaker": "Unknown Speaker 1",
    "text": "Now.",
    "start_ms": 420120,
    "end_ms": 420400
  },
  {
    "speaker": "Rupesh",
    "text": "You'Ll be on the front end. Built for that. Once the designs are ready.",
    "start_ms": 422910,
    "end_ms": 428590
  },
  {
    "speaker": "Shrujan",
    "text": "Sure.",
    "start_ms": 430350,
    "end_ms": 430750
  },
  {
    "speaker": "Rupesh",
    "text": "Yeah. Does the team have any more questions or anything?",
    "start_ms": 431710,
    "end_ms": 434750
  },
  {
    "speaker": "Unknown Speaker 1",
    "text": "Is that it? Nope.",
    "start_ms": 437470,
    "end_ms": 438470
  },
  {
    "speaker": "sujan",
    "text": "It's all good, bro. That's it for now.",
    "start_ms": 438470,
    "end_ms": 440030
  },
  {
    "speaker": "Rupesh",
    "text": "All right. That was very productive session. We have a clear path forward, and let's keep the board updated. Thanks.",
    "start_ms": 440430,
    "end_ms": 446270
  }
]`;
const OUTPUT_FILENAME = 'ai_response.json'; // Define the output filename

// --- MAIN EXECUTION ---
async function runTest() {
  console.log('Attempting to decrypt ClickUp token...');
  
  // 1. Decrypt the token before sending
  const decryptedToken = decrypt(ENCRYPTED_CLICKUP_TOKEN);
  console.log('Token decrypted successfully.');

  // 2. Prepare the request payload
  const payload = {
    space_id: CLICKUP_SPACE_ID,
    transcript: TRANSCRIPT_TO_PROCESS,
  };

  // 3. Prepare the request headers
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${decryptedToken}`,
  };

  console.log(`Sending POST request to ${API_ENDPOINT}...`);

  // 4. Make the API call
  try {
    const response = await axios.post(API_ENDPOINT, payload, { headers });
    console.log('\n--- ✅ SUCCESS! ---');
    console.log('Received response from the service.');

    // --- NEW: Parse and Save JSON Logic ---
    const aiResponseString = response.data.ai_response;

    // Clean the string to remove markdown backticks and "json" label
    const jsonString = aiResponseString.replace(/```json\n/g, '').replace(/\n```/g, '');

    try {
      // Parse the cleaned string into a JavaScript object
      const parsedJson = JSON.parse(jsonString);

      // Save the parsed object to a file with pretty formatting
      fs.writeFileSync(OUTPUT_FILENAME, JSON.stringify(parsedJson, null, 2));
      console.log(`✅ Successfully parsed and saved the AI response to '${OUTPUT_FILENAME}'`);
    } catch (parseError) {
      console.error('--- ❌ PARSING ERROR ---');
      console.error('Could not parse the AI response string into valid JSON.', parseError);
      console.log('Raw string received:', aiResponseString);
    }
    // --- END NEW LOGIC ---

  } catch (error) {
    console.error('\n--- ❌ ERROR ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received from the server. Is the Docker container running?');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Check if the secret key is still the placeholder
if (ENCRYPTION_KEY.toString('utf8') === 'YOUR_32_BYTE_ENCRYPTION_SECRET_HERE') {
    console.warn("WARNING: You are using the default placeholder for ENCRYPTION_SECRET. Please replace it.");
}

runTest();

