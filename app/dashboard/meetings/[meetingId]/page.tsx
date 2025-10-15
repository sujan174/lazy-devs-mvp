"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Clock, Users, MessageSquare, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface TranscriptSegment {
  speaker: string;
  text: string;
  start_ms: number;
  end_ms: number;
}

interface Meeting {
  id: string;
  title: string;
  transcript: TranscriptSegment[];
  speakerMap: Record<string, string>;
  unresolvedSpeakers: Array<{ label: string; audio_snippet_b64: string }>;
  createdAt: { _seconds: number; _nanoseconds: number };
  durationMs: number;
  totalSegments: number;
  totalSpeakers: number;
  unresolvedCount: number;
}

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.meetingId as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/meetings/${meetingId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch meeting');
        }

        const data = await response.json();
        setMeeting(data.meeting);
      } catch (err) {
        console.error('Error fetching meeting:', err);
        setError(err instanceof Error ? err.message : 'Failed to load meeting');
      } finally {
        setLoading(false);
      }
    };

    if (meetingId) {
      fetchMeeting();
    }
  }, [meetingId]);

  const formatDuration = (ms: number) => {
    if (!ms || ms < 0) return '0min';
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}min`;
    }
    return `${minutes}min`;
  };

  const formatTimestamp = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Meeting</h2>
        <p className="text-gray-600 mb-6">{error || 'Meeting not found'}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{meeting.title}</h1>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>
                  {meeting.createdAt 
                    ? format(new Date(meeting.createdAt._seconds * 1000), 'MMM d, yyyy')
                    : 'Date unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{formatDuration(meeting.durationMs)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{meeting.totalSpeakers} speakers</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span>{meeting.totalSegments} segments</span>
              </div>
            </div>

            {meeting.unresolvedCount > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <strong>{meeting.unresolvedCount}</strong> unidentified speaker(s). You can resolve them later.
              </div>
            )}
          </div>
        </div>

        {/* Transcript */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Transcript</h2>
          
          {meeting.transcript && meeting.transcript.length > 0 ? (
            <div className="space-y-4">
              {meeting.transcript.map((segment, index) => (
                <div key={index} className="flex gap-4 p-4 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-shrink-0 w-32">
                    <div className="font-semibold text-indigo-600">{segment.speaker}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatTimestamp(segment.start_ms)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-800 leading-relaxed">{segment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No transcript available for this meeting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}