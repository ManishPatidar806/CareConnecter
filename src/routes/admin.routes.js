import { Router } from "express";
import {
  login,
  signup,
  logout,
  getAllUser,
  getPendingCareGiver,
  approveCareGiver,
  getAuditLog,
  getDashboardStats,
} from "../controller/Admin.controller.js";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";
import validate, {
  adminSignupValidation,
  loginValidation,
} from "../utils/validators.js";
import { stripeConnectAdminRoutes } from "./admin.stripe-connect.routes.js";

const adminRouter = Router();

// Public Routes
adminRouter.route("/login").post(validate(loginValidation), login);
adminRouter.route("/signup").post(validate(adminSignupValidation), signup);
// Deprecated: use /api/v1/auth/refresh
adminRouter.route("/refresh").get((req,res)=>{
  return res.status(410).json({
    statusCode:410,
    message:"Deprecated. Use /api/v1/auth/refresh",
    success:false
  });
});

// Protected Routes
adminRouter.route("/logout").get(jwtVerify, logout);
adminRouter.route("/users").get(jwtVerify, getAllUser);
adminRouter.route("/caregivers/pending").get(jwtVerify, getPendingCareGiver);
adminRouter
  .route("/caregivers/:caregiverId/approve")
  .put(jwtVerify, approveCareGiver);
adminRouter.route("/audit-logs").get(jwtVerify, getAuditLog);
adminRouter.route("/dashboard/stats").get(jwtVerify, getDashboardStats);

// Stripe Connect management routes
adminRouter.use("/stripe-connect", stripeConnectAdminRoutes);

export default adminRouter;
