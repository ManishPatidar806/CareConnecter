import Stripe from 'stripe';
import { Care } from "../models/care.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";

// Lazy Stripe initialization
let stripeInstance = null;

const initializeStripe = () => {
  if (stripeInstance) return stripeInstance;
  
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.warn('STRIPE_SECRET_KEY not found in environment variables. Stripe Connect features will be disabled.');
      return null;
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized successfully for Connect features');
    return stripeInstance;
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
    return null;
  }
};

// Create Stripe Connect account for caregiver
const createConnectAccount = asyncHandler(async (req, res) => {
  const caregiver = req.user;

  if (req.user.role !== 'care') {
    throw new ApiError(403, "Only caregivers can create Connect accounts");
  }

  // Check if caregiver already has a Connect account
  if (caregiver.stripeConnectAccount?.accountId) {
    throw new ApiError(400, "Connect account already exists for this caregiver");
  }

  try {
    const stripe = initializeStripe();
    if (!stripe) {
      throw new ApiError(500, "Stripe service is not configured");
    }

    // Create Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      email: caregiver.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_type: 'individual',
      individual: {
        email: caregiver.email,
        first_name: caregiver.name.split(' ')[0],
        last_name: caregiver.name.split(' ')[1] || '',
        phone: caregiver.phoneNo,
      },
    });

    // Update caregiver record with Connect account information
    await Care.findByIdAndUpdate(
      caregiver._id,
      {
        $set: {
          'stripeConnectAccount.accountId': account.id,
          'stripeConnectAccount.accountStatus': 'PENDING',
          'stripeConnectAccount.lastUpdated': new Date(),
        }
      },
      { new: true }
    );

    // Log audit action
    const auditLog = new AuditLog({
      actorId: caregiver._id,
      actorTable: 'Care',
      action: 'Created Stripe Connect account',
      targetTable: 'Care',
      targetId: caregiver._id
    });
    await auditLog.save();

    return res
      .status(201)
      .json(new ApiResponse(201, "Connect account created successfully", {
        accountId: account.id,
        accountStatus: 'PENDING'
      }));

  } catch (error) {
    console.error('Stripe Connect account creation failed:', error);
    throw new ApiError(500, "Failed to create Connect account");
  }
});

// Create account onboarding link
const createAccountLink = asyncHandler(async (req, res) => {
  const caregiver = req.user;

  if (req.user.role !== 'care') {
    throw new ApiError(403, "Only caregivers can access onboarding");
  }

  const stripe = initializeStripe();
  if (!stripe) {
    throw new ApiError(500, "Stripe service is not configured");
  }

  if (!caregiver.stripeConnectAccount?.accountId) {
    throw new ApiError(400, "No Connect account found. Please create an account first");
  }

  try {

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: caregiver.stripeConnectAccount.accountId,
      refresh_url: `${process.env.FRONTEND_URL}/caregiver/payment-setup?refresh=true`,
      return_url: `${process.env.FRONTEND_URL}/caregiver/payment-setup?success=true`,
      type: 'account_onboarding',
    });

    return res
      .status(200)
      .json(new ApiResponse(200, "Onboarding link created successfully", {
        url: accountLink.url
      }));

  } catch (error) {
    console.error('Account link creation failed:', error);
    throw new ApiError(500, "Failed to create onboarding link");
  }
});

// Get Connect account status
const getAccountStatus = asyncHandler(async (req, res) => {
  const caregiver = req.user;

  if (req.user.role !== 'care') {
    throw new ApiError(403, "Only caregivers can check account status");
  }

  if (!caregiver.stripeConnectAccount?.accountId) {
    return res
      .status(200)
      .json(new ApiResponse(200, "Account status retrieved", {
        accountStatus: 'NOT_CREATED',
        onboardingComplete: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false
      }));
  }

  try {
    const stripe = initializeStripe();
    if (!stripe) {
      throw new ApiError(500, "Stripe service is not configured");
    }

    // Retrieve account from Stripe
    const account = await stripe.accounts.retrieve(
      caregiver.stripeConnectAccount.accountId
    );

    // Determine account status
    let accountStatus = 'PENDING';
    if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
      accountStatus = 'ACTIVE';
    } else if (account.requirements?.disabled_reason) {
      accountStatus = 'RESTRICTED';
    }

    // Update local record
    await Care.findByIdAndUpdate(
      caregiver._id,
      {
        $set: {
          'stripeConnectAccount.accountStatus': accountStatus,
          'stripeConnectAccount.onboardingComplete': account.details_submitted,
          'stripeConnectAccount.detailsSubmitted': account.details_submitted,
          'stripeConnectAccount.chargesEnabled': account.charges_enabled,
          'stripeConnectAccount.payoutsEnabled': account.payouts_enabled,
          'stripeConnectAccount.lastUpdated': new Date(),
        }
      },
      { new: true }
    );

    return res
      .status(200)
      .json(new ApiResponse(200, "Account status retrieved successfully", {
        accountId: account.id,
        accountStatus: accountStatus,
        onboardingComplete: account.details_submitted,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirements: account.requirements
      }));

  } catch (error) {
    console.error('Account status retrieval failed:', error);
    throw new ApiError(500, "Failed to retrieve account status");
  }
});

// Create login link for caregiver to access Stripe Dashboard
const createLoginLink = asyncHandler(async (req, res) => {
  const caregiver = req.user;

  if (req.user.role !== 'care') {
    throw new ApiError(403, "Only caregivers can access dashboard");
  }

  const stripe = initializeStripe();
  if (!stripe) {
    throw new ApiError(500, "Stripe service is not configured");
  }

  if (!caregiver.stripeConnectAccount?.accountId) {
    throw new ApiError(400, "No Connect account found");
  }

  if (!caregiver.stripeConnectAccount?.chargesEnabled) {
    throw new ApiError(400, "Account setup is not complete");
  }

  try {

    // Create login link
    const loginLink = await stripe.accounts.createLoginLink(
      caregiver.stripeConnectAccount.accountId
    );

    return res
      .status(200)
      .json(new ApiResponse(200, "Dashboard login link created successfully", {
        url: loginLink.url
      }));

  } catch (error) {
    console.error('Login link creation failed:', error);
    throw new ApiError(500, "Failed to create dashboard login link");
  }
});

// Get Connect account balance (optional)
const getAccountBalance = asyncHandler(async (req, res) => {
  const caregiver = req.user;

  if (req.user.role !== 'care') {
    throw new ApiError(403, "Only caregivers can check balance");
  }

  if (!caregiver.stripeConnectAccount?.accountId) {
    throw new ApiError(400, "No Connect account found");
  }

  try {
    const stripe = initializeStripe();
    if (!stripe) {
      throw new ApiError(500, "Stripe service is not configured");
    }

    // Get account balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: caregiver.stripeConnectAccount.accountId
    });

    return res
      .status(200)
      .json(new ApiResponse(200, "Account balance retrieved successfully", {
        available: balance.available,
        pending: balance.pending
      }));

  } catch (error) {
    console.error('Balance retrieval failed:', error);
    throw new ApiError(500, "Failed to retrieve account balance");
  }
});

// Handle Connect account webhook events
const handleConnectWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const stripe = initializeStripe();
    if (!stripe) {
      throw new ApiError(500, "Stripe service is not configured");
    }
    
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Connect webhook signature verification failed:', err);
    throw new ApiError(400, 'Webhook signature verification failed');
  }

  // Handle the event
  if (event.type === 'account.updated') {
    const account = event.data.object;
    
    // Find and update caregiver account status
    const caregiver = await Care.findOne({
      'stripeConnectAccount.accountId': account.id
    });

    if (caregiver) {
      let accountStatus = 'PENDING';
      if (account.details_submitted && account.charges_enabled && account.payouts_enabled) {
        accountStatus = 'ACTIVE';
      } else if (account.requirements?.disabled_reason) {
        accountStatus = 'RESTRICTED';
      }

      await Care.findByIdAndUpdate(caregiver._id, {
        $set: {
          'stripeConnectAccount.accountStatus': accountStatus,
          'stripeConnectAccount.onboardingComplete': account.details_submitted,
          'stripeConnectAccount.detailsSubmitted': account.details_submitted,
          'stripeConnectAccount.chargesEnabled': account.charges_enabled,
          'stripeConnectAccount.payoutsEnabled': account.payouts_enabled,
          'stripeConnectAccount.lastUpdated': new Date(),
        }
      });

      // Log audit action
      const auditLog = new AuditLog({
        actorId: caregiver._id,
        actorTable: 'Care',
        action: `Connect account updated - status: ${accountStatus}`,
        targetTable: 'Care',
        targetId: caregiver._id
      });
      await auditLog.save();
    }
  } else {
    console.log(`Unhandled Connect event type ${event.type}`);
  }

  return res.status(200).json({ received: true });
});

export {
  createConnectAccount,
  createAccountLink,
  getAccountStatus,
  createLoginLink,
  getAccountBalance,
  handleConnectWebhook
};