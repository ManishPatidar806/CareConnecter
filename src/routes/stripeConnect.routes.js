import express, { Router } from "express";
import {
  createConnectAccount,
  createAccountLink,
  getAccountStatus,
  createLoginLink,
  getAccountBalance,
  handleConnectWebhook
} from "../controller/StripeConnect.controller.js";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";

const stripeConnectRouter = Router();

// Webhook endpoint (must be before other middlewares)
stripeConnectRouter
  .route("/webhook")
  .post(express.raw({ type: "application/json" }), handleConnectWebhook);

// Protected routes - require authentication
stripeConnectRouter.use(jwtVerify);

// Create Stripe Connect account
stripeConnectRouter
  .route("/create-account")
  .post(createConnectAccount);

// Create account onboarding link
stripeConnectRouter
  .route("/onboarding-link")
  .post(createAccountLink);

// Get account status
stripeConnectRouter
  .route("/account-status")
  .get(getAccountStatus);

// Create dashboard login link
stripeConnectRouter
  .route("/dashboard-link")
  .post(createLoginLink);

// Get account balance
stripeConnectRouter
  .route("/balance")
  .get(getAccountBalance);

export default stripeConnectRouter;