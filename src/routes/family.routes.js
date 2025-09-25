import { Router } from "express";
import { login, signup, logout } from "../controller/Family.controller.js";

const familyRouter = Router();

familyRouter.route("/login").post(login);
familyRouter.route("/signup").post(signup);
familyRouter.route("/logout").get(logout);

export default familyRouter;
