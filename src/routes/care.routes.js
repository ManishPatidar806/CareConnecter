import { Router } from "express";
import { login, signup, logout } from "../controller/Care.controller.js";

const carecareRouter = Router();

careRouter.route("/login").post(login);
careRouter.route("/signup").post(signup);
careRouter.route("/logout").get(logout);

export default careRouter;
