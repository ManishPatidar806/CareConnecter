import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Admin } from '../models/admin.model.js';
import { Care } from '../models/care.model.js';
import { Family } from '../models/family.model.js';

let io;

// Initialize Socket.IO
export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Middleware for authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        throw new Error('Authentication token required');
      }

      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const { _id, role } = decoded;

      let user;
      if (role === "admin") user = await Admin.findById(_id);
      if (role === "care") user = await Care.findById(_id);
      if (role === "family") user = await Family.findById(_id);

      if (!user) {
        throw new Error('Invalid user');
      }

      socket.userId = _id;
      socket.userRole = role;
      socket.user = user;
      
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  // Handle connections
  io.on('connection', (socket) => {
    console.log(`User ${socket.user.name} connected with role ${socket.userRole}`);
    
    // Join user to their own room for targeted notifications
    socket.join(`${socket.userRole}_${socket.userId}`);
    
    // Join role-based rooms
    socket.join(socket.userRole);

    // Handle joining specific job rooms (for job-specific updates)
    socket.on('join_job', (jobId) => {
      socket.join(`job_${jobId}`);
      console.log(`User ${socket.user.name} joined job room: ${jobId}`);
    });

    // Handle leaving job rooms
    socket.on('leave_job', (jobId) => {
      socket.leave(`job_${jobId}`);
      console.log(`User ${socket.user.name} left job room: ${jobId}`);
    });

    // Handle notification acknowledgment
    socket.on('notification_read', (notificationId) => {
      console.log(`Notification ${notificationId} read by user ${socket.user.name}`);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${socket.user.name} disconnected`);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Successfully connected to CareConnect',
      userId: socket.userId,
      userRole: socket.userRole
    });
  });

  return io;
};

// Helper function to get Socket.IO instance
export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Helper functions for sending notifications
export const sendNotificationToUser = (userId, userRole, notification) => {
  if (io) {
    io.to(`${userRole}_${userId}`).emit('new_notification', notification);
  }
};

export const sendNotificationToFamily = (familyId, notification) => {
  if (io) {
    io.to(`family_${familyId}`).emit('new_notification', notification);
  }
};

export const sendNotificationToCaregiver = (caregiverId, notification) => {
  if (io) {
    io.to(`care_${caregiverId}`).emit('new_notification', notification);
  }
};

export const sendJobUpdate = (jobId, update) => {
  if (io) {
    io.to(`job_${jobId}`).emit('job_update', update);
  }
};

export const broadcastToRole = (role, message) => {
  if (io) {
    io.to(role).emit('broadcast', message);
  }
};

// Advanced notification helper
export const createAndSendNotification = async (notificationData) => {
  try {
    const { Notification } = await import('../models/notification.model.js');
    
    // Create notification in database
    const notification = await Notification.create(notificationData);
    
    // Populate references for complete data
    await notification.populate([
      { path: 'familyId', select: 'name email' },
      { path: 'caregiverId', select: 'name email' },
      { path: 'jobPostId', select: 'elderName location salary' }
    ]);

    // Send real-time notification
    if (notificationData.recipientType === 'family' && notificationData.familyId) {
      sendNotificationToFamily(notificationData.familyId, notification);
    } else if (notificationData.recipientType === 'caregiver' && notificationData.caregiverId) {
      sendNotificationToCaregiver(notificationData.caregiverId, notification);
    }

    return notification;
  } catch (error) {
    console.error('Error creating and sending notification:', error);
    throw error;
  }
};