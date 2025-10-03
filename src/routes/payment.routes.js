import express, { Router } from "express";
import {
  createPaymentIntent,
  confirmPayment,
  getFamilyPayments,
  getCaregiverPayments,
  getPaymentDetails,
  getPaymentStats,
} from "../controller/Payment.controller.js";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";
import { validate } from "../utils/validators.js";
import { body } from "express-validator";

const paymentRouter = Router();

// Webhook endpoint (must be before other middlewares)
paymentRouter
  .route("/webhook")
  .post(express.raw({ type: "application/json" }), confirmPayment);

// Protected routes - require authentication
paymentRouter.use(jwtVerify);

// Create payment intent
paymentRouter
  .route("/create-intent")
  .post(
    validate([
      body("jobId").isMongoId().withMessage("Valid job ID is required"),
      body("caregiverId")
        .isMongoId()
        .withMessage("Valid caregiver ID is required"),
    ]),
    createPaymentIntent
  );

// Get payment history
paymentRouter.route("/family/history").get(getFamilyPayments);
paymentRouter.route("/caregiver/history").get(getCaregiverPayments);

// Get payment details
paymentRouter.route("/:paymentId").get(getPaymentDetails);

// Admin statistics
paymentRouter.route("/admin/stats").get(getPaymentStats);

export default paymentRouter;
