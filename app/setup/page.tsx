"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; // Using relative path

export default function SetupPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); // New state for playback
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null); // Ref for audio player

  // New state for timer and progress
  const [countdown, setCountdown] = useState(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Handle audio player events
  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.onended = () => {
        setIsPlaying(false);
      };
      audioPlayerRef.current.onpause = () => {
        setIsPlaying(false);
      };
    }
  }, [audioBlob]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        chunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop()); // Stop the microphone access
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setAudioBlob(null);
      setCountdown(30);
      setError(null); // Clear any previous errors

      // Stop any active playback
      if (audioPlayerRef.current && isPlaying) {
        audioPlayerRef.current.pause();
        setIsPlaying(false);
      }

      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError(
        "Could not access microphone. Please grant permission and try again."
      );
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const togglePlayback = () => {
    if (audioBlob && audioPlayerRef.current) {
      if (isPlaying) {
        audioPlayerRef.current.pause();
      } else {
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audioBlob || !userName.trim() || !user) return;

    setError(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("name", userName);
    formData.append("audioFile", audioBlob, "voice-sample.webm");

    try {
      // Step 1: Call the API to get the voiceprint
      const apiResponse = await fetch("/api/register-user", {
        method: "POST",
        body: formData,
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(
          errorData.message || "Failed to generate voiceprint from API."
        );
      }

      const { voiceprint } = await apiResponse.json();

      if (!voiceprint) {
        throw new Error("API did not return a valid voiceprint.");
      }

      // Step 2: Save the complete user profile to Firestore from the client
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        id: user.uid,
        name: userName,
        email: user.email,
        voiceprint: voiceprint,
        createdAt: new Date(),
      });

      console.log("User profile created successfully!");
      router.push("/"); // Redirect to dashboard on success
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercentage = ((30 - countdown) / 30) * 100;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <h1 className="text-xl text-gray-700">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white shadow-xl rounded-lg p-8 w-full max-w-lg border border-gray-200">
        <h1 className="text-3xl font-bold text-gray-800 text-center mb-2">
          Create Your Profile
        </h1>
        <p className="text-gray-600 text-center mb-8">
          One last step: let's create your unique voice profile for secure
          access.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium text-gray-700 block"
            >
              Your Name
            </label>
            <input
              id="name"
              type="text"
              className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Enter your full name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 block">
              Voice Recording
            </label>
            <div className="p-6 border-2 border-dashed border-blue-200 rounded-lg text-center bg-blue-50 space-y-4">
              <p className="text-sm text-gray-600">
                Record a clear, 30-second audio clip of yourself speaking.
              </p>

              {isRecording && (
                <div className="w-full bg-blue-200 rounded-full h-2.5 mt-2">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              )}

              <div className="flex items-center justify-center space-x-4">
                {isRecording && (
                  <svg
                    className="w-8 h-8 text-red-500 animate-pulse"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.7a1 1 0 01-.4.8L7 17.5a1 1 0 01-1.6-.8V14a1 1 0 011-1h2a1 1 0 011 1v2.7a1 1 0 01-.4.8z"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                )}
                <h2 className="text-5xl font-mono font-extrabold text-blue-800">
                  {countdown.toString().padStart(2, "0")}s
                </h2>
              </div>

              {!isRecording && !audioBlob && (
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition ease-in-out duration-150"
                  disabled={isSubmitting}
                >
                  Start Recording
                </button>
              )}
              {isRecording && (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition ease-in-out duration-150"
                  disabled={isSubmitting}
                >
                  Stop Recording
                </button>
              )}
              {audioBlob && !isRecording && (
                <div className="space-y-2">
                  <p className="text-green-600 font-semibold">
                    Recording complete!
                  </p>
                  <div className="flex justify-center space-x-2">
                    <button
                      type="button"
                      onClick={togglePlayback}
                      className={`px-4 py-2 rounded-md transition ease-in-out duration-150 ${
                        isPlaying
                          ? "bg-yellow-500 hover:bg-yellow-600 text-white"
                          : "bg-green-500 hover:bg-green-600 text-white"
                      }`}
                      disabled={isSubmitting}
                    >
                      {isPlaying ? "Pause Playback" : "Play Recording"}
                    </button>
                    <button
                      type="button"
                      onClick={startRecording}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold rounded-md focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition ease-in-out duration-150"
                      disabled={isSubmitting}
                    >
                      Re-record
                    </button>
                  </div>
                  <audio ref={audioPlayerRef} className="hidden"></audio>{" "}
                  {/* Hidden audio player */}
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-md shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition ease-in-out duration-150"
            disabled={
              !audioBlob || !userName.trim() || isSubmitting || countdown > 0
            }
          >
            {isSubmitting ? "Completing Profile..." : "Complete Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

