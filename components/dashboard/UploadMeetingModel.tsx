"use client";

import { useState } from "react";
// import { useRouter } from "next/navigation"; // Removed to fix build issue
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog"; // Using relative path
import { UploadCloud, File, X, Loader2, XCircle } from "lucide-react";

interface UploadMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
}

export function UploadMeetingModal({ isOpen, onClose, teamId }: UploadMeetingModalProps) {
  const [meetingTitle, setMeetingTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // const router = useRouter(); // Removed to fix build issue

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioFile || !meetingTitle.trim() || !teamId) {
      setError("Please provide a title and select an audio file.");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append("audioFile", audioFile);
    formData.append("teamId", teamId);
    formData.append("meetingTitle", meetingTitle);

    try {
      const response = await fetch("/api/transcribe-meeting", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to process meeting.");
      }

      const result = await response.json();
      
      console.log("Successfully processed meeting:", result.meetingId);
      onClose();
      // Using window.location.reload() as a robust way to refresh data
      window.location.reload();

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setMeetingTitle("");
    setAudioFile(null);
    setError(null);
    setIsProcessing(false);
  };
  
  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload New Meeting</DialogTitle>
          <DialogDescription>
            Upload an audio recording to transcribe and analyze.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
          <div className="grid gap-2">
            <label htmlFor="title" className="text-sm font-medium">Meeting Title</label>
            <input
              id="title"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="e.g., Q4 Planning Session"
              className="input-field"
              disabled={isProcessing}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Audio File</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                {!audioFile ? (
                  <>
                    <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="audio/*" />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">MP3, WAV, M4A up to 500MB</p>
                  </>
                ) : (
                  <div className="text-center">
                    <File className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm font-medium text-gray-900">{audioFile.name}</p>
                    <button type="button" onClick={() => setAudioFile(null)} className="mt-2 text-xs text-red-600 hover:text-red-500">Remove file</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 flex items-center"><XCircle className="w-4 h-4 mr-2"/> {error}</p>
          )}
        </form>
        <DialogFooter>
          <button type="button" onClick={handleClose} className="btn-secondary" disabled={isProcessing}>
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn-primary inline-flex items-center justify-center"
            disabled={isProcessing || !audioFile || !meetingTitle}
          >
            {isProcessing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing...</> : "Upload & Transcribe"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

