"use client";

import React, { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, updatePassword, reauthenticateWithCredential, EmailAuthProvider, User as FirebaseUser, updateProfile } from 'firebase/auth';
import { getFirestore, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import { User, Shield, Upload, Trash2, Camera, Link as LinkIcon, Loader2, X, CheckCircle } from 'lucide-react';

const auth = getAuth(app);
const db = getFirestore(app);

// ClickUp Logo Component
const ClickUpLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.2383 1.73828C11.5834 1.03613 12.4166 1.03613 12.7617 1.73828L15.3121 7.03217C15.4419 7.2998 15.6908 7.48828 15.9839 7.5457L21.7354 8.54924C22.4996 8.68652 22.809 9.58008 22.2514 10.1131L18.0645 14.1205C17.857 14.3184 17.7554 14.6063 17.7946 14.8945L18.8239 20.606C18.9818 21.3662 18.239 21.9213 17.5532 21.5541L12.2974 18.7035C12.0357 18.563 11.7243 18.563 11.4626 18.7035L6.20678 21.5541C5.521 21.9213 4.77816 21.3662 4.93603 20.606L5.96532 14.8945C6.00453 14.6063 5.90291 14.3184 5.69542 14.1205L1.50848 10.1131C0.950854 9.58008 1.26029 8.68652 2.02451 8.54924L7.77605 7.5457C8.06925 7.48828 8.31811 7.2998 8.44786 7.03217L11.2383 1.73828Z" fill="url(#paint0_linear_1_2)"/><defs><linearGradient id="paint0_linear_1_2" x1="12" y1="1" x2="12" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#ff5555"/><stop offset="1" stopColor="#ff0000"/></linearGradient></defs></svg>
);

type UserProfile = FirebaseUser & {
    teamId?: string;
};

interface TeamData {
    integrations?: {
        clickup?: {
            accessToken: string;
            connectedAt: any;
        }
    }
}

const ProfileSettings = ({ user }: { user: UserProfile | null }) => {
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', content: '' });

    useEffect(() => {
        if (user?.displayName) {
            setFullName(user.displayName);
        }
    }, [user]);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        setMessage({ type: '', content: '' });

        try {
            await updateProfile(user, { displayName: fullName });
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { name: fullName }, { merge: true });
            
            setMessage({ type: 'success', content: 'Profile updated successfully!' });
        } catch (error) {
            console.error("Error updating profile: ", error);
            setMessage({ type: 'error', content: 'Failed to update profile. Please try again.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Profile</h2>
            <p className="text-gray-500 mb-6">This is how your name will appear in transcripts.</p>
            <form onSubmit={handleProfileUpdate}>
                <div className="space-y-6">
                    <div>
                        <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <input 
                            type="text" 
                            id="fullName" 
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full max-w-md bg-white border border-gray-300 rounded-md py-2 px-3 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        />
                    </div>
                </div>
                <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end items-center gap-4">
                    {message.content && (
                        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{message.content}</p>
                    )}
                    <button type="submit" disabled={loading} className="btn-primary inline-flex items-center disabled:bg-indigo-400">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
};

const SecuritySettings = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', content: '' });

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', content: '' });
        const user = auth.currentUser;

        if (!user) {
            setMessage({ type: 'error', content: 'No user is signed in.' });
            setLoading(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', content: 'New passwords do not match.' });
            setLoading(false);
            return;
        }

        try {
            if (!user.email) {
                throw new Error("User email is not available for re-authentication.");
            }
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            setMessage({ type: 'success', content: 'Password updated successfully!' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error("Error updating password: ", error);
            setMessage({ type: 'error', content: 'Failed to update password. Please check your current password.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Password</h2>
            <p className="text-gray-500 mb-6">Update the password associated with your account.</p>
            <form onSubmit={handlePasswordUpdate}>
                <div className="space-y-6 max-w-md">
                    <div>
                        <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                        <input type="password" id="currentPassword" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="input-field" />
                    </div>
                    <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                        <input type="password" id="newPassword" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="input-field" />
                    </div>
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                        <input type="password" id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="input-field" />
                    </div>
                </div>
                <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end items-center gap-4">
                     {message.content && (
                        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{message.content}</p>
                    )}
                    <button type="submit" disabled={loading} className="btn-primary inline-flex items-center disabled:bg-indigo-400">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Update Password
                    </button>
                </div>
            </form>
        </div>
    );
};

// --- CORRECTED Integrations component ---
const Integrations = ({ teamId, teamData, onDisconnect }: { teamId: string | null; teamData: TeamData | null; onDisconnect: () => void; }) => {
    const isClickUpConnected = !!teamData?.integrations?.clickup?.accessToken;
    const [isConnecting, setIsConnecting] = useState(false);

    const handleConnectClick = () => {
        if (!teamId) {
            alert("Team information not available. Cannot connect.");
            return;
        }
        setIsConnecting(true);
        window.location.href = `/api/integrations/clickup/connect?teamId=${teamId}`;
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-gray-900 mb-1">Integrations</h2>
            <p className="text-gray-500 mb-6">Connect your favorite apps to streamline your workflow.</p>
            <ul className="space-y-4">
                <li className="flex items-center justify-between bg-gray-50 p-4 rounded-md border border-gray-200">
                    <div className="flex items-center gap-4">
                        <div className="bg-white p-2 border border-gray-200 rounded-md"><ClickUpLogo /></div>
                        <div>
                            <p className="font-semibold text-gray-800">ClickUp</p>
                            <p className="text-sm text-gray-500">Manage tasks and projects.</p>
                        </div>
                    </div>
                    {isClickUpConnected ? (
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-2 text-sm text-green-600 font-medium">
                                <CheckCircle className="w-4 h-4"/>
                                Connected
                            </span>
                            <button onClick={onDisconnect} className="text-sm text-red-500 hover:text-red-700 font-medium">
                                Disconnect
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={handleConnectClick}
                            disabled={isConnecting}
                            className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-semibold py-2 px-4 rounded-md transition-colors text-sm disabled:opacity-50"
                        >
                            {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                            <span>{isConnecting ? "Redirecting..." : "Connect"}</span>
                        </button>
                    )}
                </li>
            </ul>
        </div>
    );
};

const DangerZone = () => (
    <div className="mt-8 bg-white border border-red-300 rounded-lg p-6 sm:p-8 shadow-sm">
        <h3 className="text-xl font-bold text-red-600">Danger Zone</h3>
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between">
            <div>
                <p className="font-semibold text-gray-800">Delete Your Account</p>
                <p className="text-gray-500 text-sm mt-1">Once you delete your account, there is no going back. Please be certain.</p>
            </div>
            <button className="mt-4 sm:mt-0 flex items-center gap-2 bg-white hover:bg-red-50 text-red-600 font-bold py-2 px-4 rounded-md transition-colors border border-red-300">
                <Trash2 className="w-4 h-4" />
                Delete Account
            </button>
        </div>
    </div>
);


export default function SettingsPage() {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [teamData, setTeamData] = useState<TeamData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                const userDocRef = doc(db, "users", currentUser.uid);
                const userDoc = await getDoc(userDocRef);
                
                let combinedUser: UserProfile = currentUser;
                if (userDoc.exists()) {
                    const firestoreData = userDoc.data();
                    combinedUser = { ...currentUser, ...firestoreData };
                }
                setUser(combinedUser);
                
                if (combinedUser.teamId) {
                    const teamDocRef = doc(db, "teams", combinedUser.teamId);
                    const teamDoc = await getDoc(teamDocRef);
                    if (teamDoc.exists()) {
                        setTeamData(teamDoc.data());
                    }
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleDisconnectClickUp = async () => {
        if (!user?.teamId) return;
        
        console.log("Disconnecting ClickUp...");
        const teamDocRef = doc(db, "teams", user.teamId);
        await setDoc(teamDocRef, {
            integrations: { clickup: null }
        }, { merge: true });
        
        setTeamData(prev => {
            if (!prev) return null;
            const newIntegrations = { ...prev.integrations, clickup: undefined };
            return { ...prev, integrations: newIntegrations };
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="bg-gray-50 text-gray-800 min-h-screen font-sans">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                    <p className="text-gray-600 mt-1">Manage your account, and integrations.</p>
                </header>
                <main className="max-w-3xl mx-auto space-y-8">
                    <ProfileSettings user={user} />
                    <SecuritySettings />
                    <Integrations teamId={user?.teamId || null} teamData={teamData} onDisconnect={handleDisconnectClickUp}/>
                    <DangerZone />
                </main>
            </div>
        </div>
    );
}

