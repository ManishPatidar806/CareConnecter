import Stripe from "stripe";
import { Care } from "../models/care.model.js";
import { Payment } from "../models/Payment.model.js";
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
    console.log('Stripe initialized successfully for Admin Connect features');
    return stripeInstance;
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
    return null;
  }
};

// Get overview statistics
const getOverviewStats = asyncHandler(async (req, res) => {
  const { dateRange = "30days" } = req.query;

  // Calculate date filter
  const now = new Date();
  let startDate = new Date();

  switch (dateRange) {
    case "7days":
      startDate.setDate(now.getDate() - 7);
      break;
    case "30days":
      startDate.setDate(now.getDate() - 30);
      break;
    case "90days":
      startDate.setDate(now.getDate() - 90);
      break;
    case "1year":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  // Get payment statistics
  const paymentStats = await Payment.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalVolume: { $sum: "$amount" },
        totalFees: { $sum: "$platformFee" },
        transfersCompleted: {
          $sum: { $cond: [{ $eq: ["$transferStatus", "completed"] }, 1, 0] },
        },
        transfersPending: {
          $sum: { $cond: [{ $eq: ["$transferStatus", "pending"] }, 1, 0] },
        },
        transfersFailed: {
          $sum: { $cond: [{ $eq: ["$transferStatus", "failed"] }, 1, 0] },
        },
      },
    },
  ]);

  // Get account statistics
  const accountStats = await Care.aggregate([
    {
      $group: {
        _id: null,
        activeAccounts: {
          $sum: {
            $cond: [
              { $eq: ["$stripeConnectAccount.accountStatus", "active"] },
              1,
              0,
            ],
          },
        },
        pendingAccounts: {
          $sum: {
            $cond: [
              { $eq: ["$stripeConnectAccount.accountStatus", "pending"] },
              1,
              0,
            ],
          },
        },
        restrictedAccounts: {
          $sum: {
            $cond: [
              { $eq: ["$stripeConnectAccount.accountStatus", "restricted"] },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const overview = {
    totalVolume: paymentStats[0]?.totalVolume || 0,
    totalFees: paymentStats[0]?.totalFees || 0,
    transfersCompleted: paymentStats[0]?.transfersCompleted || 0,
    transfersPending: paymentStats[0]?.transfersPending || 0,
    transfersFailed: paymentStats[0]?.transfersFailed || 0,
    activeAccounts: accountStats[0]?.activeAccounts || 0,
    pendingAccounts: accountStats[0]?.pendingAccounts || 0,
    restrictedAccounts: accountStats[0]?.restrictedAccounts || 0,
  };

  res
    .status(200)
    .json(new ApiResponse(200, "Overview statistics retrieved", overview));
});

// Get all Connect accounts
const getAllConnectAccounts = asyncHandler(async (req, res) => {
  const { status = "all", search = "", page = 1, limit = 10 } = req.query;

  let filter = {
    "stripeConnectAccount.accountId": { $exists: true, $ne: null },
  };

  if (status !== "all") {
    filter["stripeConnectAccount.accountStatus"] = status;
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const accounts = await Care.find(filter)
    .select("name email stripeConnectAccount createdAt lastLoginAt")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Get earnings for each caregiver
  const accountsWithEarnings = await Promise.all(
    accounts.map(async (account) => {
      const earnings = await Payment.aggregate([
        {
          $match: {
            stripeConnectAccountId: account.stripeConnectAccount.accountId,
            transferStatus: "completed",
          },
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: "$netAmount" },
            completedTransfers: { $sum: 1 },
          },
        },
      ]);

      const pendingTransfers = await Payment.countDocuments({
        stripeConnectAccountId: account.stripeConnectAccount.accountId,
        transferStatus: "pending",
      });

      return {
        id: account._id,
        caregiverId: account._id,
        caregiverName: account.name,
        email: account.email,
        accountId: account.stripeConnectAccount.accountId,
        accountStatus: account.stripeConnectAccount.accountStatus,
        onboardingComplete: account.stripeConnectAccount.onboardingComplete,
        capabilitiesStatus:
          account.stripeConnectAccount.capabilitiesStatus || {},
        createdAt: account.createdAt,
        lastLoginAt: account.lastLoginAt,
        totalEarnings: earnings[0]?.totalEarnings || 0,
        completedTransfers: earnings[0]?.completedTransfers || 0,
        pendingTransfers,
      };
    })
  );

  const total = await Care.countDocuments(filter);

  const responseData = {
    accounts: accountsWithEarnings,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
    },
  };

  res
    .status(200)
    .json(new ApiResponse(200, "Connect accounts retrieved", responseData));
});

// Get transactions
const getTransactions = asyncHandler(async (req, res) => {
  const {
    dateRange = "30days",
    status = "all",
    page = 1,
    limit = 50,
  } = req.query;

  // Calculate date filter
  const now = new Date();
  let startDate = new Date();

  switch (dateRange) {
    case "7days":
      startDate.setDate(now.getDate() - 7);
      break;
    case "30days":
      startDate.setDate(now.getDate() - 30);
      break;
    case "90days":
      startDate.setDate(now.getDate() - 90);
      break;
    case "1year":
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  let filter = {
    createdAt: { $gte: startDate },
  };

  if (status !== "all") {
    filter.status = status;
  }

  const transactions = await Payment.find(filter)
    .populate("jobPostId", "familyId")
    .populate({
      path: "jobPostId",
      populate: {
        path: "familyId",
        select: "name",
      },
    })
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Get caregiver names for each transaction
  const transactionsWithNames = await Promise.all(
    transactions.map(async (payment) => {
      let familyName = "Unknown Family";
      let caregiverName = "Unknown Caregiver";

      if (payment.jobPostId && payment.jobPostId.familyId) {
        familyName = payment.jobPostId.familyId.name;
      }

      if (payment.stripeConnectAccountId) {
        const caregiver = await Care.findOne({
          "stripeConnectAccount.accountId": payment.stripeConnectAccountId,
        }).select("name");

        if (caregiver) {
          caregiverName = caregiver.name;
        }
      }

      return {
        id: payment._id,
        paymentId: payment.paymentIntentId,
        familyName,
        caregiverName,
        amount: payment.amount,
        platformFee: payment.platformFee,
        netAmount: payment.netAmount,
        status: payment.status,
        transferStatus: payment.transferStatus,
        createdAt: payment.createdAt,
        completedAt: payment.updatedAt,
      };
    })
  );

  const total = await Payment.countDocuments(filter);

  const responseData = {
    transactions: transactionsWithNames,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
    },
  };

  res
    .status(200)
    .json(new ApiResponse(200, "Transactions retrieved", responseData));
});

// Refresh account status from Stripe
const refreshAccountStatus = asyncHandler(async (req, res) => {
  const { accountId } = req.params;

  try {
    const stripe = initializeStripe();
    if (!stripe) {
      throw new ApiError(500, "Stripe service is not configured");
    }

    // Get account from Stripe
    const stripeAccount = await stripe.accounts.retrieve(accountId);

    // Update local record
    const caregiver = await Care.findOne({
      "stripeConnectAccount.accountId": accountId,
    });

    if (!caregiver) {
      throw new ApiError(404, "Caregiver account not found");
    }

    // Determine account status
    let accountStatus = "pending";
    if (stripeAccount.charges_enabled) {
      accountStatus = "active";
    } else if (stripeAccount.details_submitted) {
      accountStatus = "restricted";
    }

    caregiver.stripeConnectAccount = {
      ...caregiver.stripeConnectAccount,
      accountStatus,
      onboardingComplete: stripeAccount.details_submitted,
      capabilitiesStatus: {
        card_payments: stripeAccount.capabilities?.card_payments || "inactive",
        transfers: stripeAccount.capabilities?.transfers || "inactive",
      },
    };

    await caregiver.save();

    const responseData = {
      accountStatus: caregiver.stripeConnectAccount.accountStatus,
      capabilities: caregiver.stripeConnectAccount.capabilitiesStatus,
    };

    res
      .status(200)
      .json(new ApiResponse(200, "Account status refreshed", responseData));
  } catch (error) {
    console.error("Error refreshing account:", error);
    throw new ApiError(500, "Failed to refresh account status");
  }
});

// Approve restricted account
const approveAccount = asyncHandler(async (req, res) => {
  const { accountId } = req.params;

  try {
    const caregiver = await Care.findOne({
      "stripeConnectAccount.accountId": accountId,
    });

    if (!caregiver) {
      throw new ApiError(404, "Caregiver account not found");
    }

    caregiver.stripeConnectAccount.accountStatus = "active";
    await caregiver.save();

    res.status(200).json(new ApiResponse(200, "Account approved", null));
  } catch (error) {
    console.error("Error approving account:", error);
    throw new ApiError(500, "Failed to approve account");
  }
});

// Restrict account
const restrictAccount = asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const { reason } = req.body;

  try {
    const caregiver = await Care.findOne({
      "stripeConnectAccount.accountId": accountId,
    });

    if (!caregiver) {
      throw new ApiError(404, "Caregiver account not found");
    }

    caregiver.stripeConnectAccount.accountStatus = "restricted";
    caregiver.stripeConnectAccount.restrictionReason = reason;
    await caregiver.save();

    res.status(200).json(new ApiResponse(200, "Account restricted", null));
  } catch (error) {
    console.error("Error restricting account:", error);
    throw new ApiError(500, "Failed to restrict account");
  }
});

// Export data
const exportData = asyncHandler(async (req, res) => {
  const { type } = req.params;

  if (type === "accounts") {
    const accounts = await Care.find({
      "stripeConnectAccount.accountId": { $exists: true, $ne: null },
    }).select("name email stripeConnectAccount createdAt");

    let csv = "Name,Email,Account ID,Status,Onboarding Complete,Created At\n";

    accounts.forEach((account) => {
      csv += `"${account.name}","${account.email}","${
        account.stripeConnectAccount.accountId
      }","${account.stripeConnectAccount.accountStatus}","${
        account.stripeConnectAccount.onboardingComplete
      }","${account.createdAt.toISOString()}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=connect-accounts.csv"
    );
    res.send(csv);
  } else if (type === "transactions") {
    const transactions = await Payment.find({})
      .populate("jobPostId", "familyId")
      .populate({
        path: "jobPostId",
        populate: {
          path: "familyId",
          select: "name",
        },
      })
      .sort({ createdAt: -1 });

    let csv =
      "Payment ID,Family,Amount,Platform Fee,Net Amount,Status,Transfer Status,Created At\n";

    for (const payment of transactions) {
      const familyName = payment.jobPostId?.familyId?.name || "Unknown";
      csv += `"${payment.paymentIntentId}","${familyName}","${
        payment.amount
      }","${payment.platformFee}","${payment.netAmount}","${payment.status}","${
        payment.transferStatus
      }","${payment.createdAt.toISOString()}"\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=transactions.csv"
    );
    res.send(csv);
  } else {
    throw new ApiError(400, "Invalid export type");
  }
});

export {
  getOverviewStats,
  getAllConnectAccounts,
  getTransactions,
  refreshAccountStatus,
  approveAccount,
  restrictAccount,
  exportData,
};
