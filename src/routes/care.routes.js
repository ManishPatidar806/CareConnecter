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
import validate, { 
  caregiverSignupValidation, 
  loginValidation 
} from "../utils/validators.js";
import { body } from "express-validator";

const careRouter = Router();

// Public Routes
careRouter.route("/login").post(validate(loginValidation), login);
careRouter.route("/signup").post(upload.single("profileImage"), validate(caregiverSignupValidation), signup);
// Deprecated: use /api/v1/auth/refresh
careRouter.route("/refresh").get((req,res)=>{
  return res.status(410).json({
    statusCode:410,
    message:"Deprecated. Use /api/v1/auth/refresh",
    success:false
  });
});
careRouter.route("/all").get(getAllCaregivers);

// Protected routes
careRouter.route("/logout").get(jwtVerify, logout);
careRouter.route("/profile").get(jwtVerify, getProfile);
careRouter.route("/profile").put(jwtVerify, upload.single("profileImage"), updateProfile);
careRouter.route("/availability").post(jwtVerify, validate([
  body('date').isISO8601().withMessage('Please provide a valid date'),
  body('startTime').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Please provide valid time in HH:MM format'),
  body('duration').isFloat({ min: 0.5, max: 24 }).withMessage('Duration must be between 0.5 and 24 hours')
]), addAvailability);
careRouter
  .route("/availability/:availabilityId")
  .put(jwtVerify, validate([
    body('date').optional().isISO8601().withMessage('Please provide a valid date'),
    body('startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Please provide valid time in HH:MM format'),
    body('duration').optional().isFloat({ min: 0.5, max: 24 }).withMessage('Duration must be between 0.5 and 24 hours')
  ]), updateAvailability);
careRouter
  .route("/availability/:availabilityId")
  .delete(jwtVerify, removeAvailability);
careRouter
  .route("/document")
  .post(jwtVerify, upload.single("document"), validate([
    body('name').isLength({ min: 2, max: 100 }).withMessage('Document name must be between 2 and 100 characters')
  ]), addDocument);
careRouter.route("/document/:documentId").delete(jwtVerify, removeDocument);

export default careRouter;
