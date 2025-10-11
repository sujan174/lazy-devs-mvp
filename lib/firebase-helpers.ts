// ==============================================
// lib/firebase-helpers.ts (HELPER FUNCTIONS - NEW FILE)
// ==============================================

import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

/**
 * CLIENT-SIDE: Fetch meetings for a team
 * Use this in your React components
 */
export async function getTeamMeetings(teamId: string) {
  try {
    const meetingsRef = collection(db, 'meetings');
    const q = query(
      meetingsRef,
      where('teamId', '==', teamId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching meetings:', error);
    throw error;
  }
}

/**
 * CLIENT-SIDE: Get a single meeting
 */
export async function getMeeting(meetingId: string) {
  try {
    const meetingRef = doc(db, 'meetings', meetingId);
    const meetingDoc = await getDoc(meetingRef);
    
    if (!meetingDoc.exists()) {
      return null;
    }
    
    return {
      id: meetingDoc.id,
      ...meetingDoc.data()
    };
  } catch (error) {
    console.error('Error fetching meeting:', error);
    throw error;
  }
}

/**
 * CLIENT-SIDE: Get team members with voiceprints
 */
export async function getTeamMembers(teamId: string) {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('teamId', '==', teamId));
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching team members:', error);
    throw error;
  }
}