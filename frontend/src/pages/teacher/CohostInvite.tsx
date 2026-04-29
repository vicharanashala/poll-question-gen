import { useState } from 'react';
import { useParams, useNavigate } from '@tanstack/react-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { createBackendUser } from '@/lib/firebase';
import api from '@/lib/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';

const CohostInvite = () => {
    const params = useParams({ from: '/teacher/cohost-invite/$token' });
    const token: string = params.token as string;
    const navigate = useNavigate();
    
    // NEW: Grab the current user state to check if they are a real user!
    const { user: currentUser, isAuthenticated } = useAuthStore();
    
    // A user is "Permanent" if they are logged in AND are not a temporary guest
    const isPermanentUser = isAuthenticated && currentUser && !(currentUser as any)?.isGuest;

    const [name, setName] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    const handleAcceptInvite = async () => {
        if (!token || token.split('.').length !== 3) {
            toast.error("Invalid or corrupted invite link.");
            return;
        }

        setIsJoining(true);

        try {
            let finalUserId = '';

            // ==========================================
            // FLOW A: PERMANENT USER
            // ==========================================
            if (isPermanentUser) {
                finalUserId = currentUser.uid;
            } 
            // ==========================================
            // FLOW B: GUEST USER (Ghost Account)
            // ==========================================
            else {
                if (!name.trim()) {
                    toast.error("Please enter your name to join");
                    setIsJoining(false);
                    return;
                }

                // If there is an old ghost session lingering, kill it first
                if (auth.currentUser) {
                    await auth.signOut();
                    useAuthStore.setState({ user: null, isAuthenticated: false });
                }

                // Generate Ghost Account
                const randomId = Math.random().toString(36).substring(2, 10);
                const ghostEmail = `guest_${randomId}@temp.local`;
                const ghostPassword = `Ghost!${randomId}123`;

                const userCredential = await createUserWithEmailAndPassword(auth, ghostEmail, ghostPassword);
                await updateProfile(userCredential.user, { displayName: name });
                
                const backendUser = await createBackendUser(userCredential.user, name, "teacher");

                // Update auth store for the ghost
                useAuthStore.setState({
                    isAuthenticated: true,
                    user: { 
                        ...backendUser, 
                        uid: userCredential.user.uid, 
                        role: 'teacher',
                        isGuest: true
                    }
                });

                finalUserId = userCredential.user.uid;
            }

            // ==========================================
            // COMMON STEP: REDEEM TOKEN & JOIN ROOM
            // ==========================================
            const response: any = await api.post("/livequizzes/rooms/cohost", { 
                token, 
                userId: finalUserId 
            });
            
            let { roomId, message } = response.data;
            toast.success(message ?? `Joined successfully!`);
            navigate({ to: `/teacher/pollroom/${roomId}` });

        } catch (error: any) {
            console.error("Error joining as co-host:", error);
            
            if (error.response?.data?.message === "jwt expired") {
                toast.error("Invite link has expired.");
            } else if (error.response?.data?.message === "Host cannot join as cohost") {
                toast.error("You are the host! Redirecting to your room...");
                navigate({ to: `/teacher/manage-rooms` });
            } else {
                toast.error(error.response?.data?.message || "Failed to join as co-host. Please try again.");
            }
            
            // If they were a guest and it failed, clean up the broken ghost account
            if (!isPermanentUser) {
                auth.signOut();
                useAuthStore.setState({ user: null, isAuthenticated: false });
            }
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
            <Card className="w-full max-w-md shadow-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl">
                <CardHeader className="text-center space-y-3 pb-6">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-2">
                        <UserPlus className="text-gray-700 dark:text-gray-300 w-8 h-8" />
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {/* DYNAMIC GREETING: Use their real name if logged in! */}
                        {isPermanentUser ? `Hi, ${(currentUser as any)?.name || 'Educator'}` : "Hi Educator,"}
                    </p>
                    <CardTitle className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-white">
                        You’ve been invited as a Co-host
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-300 px-2 leading-relaxed">
                        {isPermanentUser 
                            ? "Please accept the invitation below to access the room and start collaborating." 
                            : "Please enter your name below to access the room and start collaborating."
                        }
                    </p>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* DYNAMIC INPUT: Only show the name input if they are a Guest */}
                    {!isPermanentUser && (
                        <div className="space-y-2">
                            <Input 
                                placeholder="e.g. Professor Smith" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAcceptInvite()}
                                disabled={isJoining}
                                className="h-12 text-center text-lg bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600"
                                autoFocus
                            />
                        </div>
                    )}
                    <Button 
                        className="w-full h-12 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 text-white py-2.5 rounded-lg text-sm font-medium transition"
                        onClick={handleAcceptInvite}
                        disabled={isJoining || (!isPermanentUser && !name.trim())}
                    >
                        {isJoining ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Preparing Session...
                            </>
                        ) : (
                            "Accept Invitation"
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default CohostInvite;