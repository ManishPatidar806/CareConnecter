import { Router } from "express";
import {
  login,
  signup,
  logout,
  getProfile,
  updateProfile,
  addAvailability,
  updateAvailability,
  removeAvailability,
  addDocument,
  removeDocument,
  getAllCaregivers,
} from "../controller/Care.controller.js";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";
import { upload } from "../utils/cloudinary.js";

const careRouter = Router();

// Public Routes
careRouter.route("/login").post(login);
careRouter.route("/signup").post(upload.single("profileImage"), signup);
careRouter.route("/all").get(getAllCaregivers);

// Protected routes
careRouter.route("/logout").get(jwtVerify, logout);
careRouter.route("/profile").get(jwtVerify, getProfile);
careRouter.route("/profile").put(jwtVerify, upload.single("profileImage"), updateProfile);
careRouter.route("/availability").post(jwtVerify, addAvailability);
careRouter
  .route("/availability/:availabilityId")
  .put(jwtVerify, updateAvailability);
careRouter
  .route("/availability/:availabilityId")
  .delete(jwtVerify, removeAvailability);
careRouter
  .route("/document")
  .post(jwtVerify, upload.single("document"), addDocument);
careRouter.route("/document/:documentId").delete(jwtVerify, removeDocument);

export default careRouter;
