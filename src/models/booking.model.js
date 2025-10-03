import mongoose from "mongoose";

/*
 Booking lifecycle statuses:
 PENDING  -> created by family (awaiting caregiver acceptance)
 ACCEPTED -> caregiver accepted (scheduled)
 IN_PROGRESS -> within scheduled time window (optional transition)
 COMPLETED -> completed successfully (hours locked, ready for payout)
 CANCELED -> canceled by family before start
 REJECTED -> caregiver explicitly rejected
 EXPIRED  -> auto-expired (past start without acceptance) - future cron logic

 Payment status (decoupled from Payment model for quick lookup):
 UNPAID -> no payment intent created
 HOLD   -> funds authorized/escrow (future Stripe integration)
 PAID   -> released to caregiver (or transfer queued)
 REFUNDED -> refunded/canceled after payment
*/

const scheduleSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // HH:MM 24h
    durationHours: { type: Number, required: true, min: 0.5, max: 24 },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      required: true,
      index: true,
    },
    careId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Care",
      required: true,
      index: true,
    },
    jobPostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: false, // direct ad‑hoc booking allowed
      index: true,
    },
    elderName: { type: String, required: true },
    location: { type: String, required: true },
    skills: {
      type: [{ type: String }],
      default: [],
      validate: [(arr) => arr.length > 0, "At least one skill is required"],
    },
    schedule: { type: scheduleSchema, required: true },
    hourlyRate: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 }, // derived = rate * hours (redundancy for reporting)
    status: {
      type: String,
      enum: [
        "PENDING",
        "ACCEPTED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELED",
        "REJECTED",
        "EXPIRED",
      ],
      default: "PENDING",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "HOLD", "PAID", "REFUNDED"],
      default: "UNPAID",
      index: true,
    },
    notes: { type: String, maxlength: 500 },
    caregiverAcknowledged: { type: Boolean, default: false },
    familyAcknowledged: { type: Boolean, default: false },
    // Audit snapshots (denormalized for historical accuracy)
    rateSnapshot: { type: Number },
    skillSnapshot: { type: [{ type: String }] },
    // Lifecycle timestamps
    acceptedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    canceledAt: { type: Date },
    canceledByRole: { type: String, enum: ["family", "care", "system"] },
    rejectionReason: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

bookingSchema.pre("validate", function (next) {
  if (!this.totalAmount && this.schedule?.durationHours && this.hourlyRate >= 0) {
    this.totalAmount = +(this.schedule.durationHours * this.hourlyRate).toFixed(2);
  }
  if (!this.rateSnapshot) this.rateSnapshot = this.hourlyRate;
  if (!this.skillSnapshot || this.skillSnapshot.length === 0) this.skillSnapshot = this.skills;
  next();
});

// Simple derived virtual for end time
bookingSchema.virtual("endTime").get(function () {
  if (!this.schedule?.startTime || !this.schedule?.durationHours) return null;
  const [h, m] = this.schedule.startTime.split(":").map(Number);
  const totalMinutes = h * 60 + m + this.schedule.durationHours * 60;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = Math.round(totalMinutes % 60).toString().padStart(2, "0");
  return `${endH.toString().padStart(2, "0")}:${endM}`;
});

export const Booking = mongoose.model("Booking", bookingSchema);
