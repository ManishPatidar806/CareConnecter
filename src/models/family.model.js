import mongoose from "mongoose";
import bcrypt from "bcrypt";

const elderSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  age: {
    type: Number,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  phoneNo: {
    type: String,
  },
});

const familySchema = new mongoose.Schema(
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
      unique: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: 'Phone number must be exactly 10 digits'
      },
    },
    alternatePhoneNo: {
      type: String,
      default: function () {
        return this.phoneNo;
      },
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: 'Alternate phone number must be exactly 10 digits'
      },
    },
    imageUrl: {
      type: String,
      required: false,
      default: "https://via.placeholder.com/150"
    },
    address: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
    },
    elderInfo: [elderSchema],
  },
  { timestamps: true }
);

familySchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

familySchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

export const Family = mongoose.model("Family", familySchema);
