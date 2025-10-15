"use client";

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase'; // Corrected Path
import { X, Upload, FileAudio, Loader2, Info } from 'lucide-react';
import { useUploadModal } from '../../contexts/UploadModalProvider'; // Corrected Path

interface UploadMeetingModalProps {
  user: User; // It now needs the user object to find the teamId
}

export function UploadModal({ user }: UploadMeetingModalProps) {
  const { isUploadModalOpen, closeUploadModal } = useUploadModal();
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  if (!isUploadModalOpen) return null;
  
  const resetState = () => {
    setDragActive(false);
    setIsProcessing(false);
    setSelectedFile(null);
    setMeetingTitle('');
    setError(null);
    setProcessingStatus('');
  };

  const handleClose = () => {
    resetState();
    closeUploadModal();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles([e.dataTransfer.files[0]]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles([e.target.files[0]]);
    }
  };

  const handleFiles = (files: File[]) => {
    const audioFile = files.find(file => 
      file.type.startsWith('audio/') || 
      file.name.match(/\.(mp3|wav|m4a|aac|ogg)$/i)
    );
    if (!audioFile) {
      setError('Please select a valid audio file.');
      return;
    }
    setSelectedFile(audioFile);
  };

  const handleUpload = async () => {
    if (!selectedFile || !meetingTitle.trim() || !user) {
      setError('Please provide a title and select a file.');
      return;
    }
    setIsProcessing(true);
    setError(null);

    try {
      // --- FIX: Fetch the teamId right before we need it ---
      setProcessingStatus('Preparing upload...');
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists() || !userDoc.data().teamId) {
        throw new Error("Could not find your team information. Please try again.");
      }
      const teamId = userDoc.data().teamId;
      // --- END FIX ---

      setProcessingStatus('Fetching team voiceprints...');
      const voiceprintsRes = await fetch(`/api/teams/${teamId}/voiceprints`);
      if (!voiceprintsRes.ok) throw new Error('Could not fetch team voiceprints.');
      const { voiceprints } = await voiceprintsRes.json();

      setProcessingStatus('Transcribing audio & identifying speakers...');
      const processFormData = new FormData();
      processFormData.append('audioFile', selectedFile);
      processFormData.append('voiceprints', JSON.stringify(voiceprints));
      
      const processRes = await fetch('/api/transcribe-meeting', {
        method: 'POST',
        body: processFormData,
      });
      if (!processRes.ok) throw new Error('Failed to process the audio recording.');
      const processedData = await processRes.json();

      setProcessingStatus('Saving meeting transcript...');
      const saveRes = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          meetingTitle,
          transcript: processedData.transcript,
          speakerMap: processedData.speaker_map,
          unresolvedSpeakers: processedData.unresolved_speakers,
          uploadedBy: user.uid, // Also good to store who uploaded it
        }),
      });
      if (!saveRes.ok) throw new Error('Failed to save the meeting transcript.');
      const { meetingId } = await saveRes.json();
      
      handleClose();
      router.push(`/dashboard/meetings/${meetingId}`);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
     className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
     onClick={handleClose}
    >
      <div 
        className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Upload Meeting Recording</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
           <div>
            <label htmlFor="meeting-title" className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Title
            </label>
            <input
              type="text"
              id="meeting-title"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="e.g., Q4 Project Kickoff"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              disabled={isProcessing}
            />
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-sm text-gray-600 font-medium">{processingStatus}</p>
              </div>
            ) : selectedFile ? (
              <div className="flex flex-col items-center">
                <FileAudio className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-gray-800">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
                <button onClick={() => setSelectedFile(null)} className="mt-3 text-xs text-red-600 hover:underline">
                  Remove file
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-2">
                  Drag and drop an audio file here, or
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  browse to upload
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Supports MP3, WAV, M4A, etc.
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
            onChange={handleFileSelect} className="hidden"
          />
        </div>

        {error && (
            <div className="px-6 pb-2">
                <div className="bg-red-50 text-red-700 p-3 rounded-md flex items-center text-sm">
                    <Info className="w-5 h-5 mr-2 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            </div>
        )}

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={isProcessing || !selectedFile || !meetingTitle.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {isProcessing ? 'Processing...' : 'Upload & Transcribe'}
          </button>
        </div>
      </div>
    </div>
  );
}

