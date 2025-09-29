import { Router } from "express";
import {
  login,
  signup,
  logout,
  getProfile,
  updateProfile,
  addElder,
  updateElder,
  removeElder,
} from "../controller/Family.controller.js";
import validate, {
  elderValidation,
  familySignupValidation,
  loginValidation,
} from "../utils/validators.js";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";
import { upload } from "../utils/cloudinary.js";
const familyRouter = Router();

// Public Routes
familyRouter.route("/login").post(validate(loginValidation), login);
familyRouter.route("/signup").post(validate(familySignupValidation), signup);

// Protected Routes
familyRouter.route("/logout").get(jwtVerify, logout);
familyRouter.route("/profile").get(jwtVerify, getProfile);
familyRouter.route("/profile").put(jwtVerify, updateProfile);
familyRouter
  .route("/elder")
  .post(jwtVerify, upload.single("elderImage"), validate(elderValidation), addElder);
familyRouter
  .route("/elder/:elderId")
  .put(jwtVerify, upload.single("elderImage"), validate(elderValidation), updateElder);
familyRouter.route("/elder/:elderId").delete(jwtVerify, removeElder);

export default familyRouter;
