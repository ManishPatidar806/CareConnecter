import mongoose from "mongoose";

const jobapplicationSchema = new mongoose.Schema(
  {
    careId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Care",
      required: true,
    },
  },
  { timestamps: true }
);

const jobPostSchema = new mongoose.Schema(
  {
    familyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Family",
      required: true,
    },
    elderName: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    durationHours: {
      type: Number,
      required: true,
    },
    salary: {
      type: Number,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRE"],
      required: true,
    },
    skillRequired: {
      type: [{ type: String }],
      validate: [(arr) => arr.length > 0, "At least one Skill is required"],
    },
    applications: [jobapplicationSchema],
  },
  { timestamps: true }
);

export const JobPost = mongoose.model("JobPost", jobPostSchema);
