import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth-store";
import { User, AtSign, BadgeCheck, Edit2, Save, Calendar, UserCheck, BookOpen, Phone, MapPin, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import type { IUser } from "@/lib/store/auth-store";
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('firebase-auth-token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

export const apiService = {
  async getUserProfile(firebaseUID: string): Promise<IUser> {
    const data = await apiCall(`/users/firebase/${firebaseUID}/profile`);
    return {
      uid: firebaseUID,
      userId: data.id ?? "",
      email: data.email ?? "",
      firstName: data.firstName ?? "",
      lastName: data.lastName ?? "",
      role: data.role ?? null,
      avatar: data.avatar ?? null,
      phoneNumber: data.phoneNumber ?? null,
      dateOfBirth: data.dateOfBirth ?? "",
      address: data.address ?? "",
      emergencyContact: data.emergencyContact ?? "",
      institution: data.institution ?? null,
      designation: data.designation ?? null,
      bio: data.bio ?? null,
      isVerified: data.isVerified ?? false,
      createdAt: data.createdAt ?? "",
      updatedAt: data.updatedAt ?? "",
    };
  },

  async updateUserProfile(userId: string, profileData: any) {
    const data = await apiCall(`/users/${userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    return data;
  },
};

export default function StudentProfile() {
  const { user: authUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<IUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form data state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    dateOfBirth: "",
    address: "",
    emergencyContact: "",
    institution: "",
    designation: "",
    bio: "",
  });

  // Load user profile data
  useEffect(() => {
    const loadData = async () => {
      if (!authUser?.uid) {
        setError("No authentication info");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const profile = await apiService.getUserProfile(authUser.uid);
        setUser(profile);
        setFormData({
          firstName: profile.firstName || "",
          lastName: profile.lastName || "",
          phoneNumber: profile.phoneNumber || "",
          dateOfBirth: profile.dateOfBirth || "",
          address: profile.address || "",
          emergencyContact: profile.emergencyContact || "",
          institution: profile.institution || "",
          designation: profile.designation || "",
          bio: profile.bio || "",
        });
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [authUser?.uid]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!user?.userId) return;
    setSaving(true);
    try {
      // Validation for phone numbers
      const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 standard phone number regex (basic)

      if (formData.phoneNumber && !phoneRegex.test(formData.phoneNumber.trim())) {
        toast.error("Invalid phone number format. Please enter a valid number.");
        setSaving(false);
        return;
      }

      if (formData.emergencyContact && !phoneRegex.test(formData.emergencyContact.trim())) {
        toast.error("Invalid emergency contact format. Please enter a valid number.");
        setSaving(false);
        return;
      }

      const trimmedFirstName = formData.firstName.trim();
      const trimmedLastName = formData.lastName.trim();

      if (!trimmedFirstName || !trimmedLastName) {
        toast.error("First Name and Last Name are mandatory.");
        setSaving(false);
        return;
      }

      // Prepare the data according to UpdateUserProfileBody structure
      const updateData = {
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: user.email, // Required field, keep existing
        phoneNumber: formData.phoneNumber?.trim() || "",
        dateOfBirth: formData.dateOfBirth || "",
        address: formData.address?.trim() || "",
        emergencyContact: formData.emergencyContact?.trim() || "",
        institution: formData.institution?.trim() || "",
        designation: formData.designation?.trim() || "",
        bio: formData.bio?.trim() || "",
      };

      const updated = await apiService.updateUserProfile(user.userId, updateData);

      // Update user state with the response
      setUser(prev => prev ? {
        ...prev,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phoneNumber: updated.phoneNumber,
        dateOfBirth: updated.dateOfBirth,
        address: updated.address,
        emergencyContact: updated.emergencyContact,
        institution: updated.institution,
        designation: updated.designation,
        bio: updated.bio,
      } : null);

      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        phoneNumber: user.phoneNumber || "",
        dateOfBirth: user.dateOfBirth || "",
        address: user.address || "",
        emergencyContact: user.emergencyContact || "",
        institution: user.institution || "",
        designation: user.designation || "",
        bio: user.bio || "",
      });
    }
    setIsEditing(false);
  };

  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="text-lg text-gray-600">Loading profile...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4 text-red-600 max-w-md text-center">
          <AlertCircle className="h-12 w-12" />
          <span className="text-lg">{error}</span>
          <Button onClick={() => window.location.reload()} variant="outline">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-lg text-gray-500">No user data found</span>
      </div>
    );
  }

  const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || "Unnamed Student";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-2 sm:px-4 py-4 sm:py-8 w-full">
        <Card className="w-full max-w-2xl sm:max-w-4xl bg-white/90 dark:bg-gray-900/90 rounded-xl sm:rounded-2xl shadow-xl border border-slate-200/80 dark:border-gray-700/80 mb-6 sm:mb-8">
          <CardHeader className="flex flex-col items-center gap-3 sm:gap-4 pb-4 sm:pb-6 w-full p-4 sm:p-8">
            <div className="flex justify-end w-full">
              {!isEditing ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (user) {
                      setFormData({
                        firstName: user.firstName || "",
                        lastName: user.lastName || "",
                        phoneNumber: user.phoneNumber || "",
                        dateOfBirth: user.dateOfBirth || "",
                        address: user.address || "",
                        emergencyContact: user.emergencyContact || "",
                        institution: user.institution || "",
                        designation: user.designation || "",
                        bio: user.bio || "",
                      });
                    }
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit Profile
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Profile
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <Avatar className="h-20 w-20 sm:h-32 sm:w-32 mb-3 sm:mb-4 ring-4 ring-primary/30 shadow-lg">
              <AvatarImage src={user.avatar || undefined} alt={displayName} />
              <AvatarFallback className="rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900">
                <User className="h-10 w-10 sm:h-16 sm:w-16 text-blue-600 dark:text-blue-300" />
              </AvatarFallback>
            </Avatar>

            <div className="text-center">
              <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                {isEditing ? (
                  <div className="flex flex-col items-center gap-2 sm:gap-4">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <div className="flex flex-col">
                        <label htmlFor="firstName" className="sr-only">First Name</label>
                        <input
                          id="firstName"
                          type="text"
                          className="text-base sm:text-lg font-semibold bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 sm:px-4 py-1.5 sm:py-2 text-center min-w-20 sm:min-w-32"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          disabled={saving}
                          placeholder="First name"
                          title="Enter your first name"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label htmlFor="lastName" className="sr-only">Last Name</label>
                        <input
                          id="lastName"
                          type="text"
                          className="text-base sm:text-lg font-semibold bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 px-3 sm:px-4 py-1.5 sm:py-2 text-center min-w-20 sm:min-w-32"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          disabled={saving}
                          placeholder="Last name"
                          title="Enter your last name"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <span>{displayName}</span>
                )}
              </CardTitle>

              <div className="flex flex-col items-center gap-1 sm:gap-2 text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1 sm:gap-2">
                  <AtSign className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                  <span className="text-xs sm:text-base">{user.email}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <BadgeCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs sm:text-sm">
                    {user.role?.toUpperCase() || 'STUDENT'}
                  </Badge>
                  {user.isVerified && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs sm:text-sm">
                      Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-3 sm:px-8 pb-6 sm:pb-8 space-y-6 sm:space-y-8">
            {/* Personal Information Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1 sm:gap-2 mb-3 sm:mb-6">
                <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                Personal Information
              </h3>

              {isEditing ? (
                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <div>
                      <label htmlFor="phoneNumber" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                        Phone Number
                      </label>
                      <input
                        id="phoneNumber"
                        type="tel"
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs sm:text-base"
                        value={formData.phoneNumber}
                        onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                        placeholder="Enter phone number"
                        title="Enter your phone number"
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label htmlFor="dateOfBirth" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                        Date of Birth
                      </label>
                      <input
                        id="dateOfBirth"
                        type="date"
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs sm:text-base"
                        value={formData.dateOfBirth}
                        onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        title="Select your date of birth"
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="address" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      Address
                    </label>
                    <textarea
                      id="address"
                      rows={3}
                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs sm:text-base"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Enter address"
                      title="Enter your address"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label htmlFor="emergencyContact" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      Emergency Contact
                    </label>
                    <input
                      id="emergencyContact"
                      type="text"
                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs sm:text-base"
                      value={formData.emergencyContact}
                      onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                      placeholder="Enter emergency contact"
                      title="Enter emergency contact information"
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                      <div>
                        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block">Phone</span>
                        <span className="text-gray-800 dark:text-gray-200 text-xs sm:text-base">{user.phoneNumber?.trim() || "Not specified"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                      <div>
                        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block">Date of Birth</span>
                        <span className="text-gray-800 dark:text-gray-200 text-xs sm:text-base">
                          {user.dateOfBirth ? (
                            <>
                              {new Date(user.dateOfBirth).toLocaleDateString()}
                              {calculateAge(user.dateOfBirth) && (
                                <span className="text-xs sm:text-sm text-gray-500 ml-1 sm:ml-2">
                                  (Age: {calculateAge(user.dateOfBirth)})
                                </span>
                              )}
                            </>
                          ) : (
                            "Not specified"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                      <div>
                        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block">Address</span>
                        <span className="text-gray-800 dark:text-gray-200 text-xs sm:text-base">{user.address?.trim() || "Not specified"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                      <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
                      <div>
                        <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block">Emergency Contact</span>
                        <span className="text-gray-800 dark:text-gray-200 text-xs sm:text-base">{user.emergencyContact?.trim() || "Not specified"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Academic Information Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 sm:pt-6">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1 sm:gap-2 mb-3 sm:mb-6">
                <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                Academic Information
              </h3>

              {isEditing ? (
                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <div>
                      <label htmlFor="institution" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                        Institution
                      </label>
                      <input
                        id="institution"
                        type="text"
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs sm:text-base"
                        value={formData.institution}
                        onChange={(e) => handleInputChange('institution', e.target.value)}
                        placeholder="Enter institution"
                        title="Enter your institution name"
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label htmlFor="designation" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                        Class/Grade
                      </label>
                      <input
                        id="designation"
                        type="text"
                        className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs sm:text-base"
                        value={formData.designation}
                        onChange={(e) => handleInputChange('designation', e.target.value)}
                        placeholder="Enter class/grade"
                        title="Enter your class or grade"
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="bio" className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
                      Bio
                    </label>
                    <textarea
                      id="bio"
                      rows={4}
                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs sm:text-base"
                      value={formData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      placeholder="Tell us about yourself..."
                      title="Enter your bio or description"
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    <div>
                      <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1">Institution</span>
                      <span className="text-gray-800 dark:text-gray-200 text-xs sm:text-base">{user.institution?.trim() || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1">Class/Grade</span>
                      <span className="text-gray-800 dark:text-gray-200 text-xs sm:text-base">{user.designation?.trim() || "Not specified"}</span>
                    </div>
                  </div>
                  {user.bio && (
                    <div>
                      <span className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1 sm:mb-2">Bio</span>
                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed text-xs sm:text-base">{user.bio}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}