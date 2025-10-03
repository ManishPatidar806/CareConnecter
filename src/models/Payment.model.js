import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
    },
    paymentId: {
      type: String,
      required: true,
      unique: true,
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED", "REJECTED", "TRANSFERRED"],
    },
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      required: true,
    },
    careId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Care",
      required: true,
    },
    jobPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: true,
    },
    // Stripe Connect specific fields
    stripeConnectAccountId: {
      type: String, // Caregiver's Stripe Connect account ID
    },
    transferId: {
      type: String, // Stripe transfer ID for direct payment
    },
    transferStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "CANCELED"],
      default: "PENDING",
    },
    platformFee: {
      type: Number,
      default: 0, // Fee kept by the platform (optional)
    },
    netAmount: {
      type: Number, // Amount transferred to caregiver after platform fee
    },
  },
  { timestamps: true }
);

export const Payment = mongoose.model("Payment", paymentSchema);
