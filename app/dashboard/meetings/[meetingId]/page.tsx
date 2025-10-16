"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { onSnapshot, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, ArrowLeft, Clock, Users, MessageSquare, AlertCircle, User, Bot, ListTodo, CheckCircle2, FileText } from "lucide-react";
import { format } from "date-fns";

// --- Type Definitions for Data Structures ---
interface TranscriptSegment {
  speaker: string;
  text: string;
  start_ms: number;
  end_ms: number;
}

interface ActionItem {
  action: 'create' | 'update' | 'comment' | 'close' | 'flag' | 'meta';
  id?: string;
  data: {
    task_name?: string;
    list_id?: string;
    description?: string;
    assignees?: number[];
    status?: string;
    priority?: number;
    due_date?: string;
    tags?: string[];
    custom_fields?: Array<{ id: string; value: any }>;
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
    comment?: string;
    summary?: string;
    context?: string;
    parties?: string[];
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

const getDateFromTimestamp = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  
  try {
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    if (timestamp._seconds !== undefined) {
      return new Date(timestamp._seconds * 1000);
    }
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }
    if (timestamp instanceof Date) {
      return isNaN(timestamp.getTime()) ? null : timestamp;
    }
    return null;
  } catch (err) {
    console.error('Error parsing timestamp:', err);
    return null;
  }
};

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
  const [activeTab, setActiveTab] = useState<'actions' | 'transcript'>('actions');

  useEffect(() => {
    if (!meetingId) return;
    
    const meetingRef = doc(db, "meetings", meetingId);
    const unsubscribe = onSnapshot(meetingRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            setMeeting({ id: doc.id, ...data } as Meeting);
            
            // If actions were just generated, stop the loading state
            if (data.actions && data.actions.length > 0) {
                setIsGenerating(false);
            }
        } else {
            setError("Meeting not found.");
        }
        setLoading(false);
    }, (err) => {
        console.error("Error fetching meeting in real-time:", err);
        setError("Failed to load meeting data.");
        setLoading(false);
    });

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
    } catch (err: any) {
        setError(err.message);
        setIsGenerating(false);
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

  const getActionDescription = (actionItem: ActionItem) => {
    const { action, data } = actionItem;
    
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

  // Group actions by type
  const groupedActions = meeting?.actions?.reduce((acc, action) => {
    const type = action.action;
    if (!acc[type]) acc[type] = [];
    acc[type].push(action);
    return acc;
  }, {} as Record<string, ActionItem[]>) || {};

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

  const hasActions = meeting?.actions && Array.isArray(meeting.actions) && meeting.actions.length > 0;
  const isProcessing = meeting?.status === 'processing' || isGenerating;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button 
          onClick={() => router.push('/dashboard')} 
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Meetings
        </button>

        {/* Meeting Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">{meeting.title}</h1>
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <InfoPill icon={Clock} text={formatMeetingDate(meeting.createdAt)} />
                <InfoPill icon={Clock} text={formatDuration(meeting.durationMs)} />
                <InfoPill icon={Users} text={`${meeting.totalSpeakers} speakers`} />
                <InfoPill icon={MessageSquare} text={`${meeting.totalSegments} segments`} />
              </div>
            </div>
            {hasActions && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="text-sm font-semibold text-green-800">
                  {meeting.actions?.length || 0} Action{meeting.actions?.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {meeting.unresolvedCount > 0 && (
            <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
              <p className="text-sm text-yellow-800">
                <strong className="font-semibold">{meeting.unresolvedCount}</strong> unidentified speaker(s) need your attention.
                <a href="#" className="font-semibold underline ml-2 hover:text-yellow-900">Resolve Now</a>
              </p>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-t-xl shadow-sm border border-gray-200 border-b-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('actions')}
              className={`flex items-center gap-2 px-6 py-4 font-semibold transition-colors border-b-2 ${
                activeTab === 'actions'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ListTodo className="w-5 h-5" />
              Action Items
              {hasActions && (
                <span className="ml-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
                  {meeting.actions?.length || 0}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('transcript')}
              className={`flex items-center gap-2 px-6 py-4 font-semibold transition-colors border-b-2 ${
                activeTab === 'transcript'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-5 h-5" />
              Transcript
              <span className="ml-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-bold">
                {meeting?.totalSegments || 0}
              </span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 border-t-0 p-8">
          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <>
              {!hasActions && !isProcessing && (
                <div className="text-center py-16">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
                    <Bot className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Action Items Yet</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Let AI analyze your meeting transcript and generate actionable tasks automatically.
                  </p>
                  <button 
                    onClick={handleGenerateActions} 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
                  >
                    <Bot className="w-5 h-5"/>
                    Generate Action Items
                  </button>
                </div>
              )}

              {isProcessing && !hasActions && (
                <div className="text-center py-16">
                  <Loader2 className="w-12 h-12 mx-auto animate-spin text-indigo-600 mb-4"/>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">AI is Analyzing Your Meeting</h3>
                  <p className="text-gray-600">This may take a minute. Results will appear automatically.</p>
                </div>
              )}

              {hasActions && (
                <div className="space-y-8">
                  {/* Action Statistics */}
                  {Object.keys(groupedActions).length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                      {Object.entries(groupedActions).map(([type, items]) => {
                        const badge = getActionBadge(type);
                        return (
                          <div key={type} className={`p-4 ${badge.bg} rounded-lg border border-gray-200`}>
                            <div className="text-2xl font-bold mb-1">{items.length}</div>
                            <div className={`text-xs font-semibold ${badge.text}`}>{badge.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions List */}
                  <div className="space-y-4">
                    {meeting.actions?.map((actionItem, index) => {
                      const badge = getActionBadge(actionItem.action);
                      
                      return (
                        <div key={index} className="p-6 bg-gray-50 rounded-lg border border-gray-200 hover:border-indigo-200 hover:shadow-md transition-all">
                          {/* Action Header */}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                              <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${badge.bg} ${badge.text} flex items-center gap-1.5`}>
                                <span>{badge.icon}</span>
                                {badge.label}
                              </span>
                              {actionItem.id && (
                                <span className="text-xs text-gray-500 font-mono bg-white px-2 py-1 rounded border border-gray-200">
                                  #{actionItem.id}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Action Content */}
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            {actionItem.action === 'comment' && actionItem.data.comment && (
                              <div className="flex gap-3">
                                <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                  <MessageSquare className="w-4 h-4 text-purple-600" />
                                </div>
                                <p className="text-sm text-gray-800 leading-relaxed flex-1">{actionItem.data.comment}</p>
                              </div>
                            )}
                            
                            {actionItem.action === 'flag' && (
                              <div className="space-y-3">
                                {actionItem.data.summary && (
                                  <div className="flex gap-3">
                                    <div className="flex-shrink-0">⚠️</div>
                                    <div className="flex-1">
                                      <p className="text-sm font-semibold text-red-900 mb-2">{actionItem.data.summary}</p>
                                      {actionItem.data.context && (
                                        <p className="text-sm text-gray-700 leading-relaxed">{actionItem.data.context}</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {actionItem.data.parties && actionItem.data.parties.length > 0 && (
                                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
                                    <span className="text-xs text-gray-600 font-semibold">Involved:</span>
                                    {actionItem.data.parties.map((party, idx) => (
                                      <span key={idx} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
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
                                  <p className="text-sm font-semibold text-gray-900 mb-2">{actionItem.data.name}</p>
                                )}
                                {actionItem.data.details && (
                                  <p className="text-sm text-gray-700 leading-relaxed">{actionItem.data.details}</p>
                                )}
                                {actionItem.data.type && (
                                  <span className="inline-block px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium mt-2">
                                    {actionItem.data.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {actionItem.action === 'update' && (
                              <div className="space-y-3">
                                {actionItem.data.dependencies?.add && actionItem.data.dependencies.add.length > 0 && (
                                  <div className="flex gap-2 items-start">
                                    <span className="text-sm text-gray-700 font-semibold">Adding dependency:</span>
                                    {actionItem.data.dependencies.add.map((depId, idx) => (
                                      <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-mono">
                                        #{depId}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {actionItem.data.updates && (
                                  <div className="text-sm space-y-2">
                                    {actionItem.data.updates.status && (
                                      <p className="text-gray-700">
                                        <span className="font-semibold">New Status:</span> {actionItem.data.updates.status}
                                      </p>
                                    )}
                                    {actionItem.data.updates.description && (
                                      <p className="text-gray-700">{actionItem.data.updates.description}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {actionItem.action === 'create' && (
                              <div className="space-y-3">
                                {actionItem.data.task_name && (
                                  <h4 className="font-semibold text-gray-900">{actionItem.data.task_name}</h4>
                                )}
                                {actionItem.data.description && (
                                  <p className="text-sm text-gray-700">{actionItem.data.description}</p>
                                )}
                                <div className="flex flex-wrap gap-4 text-xs text-gray-600 pt-2 border-t border-gray-200">
                                  {actionItem.data.status && (
                                    <span className="flex items-center gap-1.5">
                                      <span className="font-semibold">Status:</span> {actionItem.data.status}
                                    </span>
                                  )}
                                  {actionItem.data.due_date && (
                                    <span className="flex items-center gap-1.5">
                                      <Clock className="w-3 h-3" />
                                      <span className="font-semibold">Due:</span> {actionItem.data.due_date}
                                    </span>
                                  )}
                                  {actionItem.data.priority && (
                                    <span className="flex items-center gap-1.5">
                                      <span className="font-semibold">Priority:</span> {actionItem.data.priority}
                                    </span>
                                  )}
                                </div>
                                {actionItem.data.tags && actionItem.data.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {actionItem.data.tags.map((tag, idx) => (
                                      <span key={idx} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {actionItem.action === 'close' && (
                              <div className="flex items-center gap-2 text-gray-700">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                <span className="text-sm font-medium">Mark task as completed</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Reasoning */}
                          {actionItem.reasoning && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1">
                                <span>💡</span> View AI Reasoning
                              </summary>
                              <p className="mt-2 pl-4 text-xs text-gray-600 border-l-2 border-gray-300 leading-relaxed">
                                {actionItem.reasoning}
                              </p>
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Transcript Tab */}
          {activeTab === 'transcript' && (
            <>
              {meeting.transcript && meeting.transcript.length > 0 ? (
                <div className="space-y-6">
                  {meeting.transcript.map((segment, index) => {
                    const colorClasses = getSpeakerColorClasses(segment.speaker);
                    return (
                      <div key={index} className="flex gap-6 group">
                        <div className="flex-shrink-0 w-20 text-right">
                          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                            {formatTimestamp(segment.start_ms)}
                          </span>
                        </div>
                        <div className={`flex-1 border-l-4 ${colorClasses.border} pl-5 py-1`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-full ${colorClasses.bg} flex items-center justify-center`}>
                              <User className={`w-4 h-4 ${colorClasses.text}`}/>
                            </div>
                            <p className={`font-semibold ${colorClasses.text}`}>
                              {segment.speaker}
                            </p>
                          </div>
                          <p className="text-gray-800 leading-relaxed pl-10">{segment.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-16">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transcript Available</h3>
                  <p className="text-gray-600">The transcript for this meeting has not been generated yet.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}