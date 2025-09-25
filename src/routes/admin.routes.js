import { Router } from "express";
import { login, signup, logout } from "../controller/Admin.controller.js";

const adminRouter = Router();

adminRouter.route("/login").post(login);
adminRouter.route("/signup").post(signup);
adminRouter.route("/logout").get(logout);

export default adminRouter;
