import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth-store";
import { User, AtSign, BadgeCheck, Edit2, Save, Calendar, UserCheck, BookOpen, Phone, MapPin, AlertCircle, RefreshCw, Camera } from "lucide-react";
import { useState, useEffect } from "react";
import type { IUser } from "@/lib/store/auth-store";
import { updateUserRole } from "@/lib/firebase";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('firebase-auth-token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    cache: 'no-cache',
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

export default function TeacherProfile() {
  const { user: authUser, setUser: setAuthUser, setUserRole } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<IUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

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
    avatar: "",
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
          avatar: profile.avatar || "",
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
        phoneNumber: formData.phoneNumber || null,
        dateOfBirth: formData.dateOfBirth || undefined,
        address: formData.address || undefined,
        emergencyContact: formData.emergencyContact || undefined,
        institution: formData.institution || null,
        designation: formData.designation || null,
        bio: formData.bio || null,
        avatar: formData.avatar || undefined,
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
        avatar: updated.avatar,
      } : null);

      if (authUser) {
        setAuthUser({
          ...authUser,
          firstName: updated.firstName,
          lastName: updated.lastName,
          name: `${updated.firstName} ${updated.lastName}`,
          avatar: updated.avatar,
        });
      }

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
        avatar: user.avatar || "",
      });
    }
    setIsEditing(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size should be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
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

  const handleSwitchRole = async () => {
    if (!authUser?.uid) return;
    try {
      setSwitchingRole(true);
      await updateUserRole(authUser.uid, 'student');
      setAuthUser({ ...authUser, role: 'student' });
      setUserRole('student');
      window.location.href = '/student';
    } catch (e: any) {
      setError("Failed to switch role");
      setSwitchingRole(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
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

  const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || "Unnamed Teacher";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-900 dark:to-indigo-950 flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Card className="w-full max-w-4xl bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-xl border border-slate-200/80 dark:border-gray-700/80 mb-8">
          <CardHeader className="flex flex-col items-center gap-4 pb-6 w-full p-4 md:p-8">
            <div className="flex justify-end w-full">
              {!isEditing ? (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleSwitchRole}
                    disabled={switchingRole}
                    className="flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-yellow-500 dark:text-black dark:hover:bg-yellow-400 border-indigo-200 dark:border-yellow-500"
                  >
                    {switchingRole ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-700 dark:border-black"></div>
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Switch to Student
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2"
                  >
                    <Edit2 className="h-4 w-4" />
                    Edit Profile
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2"
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
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            <div className="relative group mx-auto mb-4">
              <Avatar className="h-24 w-24 md:h-32 md:w-32 ring-4 ring-primary/30 shadow-lg">
                <AvatarImage src={(isEditing ? formData.avatar : user.avatar) || undefined} alt={displayName} />
                <AvatarFallback className="rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900 dark:to-indigo-900">
                  <User className="h-12 w-12 md:h-16 md:w-16 text-purple-600 dark:text-purple-300" />
                </AvatarFallback>
              </Avatar>
              {isEditing && (
                <label className="absolute bottom-0 right-0 md:bottom-2 md:right-2 w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-blue-700 transition-colors border-2 border-white dark:border-slate-800 z-10">
                  <Camera className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              )}
            </div>

            <div className="text-center">
              <CardTitle className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center justify-center gap-3 mb-2 text-center">
                {isEditing ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex flex-col">
                        <label htmlFor="firstName" className="sr-only">First Name</label>
                        <input
                          id="firstName"
                          type="text"
                          className="text-lg font-semibold bg-white dark:bg-gray-800 border-2 border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 px-4 py-2 text-center w-full sm:w-auto min-w-32"
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
                          className="text-lg font-semibold bg-white dark:bg-gray-800 border-2 border-purple-300 dark:border-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 px-4 py-2 text-center w-full sm:w-auto min-w-32"
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
                  <span className="break-words">{displayName}</span>
                )}
              </CardTitle>

              <div className="flex flex-col items-center gap-2 text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <AtSign className="h-5 w-5 text-purple-500" />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-green-500" />
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {user.role?.toUpperCase() || 'TEACHER'}
                  </Badge>
                  {user.isVerified && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Verified
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 md:px-8 pb-8 space-y-8">
            {/* Personal Information Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-6">
                <UserCheck className="h-5 w-5 text-purple-500" />
                Personal Information
              </h3>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Phone Number
                      </label>
                      <input
                        id="phoneNumber"
                        type="tel"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                        value={formData.phoneNumber}
                        onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                        placeholder="Enter phone number"
                        title="Enter your phone number"
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Date of Birth
                      </label>
                      <input
                        id="dateOfBirth"
                        type="date"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                        value={formData.dateOfBirth}
                        onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        title="Select your date of birth"
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Address
                    </label>
                    <textarea
                      id="address"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Enter address"
                      title="Enter your address"
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Emergency Contact
                    </label>
                    <input
                      id="emergencyContact"
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                      value={formData.emergencyContact}
                      onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                      placeholder="Enter emergency contact"
                      title="Enter emergency contact information"
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-gray-500" />
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block">Phone</span>
                        <span className="text-gray-800 dark:text-gray-200">{user.phoneNumber?.trim() || "Not specified"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-gray-500" />
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block">Date of Birth</span>
                        <span className="text-gray-800 dark:text-gray-200">
                          {user.dateOfBirth ? (
                            <>
                              {new Date(user.dateOfBirth).toLocaleDateString()}
                              {calculateAge(user.dateOfBirth) && (
                                <span className="text-sm text-gray-500 ml-2">
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
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-gray-500" />
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block">Address</span>
                        <span className="text-gray-800 dark:text-gray-200">{user.address?.trim() || "Not specified"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-gray-500" />
                      <div>
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block">Emergency Contact</span>
                        <span className="text-gray-800 dark:text-gray-200">{user.emergencyContact?.trim() || "Not specified"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Professional Information Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-6">
                <BookOpen className="h-5 w-5 text-purple-500" />
                Professional Information
              </h3>

              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="institution" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Institution
                      </label>
                      <input
                        id="institution"
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                        value={formData.institution}
                        onChange={(e) => handleInputChange('institution', e.target.value)}
                        placeholder="Enter institution"
                        title="Enter your institution name"
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label htmlFor="designation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Designation
                      </label>
                      <input
                        id="designation"
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                        value={formData.designation}
                        onChange={(e) => handleInputChange('designation', e.target.value)}
                        placeholder="Enter designation"
                        title="Enter your job designation"
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Bio
                    </label>
                    <textarea
                      id="bio"
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                      value={formData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      placeholder="Tell us about yourself..."
                      title="Enter your bio or description"
                      disabled={saving}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1">Institution</span>
                      <span className="text-gray-800 dark:text-gray-200">{user.institution?.trim() || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-1">Designation</span>
                      <span className="text-gray-800 dark:text-gray-200">{user.designation?.trim() || "Not specified"}</span>
                    </div>
                  </div>
                  {user.bio && (
                    <div>
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-2">Bio</span>
                      <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{user.bio}</p>
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