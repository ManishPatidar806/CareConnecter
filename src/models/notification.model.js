import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['NEW_JOB_POST', 'JOB_APPLICATION', 'JOB_ACCEPTED', 'JOB_REJECTED', 'PAYMENT_RECEIVED', 'PROFILE_APPROVED']
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      required: true,
      default: false
    },
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
    },
    careId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Care",
    },
    jobPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
    },
    
    recipientType: {
      type: String,
      enum: ['FAMILY', 'CARE'],
      required: true
    }
  },
  { timestamps: true }
);

notificationSchema.index({ familyId: 1, isRead: 1 });
notificationSchema.index({ careId: 1, isRead: 1 });

export const Notification = mongoose.model("Notification", notificationSchema);