const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { jwtVerify } = require('../middlewares/jwtVerify.middleware');
const { ApiResponse } = require('../utils/ApiResponse');
const { ApiError } = require('../utils/ApiError');
const { AsyncHandler } = require('../utils/AsyncHandler');

// Notification schema
const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  userRole: {
    type: String,
    enum: ['family', 'caregiver', 'admin'],
    required: true
  },
  type: {
    type: String,
    enum: ['PAYMENT_RECEIVED', 'PAYMENT_SENT', 'TRANSFER_COMPLETED', 'TRANSFER_PENDING', 'PAYMENT_FAILED'],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  amount: {
    type: Number
  },
  paymentId: {
    type: String
  },
  caregiverName: String,
  familyName: String,
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  urgent: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Create indexes for better performance
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days

const Notification = mongoose.model('PaymentNotification', notificationSchema);

// Get notifications for user
router.get('/payment', jwtVerify, AsyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly = false } = req.query;
  const userId = req.user._id;
  const userRole = req.user.role;

  let filter = { 
    userId,
    userRole 
  };

  if (unreadOnly === 'true') {
    filter.read = false;
  }

  const notifications = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  const unreadCount = await Notification.countDocuments({
    userId,
    userRole,
    read: false
  });

  const total = await Notification.countDocuments(filter);

  res.status(200).json(new ApiResponse(200, {
    notifications: notifications.map(notification => ({
      ...notification,
      timestamp: notification.createdAt
    })),
    unreadCount,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total
    }
  }, 'Notifications retrieved'));
}));

// Create notification (internal use or for testing)
router.post('/payment', jwtVerify, AsyncHandler(async (req, res) => {
  const {
    type,
    title,
    message,
    amount,
    paymentId,
    urgent = false,
    recipientRole,
    recipientId,
    caregiverName,
    familyName
  } = req.body;

  // Validate required fields
  if (!type || !title || !message || !recipientRole || !recipientId) {
    throw new ApiError(400, 'Missing required fields');
  }

  const notification = new Notification({
    userId: recipientId,
    userRole: recipientRole,
    type,
    title,
    message,
    amount,
    paymentId,
    urgent,
    caregiverName,
    familyName
  });

  await notification.save();

  res.status(201).json(new ApiResponse(201, notification, 'Notification created'));
}));

// Mark notification as read
router.post('/:notificationId/read', jwtVerify, AsyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  const notification = await Notification.findOneAndUpdate(
    { 
      _id: notificationId, 
      userId 
    },
    { read: true },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  res.status(200).json(new ApiResponse(200, notification, 'Notification marked as read'));
}));

// Mark all notifications as read
router.post('/mark-all-read', jwtVerify, AsyncHandler(async (req, res) => {
  const userId = req.user._id;
  const userRole = req.user.role;

  const result = await Notification.updateMany(
    { 
      userId,
      userRole,
      read: false 
    },
    { read: true }
  );

  res.status(200).json(new ApiResponse(200, {
    modifiedCount: result.modifiedCount
  }, 'All notifications marked as read'));
}));

// Delete notification
router.delete('/:notificationId', jwtVerify, AsyncHandler(async (req, res) => {
  const { notificationId } = req.params;
  const userId = req.user._id;

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    userId
  });

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  res.status(200).json(new ApiResponse(200, null, 'Notification deleted'));
}));

// Helper function to create notifications (for use in other controllers)
const createPaymentNotification = async ({
  userId,
  userRole,
  type,
  title,
  message,
  amount,
  paymentId,
  urgent = false,
  caregiverName,
  familyName,
  metadata = {}
}) => {
  try {
    const notification = new Notification({
      userId,
      userRole,
      type,
      title,
      message,
      amount,
      paymentId,
      urgent,
      caregiverName,
      familyName,
      metadata
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Notification templates for common scenarios
const NotificationTemplates = {
  paymentReceived: (caregiverName, amount) => ({
    type: 'PAYMENT_RECEIVED',
    title: 'Payment Received',
    message: `Payment of $${(amount / 100).toFixed(2)} received from ${caregiverName}`,
    urgent: true
  }),

  paymentSent: (familyName, amount) => ({
    type: 'PAYMENT_SENT',
    title: 'Payment Sent',
    message: `Payment of $${(amount / 100).toFixed(2)} sent to ${familyName}`,
    urgent: false
  }),

  transferCompleted: (amount, recipientName) => ({
    type: 'TRANSFER_COMPLETED',
    title: 'Transfer Completed',
    message: `$${(amount / 100).toFixed(2)} has been transferred to ${recipientName}'s account`,
    urgent: true
  }),

  transferPending: (amount) => ({
    type: 'TRANSFER_PENDING',
    title: 'Transfer Processing',
    message: `Your transfer of $${(amount / 100).toFixed(2)} is being processed`,
    urgent: false
  }),

  paymentFailed: (amount, reason) => ({
    type: 'PAYMENT_FAILED',
    title: 'Payment Failed',
    message: `Payment of $${(amount / 100).toFixed(2)} failed${reason ? `: ${reason}` : ''}`,
    urgent: true
  })
};

// Export notification utilities
module.exports = router;
module.exports.createPaymentNotification = createPaymentNotification;
module.exports.NotificationTemplates = NotificationTemplates;
module.exports.Notification = Notification;