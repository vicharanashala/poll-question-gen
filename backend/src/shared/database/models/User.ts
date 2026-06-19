import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDocument extends Document {
    firebaseUID: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: string; // legacy
    avatar?: string | null;
    dateOfBirth?: string;
    address?: string;
    emergencyContact?: string;
    phoneNumber?: string | null;
    institution?: string | null;
    designation?: string | null;
    bio?: string | null;
    isVerified?: boolean;
}

const UserSchema = new Schema<IUserDocument>(
    {
        firebaseUID: { type: String, required: true, unique: true, index: true },
        email: { type: String, required: true, unique: true },
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        role: { type: String, default: null },
        avatar: { type: String, default: null },

        // New fields
        dateOfBirth: { type: String, default: '' }, // Or Date if you're storing ISO format
        address: { type: String, default: '' },
        emergencyContact: { type: String, default: '' },
        phoneNumber: { type: String, default: null },
        institution: { type: String, default: null },
        designation: { type: String, default: null },
        bio: { type: String, default: null },
        isVerified: { type: Boolean, default: false },
    },
    {
        timestamps: true,
    }
);

export const UserModel =
    mongoose.models.User as mongoose.Model<IUserDocument> ||
    mongoose.model<IUserDocument>('User', UserSchema);