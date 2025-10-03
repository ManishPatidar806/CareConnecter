import { Router } from "express";
import { getMe, refreshToken } from "../controller/Auth.controller.js";
import jwtVerify from "../middlewares/jwtVerify.middleware.js";

// Unified auth router for cross-role session refresh
const authRouter = Router();

authRouter.get("/refresh", refreshToken);
authRouter.route("/me").get(jwtVerify, getMe);

export default authRouter;
