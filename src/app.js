import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import familyRouter from "./routes/family.routes.js";
import adminRouter from "./routes/admin.routes.js";
import careRouter from "./routes/care.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import paymentRouter from "./routes/payment.routes.js";
import jobPostRouter from "./routes/jobPost.routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    optionsSuccessStatus: 200,
    credentials: true,
  })
);
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));



app.use("/api/v1/family", familyRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/care", careRouter);
app.use("/api/v1/jobs", jobPostRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/payments", paymentRouter);

export default app;
