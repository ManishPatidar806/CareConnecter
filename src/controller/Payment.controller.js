import Stripe from 'stripe';
import { Payment } from "../models/Payment.model.js";
import { JobPost } from "../models/JobPost.model.js";
import { AuditLog } from "../models/auditLog.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/AsyncHandler.js";
import { createAndSendNotification } from "../utils/socket.js";

// Initialize Stripe only if secret key is available
let stripe;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.warn('STRIPE_SECRET_KEY not found in environment variables. Payment features will be disabled.');
}

// Create payment intent for a job
const createPaymentIntent = asyncHandler(async (req, res) => {
  const { jobId, caregiverId } = req.body;
  const family = req.user;

  if (req.role !== 'family') {
    throw new ApiError(403, "Only families can create payments");
  }

  // Verify job post belongs to family
  const jobPost = await JobPost.findOne({ 
    _id: jobId, 
    familyId: family._id 
  }).populate('applications.careId', 'name email');

  if (!jobPost) {
    throw new ApiError(404, "Job post not found or access denied");
  }

  // Verify caregiver applied for this job
  const application = jobPost.applications.find(
    app => app.careId._id.toString() === caregiverId
  );

  if (!application) {
    throw new ApiError(400, "Caregiver did not apply for this job");
  }

  // Check if payment already exists
  const existingPayment = await Payment.findOne({
    jobPostId: jobId,
    careId: caregiverId,
    familyId: family._id
  });

  if (existingPayment) {
    throw new ApiError(400, "Payment already exists for this job");
  }

  try {
    // Check if Stripe is initialized
    if (!stripe) {
      throw new ApiError(500, "Payment service is not configured. Please contact administrator.");
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(jobPost.salary * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        jobId: jobId,
        caregiverId: caregiverId,
        familyId: family._id.toString(),
        elderName: jobPost.elderName
      }
    });

    // Create payment record in database
    const payment = await Payment.create({
      amount: jobPost.salary,
      paymentId: paymentIntent.id,
      paymentStatus: 'PENDING',
      familyId: family._id,
      careId: caregiverId,
      jobPostId: jobId
    });

    // Log audit action
    const auditLog = new AuditLog({
      actorId: family._id,
      actorTable: 'Family',
      action: 'Created payment intent',
      targetTable: 'Payment',
      targetId: payment._id
    });
    await auditLog.save();

    return res
      .status(201)
      .json(new ApiResponse(201, "Payment intent created successfully", {
        clientSecret: paymentIntent.client_secret,
        paymentId: payment._id,
        amount: jobPost.salary
      }));

  } catch (error) {
    console.error('Stripe payment intent creation failed:', error);
    throw new ApiError(500, "Failed to create payment intent");
  }
});

// Confirm payment (webhook handler)
const confirmPayment = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    if (!stripe) {
      throw new ApiError(500, "Payment service is not configured");
    }
    
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    throw new ApiError(400, 'Webhook signature verification failed');
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      
      // Update payment status in database
      const payment = await Payment.findOneAndUpdate(
        { paymentId: paymentIntent.id },
        { paymentStatus: 'COMPLETED' },
        { new: true }
      ).populate('familyId', 'name email')
       .populate('careId', 'name email');

      if (payment) {
        // Log audit action
        const auditLog = new AuditLog({
          actorId: payment.familyId._id,
          actorTable: 'Family',
          action: 'Payment completed',
          targetTable: 'Payment',
          targetId: payment._id
        });
        await auditLog.save();

        
        await createAndSendNotification({
          type: 'PAYMENT_RECEIVED',
          message: `Payment of $${payment.amount} received from ${payment.familyId.name}`,
          caregiverId: payment.careId._id,
          jobPostId: payment.jobPostId,
          recipientType: 'caregiver'
        });

        await createAndSendNotification({
          type: 'PAYMENT_RECEIVED',
          message: `Payment of $${payment.amount} successfully processed for ${payment.careId.name}`,
          familyId: payment.familyId._id,
          jobPostId: payment.jobPostId,
          recipientType: 'family'
        });
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      
      // Update payment status
      await Payment.findOneAndUpdate(
        { paymentId: failedPayment.id },
        { paymentStatus: 'REJECTED' }
      );
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return res.status(200).json({ received: true });
});

// Get payment history for family
const getFamilyPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const family = req.user;

  if (req.role !== 'family') {
    throw new ApiError(403, "Only families can access payment history");
  }

  const filter = { familyId: family._id };
  if (status) filter.paymentStatus = status;

  const payments = await Payment.find(filter)
    .populate('careId', 'name email phoneNo')
    .populate('jobPostId', 'elderName date startTime location')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Payment.countDocuments(filter);

  return res
    .status(200)
    .json(new ApiResponse(200, "Payment history retrieved successfully", {
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    }));
});

// Get payment history for caregiver
const getCaregiverPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const caregiver = req.user;

  if (req.role !== 'care') {
    throw new ApiError(403, "Only caregivers can access payment history");
  }

  const filter = { careId: caregiver._id };
  if (status) filter.paymentStatus = status;

  const payments = await Payment.find(filter)
    .populate('familyId', 'name email phoneNo')
    .populate('jobPostId', 'elderName date startTime location')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 });

  const total = await Payment.countDocuments(filter);

  return res
    .status(200)
    .json(new ApiResponse(200, "Payment history retrieved successfully", {
      payments,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    }));
});

// Get payment details
const getPaymentDetails = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const user = req.user;
  const userRole = req.role;

  let filter = { _id: paymentId };
  
  if (userRole === 'family') {
    filter.familyId = user._id;
  } else if (userRole === 'care') {
    filter.careId = user._id;
  } else {
    throw new ApiError(403, "Access denied");
  }

  const payment = await Payment.findOne(filter)
    .populate('familyId', 'name email phoneNo')
    .populate('careId', 'name email phoneNo')
    .populate('jobPostId', 'elderName date startTime durationHours location');

  if (!payment) {
    throw new ApiError(404, "Payment not found or access denied");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Payment details retrieved successfully", payment));
});

// Get payment statistics (for admin)
const getPaymentStats = asyncHandler(async (req, res) => {
  if (req.role !== 'admin') {
    throw new ApiError(403, "Only admins can access payment statistics");
  }

  const [
    totalPayments,
    completedPayments,
    pendingPayments,
    rejectedPayments,
    totalRevenue
  ] = await Promise.all([
    Payment.countDocuments(),
    Payment.countDocuments({ paymentStatus: 'COMPLETED' }),
    Payment.countDocuments({ paymentStatus: 'PENDING' }),
    Payment.countDocuments({ paymentStatus: 'REJECTED' }),
    Payment.aggregate([
      { $match: { paymentStatus: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ])
  ]);

  const stats = {
    totalPayments,
    completedPayments,
    pendingPayments,
    rejectedPayments,
    totalRevenue: totalRevenue[0]?.total || 0,
    successRate: totalPayments > 0 ? ((completedPayments / totalPayments) * 100).toFixed(2) : 0
  };

  return res
    .status(200)
    .json(new ApiResponse(200, "Payment statistics retrieved successfully", stats));
});

export {
  createPaymentIntent,
  confirmPayment,
  getFamilyPayments,
  getCaregiverPayments,
  getPaymentDetails,
  getPaymentStats
};