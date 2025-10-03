import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import familyRouter from "./routes/family.routes.js";
import adminRouter from "./routes/admin.routes.js";
import careRouter from "./routes/care.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import paymentRouter from "./routes/payment.routes.js";
import jobPostRouter from "./routes/jobPost.routes.js";
import bookingRouter from "./routes/booking.routes.js";
import stripeConnectRouter from "./routes/stripeConnect.routes.js";
import adminStripeRouter from "./routes/admin.stripe-connect.routes.js";
import authRouter from "./routes/auth.routes.js";
import errorHandler from "./middlewares/errorHandler.middleware.js";

const app = express();

app.use(
  cors({
    origin: true, //!here we need to add forntend url
    optionsSuccessStatus: 200,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS", "PATCH"],
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Basic health check (used by frontend & test scripts)
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: Date.now() });
});

app.use("/api/v1/family", familyRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/care", careRouter);
app.use("/api/v1/jobs", jobPostRouter);
app.use("/api/v1/bookings", bookingRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/stripe-connect", stripeConnectRouter);
app.use("/api/v1/admin/stripe-connect", adminStripeRouter);
app.use("/api/v1/auth", authRouter);

// 404 handler
app.use((req, res, next) => {
  return res.status(404).json({
    statusCode: 404,
    message: "Route not found",
    success: false,
  });
});

// Global error handler
app.use(errorHandler);

export default app;
