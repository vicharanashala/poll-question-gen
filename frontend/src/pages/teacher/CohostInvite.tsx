import { useAuth } from "@/lib/hooks/use-auth";
import { useParams, useNavigate } from "@tanstack/react-router";
import api from "@/lib/api/api";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth-store";
import { auth } from "@/lib/firebase";

interface CohostInviteResponse {
    roomId: string;
    message?: string;
}

interface ApiErrorData {
    message?: string;
}

interface ApiErrorLike {
    response?: {
        data?: ApiErrorData;
    };
}

const CohostInvite = () => {
    const params = useParams({ from: '/cohost-invite/$token' });
    const token: string = params.token as string;
    const navigate = useNavigate();
    const { user } = useAuth();
    const storeUser = useAuthStore((state) => state.user);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isReady, setIsReady] = useState(false);

    // Ensure user data is available before allowing accept
    useEffect(() => {
        const ensureUserData = async () => {
            const effectiveUser = user || storeUser;
            
            // If we already have user data, we're ready
            if (effectiveUser?.uid) {
                setIsReady(true);
                return;
            }

            // Try to fetch user profile from backend if authenticated but no user data
            try {
                const firebaseUser = auth.currentUser;
                if (!firebaseUser) {
                    console.warn('No Firebase user found');
                    setIsReady(false);
                    return;
                }

                const token = await firebaseUser.getIdToken();
                const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080/api'}/users/firebase/${firebaseUser.uid}/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    console.error('Failed to fetch user profile:', response.statusText);
                    setIsReady(false);
                    return;
                }

                const userProfile = await response.json();
                useAuthStore.getState().setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    name: firebaseUser.displayName || '',
                    role: userProfile.role || null,
                    avatar: firebaseUser.photoURL || '',
                    userId: userProfile.id,
                    firstName: userProfile.firstName,
                    lastName: userProfile.lastName,
                });
                
                setIsReady(true);
            } catch (error) {
                console.error('Error fetching user profile:', error);
                setIsReady(false);
            }
        };

        ensureUserData();
    }, [user, storeUser]);

    const handleDeclineInvite = () => {
        toast.info('Invitation declined');
        navigate({ to: '/teacher/cohosted-rooms' });
    };

    const handleAcceptInvite = async () => {
        try {
            const effectiveUser = user || storeUser;
            if (!effectiveUser?.uid) {
                console.warn('User data missing:', { user, storeUser });
                toast.error("User data not loaded. Please refresh the page.");
                return;
            }

            setIsSubmitting(true);
            const response = await api.post<CohostInviteResponse>("/livequizzes/rooms/cohost", { token, userId: effectiveUser.uid });
            const { roomId, message } = response.data;
            toast.success(message ?? 'joined as cohost successfully')
            navigate({ to: `/teacher/pollroom/${roomId}` });
        } catch (error: unknown) {
            const apiError = error as ApiErrorLike;
            const responseMessage = apiError.response?.data?.message;
            console.error("Error joining as co-host:", error);
            if (responseMessage === "jwt expired") {
                toast.error("Invite link has expired.");
            } else if (responseMessage === "Host cannot join as cohost"){
                navigate({ to: `/teacher/manage-rooms` });
                toast.error(responseMessage ?? "Host cannot join as cohost")
            }
             else {
                toast.error(responseMessage ?? "Failed to join as co-host. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }

        
    };
    

    return (
        <div className="min-h-screen flex items-center justify-center px-4 transition-colors duration-300 bg-gray-50 dark:bg-gray-900">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center transition-colors duration-300 relative shadow-lg">

                <button
                    onClick={handleDeclineInvite}
                    className="absolute top-3 right-3 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Close"
                    aria-label="Close invitation"
                >
                    <X className="w-4 h-4" />
                </button>

                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Hi Educator,
                </p>

                <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-white mb-4">
                    You’ve been invited to join as a Co-host
                </h2>

                <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base mb-6 leading-relaxed">
                    Please accept the invitation below to access the room and start collaborating.
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={handleDeclineInvite}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 text-gray-800 py-2.5 rounded-lg text-sm font-medium transition"
                    >
                        Decline Invitation
                    </button>

                    <button
                        onClick={handleAcceptInvite}
                        disabled={isSubmitting || !isReady}
                        className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200 text-white py-2.5 rounded-lg text-sm font-medium transition"
                        title={!isReady ? "Loading your profile..." : "Accept this co-host invitation"}
                    >
                        {isSubmitting ? 'Joining...' : !isReady ? 'Loading...' : 'Accept Invitation'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default CohostInvite;