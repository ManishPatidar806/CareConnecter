import mongoose from "mongoose";
import bcrypt from "bcrypt";

const careSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
       validate: {
        validator: (v) => /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v),
        message: (props) => `${props.value} is not a valid email!`,
      },
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneNo: {
      type: String,
      required: true,
       validator: function (v) {
        return /^\d{10}$/.test(v);
      },
    },
    imageUrl: {
      type: String,
      required: true,
      unique: true,
    },
    verifiedStatus: {
      type: String,
      enum: ["VERIFIED", "UN-VERIFIED"],
      required: true,
      default:"UN-VERIFIED"
    },
    address: {
      type: String,
      required: true,
    },
    backgroundCheckStatus: {
      type: String,
      enum: ["PENDING", "COMPLETED", "REJECTED"],
      required: true,
      default:"PENDING"
    },
     refreshToken: {
      type: String,
    },
    availability: [
      {
        date: {
          type: Date,
          required: true,
        },
        startTime: {
          type: String,
          required: true,
        },
        duration: {
          type: Number,
          required: true,
        },
      },
    ],
    skills: {
      type: [{ type: String }],
      validate: [(arr) => arr.length > 0, "At least one Skill is required"],
    },
    document: [
      {
        name: {
          type: String,
          required: true,
        },
        documentUrl: {
          type: String,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

careSchema.pre("save", async function (next) {
  if (!this.isModified()) return next();
  try {
    const salt = bcrypt.genSalt(10);
    bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

careSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

export const Care = mongoose.model("Care", careSchema);
