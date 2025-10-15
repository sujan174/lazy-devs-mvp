// ==============================================
// lib/firebase-admin.ts (SERVER-SIDE)
// ==============================================

import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // 1. Get the Base64 encoded service account from environment variables
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccountBase64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 environment variable is not set. Please add it to your .env.local file.');
    }

    // 2. Decode the Base64 string back into a standard string
    const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf-8');
    
    // 3. Parse the string into a JSON object
    const serviceAccount = JSON.parse(serviceAccountJson);

    // 4. Initialize Firebase Admin with the decoded credentials
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin initialized successfully using Base64 credentials.');
  } catch (error) {
    console.error('🔥 Firebase Admin initialization error:', error);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();


// ============================================
// VOICEPRINT FUNCTIONS
// ============================================

/**
 * Converts a float array into base64-encoded Float32 bytes
 */
function floatArrayToBase64(floatArr: number[]): string {
  const buffer = Buffer.alloc(floatArr.length * 4);
  for (let i = 0; i < floatArr.length; i++) {
    buffer.writeFloatLE(floatArr[i], i * 4);
  }
  return buffer.toString('base64');
}

/**
 * Fetches all voiceprints for team members
 * Returns a map of { userName: voiceprint_base64 }
 */
export async function fetchTeamVoiceprints(teamId: string): Promise<Record<string, string>> {
  try {
    console.log(`📊 Fetching voiceprints for team: ${teamId}`);

    const usersSnapshot = await adminDb
      .collection('users')
      .where('teamId', '==', teamId)
      .get();

    if (usersSnapshot.empty) {
      console.log(`⚠️ No users found for team: ${teamId}`);
      return {};
    }

    const voiceprints: Record<string, string> = {};

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const userName = userData.name;
      const voiceprint = userData.voiceprint;

      if (voiceprint && Array.isArray(voiceprint) && voiceprint.length > 0) {
        const encoded = floatArrayToBase64(voiceprint);
        voiceprints[userName] = encoded;
        console.log(`  ✅ Encoded voiceprint for: ${userName} (${voiceprint.length} floats)`);
      } else {
        console.log(`  ⚠️ No voiceprint for: ${userName}`);
      }
    });

    console.log(`📊 Total voiceprints found: ${Object.keys(voiceprints).length}`);
    return voiceprints;
  } catch (error) {
    console.error('Error fetching team voiceprints:', error);
    throw new Error(`Failed to fetch voiceprints for team ${teamId}`);
  }
}


// ============================================
// MEETING FUNCTIONS
// ============================================

interface TranscriptSegment {
  speaker: string;
  text: string;
  start_ms: number;
  end_ms: number;
}

interface UnresolvedSpeaker {
  label: string;
  audio_snippet_b64?: string;
}

interface MeetingData {
  teamId: string;
  meetingTitle: string;
  transcript: TranscriptSegment[];
  speakerMap: Record<string, string>;
  unresolvedSpeakers: UnresolvedSpeaker[];
  uploadedBy?: string; // Optional: userId of uploader
}

/**
 * Saves a processed meeting to Firestore
 * Returns the meetingId
 */
export async function saveMeetingToDB(meetingData: MeetingData): Promise<string> {
  try {
    console.log(`💾 Saving meeting: ${meetingData.meetingTitle}`);

    const meetingRef = adminDb.collection('meetings').doc();
    const meetingId = meetingRef.id;

    const meetingDocument = {
      id: meetingId,
      teamId: meetingData.teamId,
      title: meetingData.meetingTitle,
      transcript: meetingData.transcript,
      speakerMap: meetingData.speakerMap,
      unresolvedSpeakers: meetingData.unresolvedSpeakers,
      uploadedBy: meetingData.uploadedBy || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Additional metadata
      totalSegments: meetingData.transcript.length,
      totalSpeakers: Object.keys(meetingData.speakerMap).length,
      unresolvedCount: meetingData.unresolvedSpeakers.length,
      // Calculate duration from transcript
      durationMs: meetingData.transcript.length > 0 
        ? meetingData.transcript[meetingData.transcript.length - 1].end_ms 
        : 0,
    };

    await meetingRef.set(meetingDocument);
    console.log(`✅ Meeting saved successfully with ID: ${meetingId}`);

    return meetingId;
  } catch (error) {
    console.error('Error saving meeting to database:', error);
    throw new Error('Failed to save meeting to database');
  }
}

/**
 * Fetches all meetings for a specific team
 */
export async function fetchTeamMeetings(teamId: string): Promise<any[]> {
  try {
    const meetingsSnapshot = await adminDb
      .collection('meetings')
      .where('teamId', '==', teamId)
      .orderBy('createdAt', 'desc')
      .get();

    const meetings = meetingsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return meetings;
  } catch (error) {
    console.error('Error fetching team meetings:', error);
    throw new Error('Failed to fetch team meetings');
  }
}

/**
 * Fetches a single meeting by ID
 */
export async function fetchMeetingById(meetingId: string): Promise<any | null> {
  try {
    const meetingDoc = await adminDb.collection('meetings').doc(meetingId).get();

    if (!meetingDoc.exists) {
      return null;
    }

    return {
      id: meetingDoc.id,
      ...meetingDoc.data(),
    };
  } catch (error) {
    console.error('Error fetching meeting:', error);
    throw new Error('Failed to fetch meeting');
  }
}

/**
 * Updates unresolved speakers after manual resolution
 */
export async function updateMeetingSpeakers(
  meetingId: string,
  speakerResolutions: Record<string, string>
): Promise<void> {
  try {
    const meetingRef = adminDb.collection('meetings').doc(meetingId);
    const meetingDoc = await meetingRef.get();

    if (!meetingDoc.exists) {
      throw new Error('Meeting not found');
    }

    const meetingData = meetingDoc.data();
    const transcript = meetingData?.transcript || [];

    // Update transcript with resolved speaker names
    const updatedTranscript = transcript.map((segment: TranscriptSegment) => ({
      ...segment,
      speaker: speakerResolutions[segment.speaker] || segment.speaker,
    }));

    // Update speaker map
    const updatedSpeakerMap = { ...meetingData?.speakerMap };
    Object.keys(speakerResolutions).forEach((oldLabel) => {
      updatedSpeakerMap[oldLabel] = speakerResolutions[oldLabel];
    });

    // Remove resolved speakers from unresolved list
    const updatedUnresolvedSpeakers = (meetingData?.unresolvedSpeakers || []).filter(
      (speaker: UnresolvedSpeaker) => !speakerResolutions[speaker.label]
    );

    await meetingRef.update({
      transcript: updatedTranscript,
      speakerMap: updatedSpeakerMap,
      unresolvedSpeakers: updatedUnresolvedSpeakers,
      unresolvedCount: updatedUnresolvedSpeakers.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Updated meeting ${meetingId} with resolved speakers`);
  } catch (error) {
    console.error('Error updating meeting speakers:', error);
    throw new Error('Failed to update meeting speakers');
  }
}

/**
 * Deletes a meeting
 */
export async function deleteMeeting(meetingId: string): Promise<void> {
  try {
    await adminDb.collection('meetings').doc(meetingId).delete();
    console.log(`✅ Deleted meeting: ${meetingId}`);
  } catch (error) {
    console.error('Error deleting meeting:', error);
    throw new Error('Failed to delete meeting');
  }
}

