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
      validator: function (v) {
        return /^\d{10}$/.test(v);
      },
    },
    alternatePhoneNo: {
      type: String,
      default: function () {
        return this.phoneNo;
      },
      validator: function (v) {
        return /^\d{10}$/.test(v);
      },
    },
    imageUrl: {
      type: String,
      required: true,
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
    salt = bcrypt.genSalt(10);
    hashpassword = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

familySchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

export const Family = mongoose.model("Family", familySchema);
