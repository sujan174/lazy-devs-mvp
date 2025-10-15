"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, ArrowLeft, Clock, Users, MessageSquare, AlertCircle, User as UserIcon, Bot, ListTodo } from "lucide-react";
import { format } from "date-fns";

// --- Type Definitions for Data Structures ---
interface TranscriptSegment {
  speaker: string;
  text: string;
  start_ms: number;
  end_ms: number;
}

// Action types from ClickUp AI Agent
interface ActionItem {
  action: 'create' | 'update' | 'comment' | 'close' | 'flag' | 'meta';
  id?: string; // Task ID for update/comment/close actions
  data: {
    // For create actions
    task_name?: string;
    list_id?: string;
    description?: string;
    assignees?: number[];
    status?: string;
    priority?: number;
    due_date?: string;
    tags?: string[];
    custom_fields?: Array<{ id: string; value: any }>;
    
    // For update actions
    updates?: {
      name?: string;
      description?: string;
      status?: string;
      assignees?: number[];
      priority?: number;
      due_date?: string;
    };
    dependencies?: {
      add?: string[];
      remove?: string[];
    };
    
    // For comment actions
    comment?: string;
    
    // For flag actions
    summary?: string;
    context?: string;
    parties?: string[];
    
    // For meta actions
    type?: string;
    name?: string;
    details?: string;
  };
  reasoning?: string;
}

interface Meeting {
  id: string;
  title: string;
  transcript: TranscriptSegment[];
  speakerMap: Record<string, string>;
  unresolvedSpeakers: Array<{ label: string; audio_snippet_b64: string }>;
  createdAt: any;
  durationMs: number;
  totalSegments: number;
  totalSpeakers: number;
  unresolvedCount: number;
  status?: 'processing' | 'transcribed' | 'resolving' | 'completed';
  actions?: ActionItem[];
}

// --- Helper Components for UI ---
const InfoPill = ({ icon: Icon, text }: { icon: React.ElementType, text: string }) => (
  <div className="flex items-center gap-2"><Icon className="w-4 h-4 text-gray-500" /><span className="text-gray-700">{text}</span></div>
);

const formatTimestamp = (ms: number) => { 
  const s = Math.floor(ms / 1000); 
  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2, '0')}`; 
};

const formatDuration = (ms: number) => { 
  if (!ms || ms < 0) return '0min'; 
  const m = Math.floor(ms / 60000); 
  const h = Math.floor(m / 60); 
  if (h > 0) return `${h}h ${m % 60}min`; 
  return `${m}min`; 
};

// --- Helper function to safely convert Firestore timestamp to Date ---
const getDateFromTimestamp = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  
  try {
    // Handle Firestore Timestamp object with toDate() method
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Handle object with _seconds property (serialized Timestamp)
    if (timestamp._seconds !== undefined) {
      return new Date(timestamp._seconds * 1000);
    }
    
    // Handle ISO string or timestamp number
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Handle Date object
    if (timestamp instanceof Date) {
      return isNaN(timestamp.getTime()) ? null : timestamp;
    }
    
    return null;
  } catch (err) {
    console.error('Error parsing timestamp:', err);
    return null;
  }
};

// --- Helper function to format date safely ---
const formatMeetingDate = (timestamp: any): string => {
  const date = getDateFromTimestamp(timestamp);
  if (!date) return 'Date unknown';
  
  try {
    return format(date, 'MMM d, yyyy');
  } catch (err) {
    console.error('Error formatting date:', err);
    return 'Date unknown';
  }
};

// --- Main Page Component ---
export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.meetingId as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!meetingId) return;
    
    // --- Use a real-time listener (onSnapshot) ---
    const meetingRef = doc(db, "meetings", meetingId);
    const unsubscribe = onSnapshot(meetingRef, (doc) => {
        if (doc.exists()) {
            setMeeting({ id: doc.id, ...doc.data() } as Meeting);
        } else {
            setError("Meeting not found.");
        }
        setLoading(false);
    }, (err) => {
        console.error("Error fetching meeting in real-time:", err);
        setError("Failed to load meeting data.");
        setLoading(false);
    });

    // Cleanup the listener on component unmount
    return () => unsubscribe();
  }, [meetingId]);

  const handleGenerateActions = async () => {
    setIsGenerating(true);
    setError(null);
    try {
        const response = await fetch(`/api/meetings/${meetingId}/generate-actions`, {
            method: 'POST',
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to start action generation.");
        }
        // No need to do anything else here. The onSnapshot listener will
        // automatically detect the change and update the UI when the actions are ready.
    } catch (err: any) {
        setError(err.message);
        setIsGenerating(false); // Stop loading on error
    }
  };

  // --- Logic for Assigning Speaker Colors ---
  const speakerColors: Record<string, { border: string; bg: string; text: string }> = {};
  const colors = [
    { border: "border-blue-500", bg: "bg-blue-50", text: "text-blue-800" },
    { border: "border-green-500", bg: "bg-green-50", text: "text-green-800" },
    { border: "border-yellow-500", bg: "bg-yellow-50", text: "text-yellow-800" },
    { border: "border-purple-500", bg: "bg-purple-50", text: "text-purple-800" },
    { border: "border-pink-500", bg: "bg-pink-50", text: "text-pink-800" },
    { border: "border-teal-500", bg: "bg-teal-50", text: "text-teal-800" },
  ];
  let colorIndex = 0;

  const getSpeakerColorClasses = (speaker: string) => {
    if (!speakerColors[speaker]) {
      speakerColors[speaker] = colors[colorIndex % colors.length];
      colorIndex++;
    }
    return speakerColors[speaker];
  };

  // --- Render Logic ---
  if (loading) { 
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    ); 
  }
  
  if (error || !meeting) { 
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Meeting</h2>
        <p className="text-gray-600 mb-6 max-w-md">{error || 'The meeting could not be found or you do not have permission to view it.'}</p>
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

  const hasActions = meeting.actions && meeting.actions.length > 0;
  const isProcessing = meeting.status === 'processing' || isGenerating;

  // Helper function to get action badge color
  const getActionBadge = (action: string) => {
    const badges = {
      create: { bg: 'bg-green-100', text: 'text-green-800', label: 'Create Task', icon: '➕' },
      update: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Update Task', icon: '✏️' },
      comment: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Comment', icon: '💬' },
      close: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Close Task', icon: '✓' },
      flag: { bg: 'bg-red-100', text: 'text-red-800', label: 'Flag Issue', icon: '🚩' },
      meta: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Team Update', icon: '📋' },
    };
    return badges[action as keyof typeof badges] || badges.update;
  };

  // Helper function to get action description
  const getActionDescription = (actionItem: ActionItem) => {
    const { action, data, id } = actionItem;
    
    switch (action) {
      case 'create':
        return data.task_name || 'Create new task';
      case 'update':
        if (data.dependencies?.add?.length) {
          return `Add dependency to task`;
        }
        return data.updates?.name || `Update task details`;
      case 'comment':
        return data.comment || 'Add comment to task';
      case 'close':
        return `Close task`;
      case 'flag':
        return data.summary || 'Flag for attention';
      case 'meta':
        return data.name || 'Team update';
      default:
        return 'Action item';
    }
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <button 
            onClick={() => router.push('/dashboard')} 
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Meetings
          </button>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h1 className="text-3xl font-bold text-gray-900">{meeting.title}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
                <InfoPill icon={Clock} text={formatMeetingDate(meeting.createdAt)} />
                <InfoPill icon={Clock} text={formatDuration(meeting.durationMs)} />
                <InfoPill icon={Users} text={`${meeting.totalSpeakers} speakers`} />
                <InfoPill icon={MessageSquare} text={`${meeting.totalSegments} segments`} />
            </div>
            {meeting.unresolvedCount > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-sm text-yellow-800">
                <strong>{meeting.unresolvedCount}</strong> unidentified speaker(s) need your attention.
                <a href="#" className="font-semibold underline ml-2 hover:text-yellow-900">Resolve Now</a>
              </div>
            )}
          </div>
        </div>
        
        {/* --- Actions Section --- */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4 px-2">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <ListTodo className="w-5 h-5 mr-3 text-indigo-600"/>
              Action Items
            </h2>
            {!hasActions && (
                 <button 
                   onClick={handleGenerateActions} 
                   disabled={isProcessing} 
                   className="btn-primary inline-flex items-center disabled:opacity-50"
                 >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Bot className="w-4 h-4 mr-2"/>
                        Generate Actions
                      </>
                    )}
                 </button>
            )}
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            {isProcessing && !hasActions && (
                <div className="text-center py-10 text-gray-500">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-500 mb-3"/>
                    <p className="font-medium">AI is analyzing your transcript...</p>
                    <p className="text-sm">This may take a minute. The results will appear here automatically.</p>
                </div>
            )}
            {hasActions && (
                <div className="space-y-3">
                    {meeting.actions?.map((actionItem, index) => {
                      const badge = getActionBadge(actionItem.action);
                      const description = getActionDescription(actionItem);
                      
                      return (
                        <div key={index} className="p-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-200 hover:shadow-sm transition-all">
                          {/* Action Header */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badge.bg} ${badge.text} flex items-center gap-1`}>
                                <span>{badge.icon}</span>
                                {badge.label}
                              </span>
                              {actionItem.id && (
                                <span className="text-xs text-gray-400 font-mono">#{actionItem.id}</span>
                              )}
                            </div>
                          </div>
                          
                          {/* Action Content based on type */}
                          {actionItem.action === 'comment' && actionItem.data.comment && (
                            <div className="p-3 bg-purple-50 rounded-lg border-l-3 border-purple-400">
                              <p className="text-sm text-gray-800 leading-relaxed">{actionItem.data.comment}</p>
                            </div>
                          )}
                          
                          {actionItem.action === 'flag' && (
                            <div className="space-y-3">
                              {actionItem.data.summary && (
                                <div className="p-3 bg-red-50 rounded-lg border-l-3 border-red-400">
                                  <p className="text-sm font-semibold text-red-900 mb-2">⚠️ {actionItem.data.summary}</p>
                                  {actionItem.data.context && (
                                    <p className="text-sm text-gray-700 leading-relaxed">{actionItem.data.context}</p>
                                  )}
                                </div>
                              )}
                              {actionItem.data.parties && actionItem.data.parties.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <span className="text-xs text-gray-500 font-semibold">Involved:</span>
                                  {actionItem.data.parties.map((party, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                                      {party}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {actionItem.action === 'meta' && (
                            <div className="space-y-2">
                              {actionItem.data.name && (
                                <p className="text-sm font-semibold text-gray-900">{actionItem.data.name}</p>
                              )}
                              {actionItem.data.details && (
                                <div className="p-3 bg-yellow-50 rounded-lg border-l-3 border-yellow-400">
                                  <p className="text-sm text-gray-700 leading-relaxed">{actionItem.data.details}</p>
                                </div>
                              )}
                              {actionItem.data.type && (
                                <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                                  {actionItem.data.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </span>
                              )}
                            </div>
                          )}
                          
                          {actionItem.action === 'update' && (
                            <div className="space-y-2">
                              {actionItem.data.dependencies?.add && actionItem.data.dependencies.add.length > 0 && (
                                <div className="p-3 bg-blue-50 rounded-lg">
                                  <p className="text-sm text-gray-700">
                                    <span className="font-semibold">Adding dependency:</span>{' '}
                                    {actionItem.data.dependencies.add.map((depId, idx) => (
                                      <span key={idx} className="inline-block ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                                        #{depId}
                                      </span>
                                    ))}
                                  </p>
                                </div>
                              )}
                              {actionItem.data.updates && (
                                <div className="text-sm space-y-1">
                                  {actionItem.data.updates.status && (
                                    <p className="text-gray-600">
                                      <span className="font-semibold">New Status:</span> {actionItem.data.updates.status}
                                    </p>
                                  )}
                                  {actionItem.data.updates.description && (
                                    <p className="text-gray-600">{actionItem.data.updates.description}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {actionItem.action === 'create' && (
                            <div className="space-y-2">
                              {actionItem.data.description && (
                                <p className="text-sm text-gray-600">{actionItem.data.description}</p>
                              )}
                              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                                {actionItem.data.status && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold">Status:</span> {actionItem.data.status}
                                  </span>
                                )}
                                {actionItem.data.due_date && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span className="font-semibold">Due:</span> {actionItem.data.due_date}
                                  </span>
                                )}
                                {actionItem.data.priority && (
                                  <span className="flex items-center gap-1">
                                    <span className="font-semibold">Priority:</span> {actionItem.data.priority}
                                  </span>
                                )}
                              </div>
                              {actionItem.data.tags && actionItem.data.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {actionItem.data.tags.map((tag, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Reasoning */}
                          {actionItem.reasoning && (
                            <details className="mt-3 text-xs text-gray-500">
                              <summary className="cursor-pointer hover:text-gray-700 font-medium">
                                View AI Reasoning
                              </summary>
                              <p className="mt-2 pl-2 border-l-2 border-gray-200">{actionItem.reasoning}</p>
                            </details>
                          )}
                        </div>
                      );
                    })}
                </div>
            )}
            {!isProcessing && !hasActions && (
                 <div className="text-center py-10 text-gray-500">
                    <p>No action items have been generated for this meeting yet.</p>
                </div>
            )}
          </div>
        </div>
        {/* End Actions Section */}

        {/* Transcript Section */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 px-2">Transcript</h2>
          {meeting.transcript && meeting.transcript.length > 0 ? (
            <div className="space-y-6">
              {meeting.transcript.map((segment, index) => {
                const colorClasses = getSpeakerColorClasses(segment.speaker);
                return (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-24 text-right font-mono text-sm text-gray-500 pt-1">
                      {formatTimestamp(segment.start_ms)}
                    </div>
                    <div className={`flex-1 border-l-4 ${colorClasses.border} pl-4`}>
                      <p className={`font-semibold ${colorClasses.text} flex items-center`}>
                        <UserIcon className="w-4 h-4 mr-2 opacity-70"/>
                        {segment.speaker}
                      </p>
                      <p className="mt-1 text-gray-800 leading-relaxed">{segment.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-gray-200">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>No transcript is available for this meeting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}