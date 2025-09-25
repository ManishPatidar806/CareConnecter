import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";

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

// Define Router here

app.use("/api/v1/family", familyRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/care", careRouter);

export default app;
