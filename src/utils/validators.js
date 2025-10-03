import { body, validationResult } from "express-validator";
import ApiError from "./ApiError.js";

export const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    console.log("Errors are ", errors);
    const extractedErrors = errors.array().map((err) => ({
      [err.path]: err.msg,
    }));

    return next(
      new ApiError(
        400,
        errors.errors[0].msg,
        "",
        extractedErrors
      )
    );
  };
};
// Common validations
export const emailValidation = body("email")
  .isEmail()
  .withMessage("Please provide a valid email")
  .normalizeEmail();

export const passwordValidation = body("password")
  .isLength({ min: 6 })
  .withMessage("Password must be at least 6 characters long")
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .withMessage(
    "Password must contain at least one uppercase letter, one lowercase letter, and one number"
  );

export const phoneValidation = body("phoneNo")
  .matches(/^\d{10}$/)
  .withMessage("Phone number must be exactly 10 digits");

export const nameValidation = body("name")
  .isLength({ min: 2, max: 50 })
  .withMessage("Name must be between 2 and 50 characters")
  .matches(/^[a-zA-Z\s]+$/)
  .withMessage("Name can only contain letters and spaces");

export const usernameValidation = body("username")
  .isLength({ min: 3, max: 20 })
  .withMessage("Username must be between 3 and 20 characters")
  .matches(/^[a-zA-Z0-9_]+$/)
  .withMessage("Username can only contain letters, numbers, and underscores");

export const familySignupValidation = [
  nameValidation,
  emailValidation,
  usernameValidation,
  passwordValidation,
  phoneValidation,
  body("alternatePhoneNo")
    .optional()
    .matches(/^\d{10}$/)
    .withMessage("Alternate phone number must be exactly 10 digits"),
  body("address")
    .isLength({ min: 5, max: 200 })
    .withMessage("Address must be between 5 and 200 characters"),
];

// Caregiver specific validations
export const caregiverSignupValidation = [
  nameValidation,
  emailValidation,
  usernameValidation,
  passwordValidation,
  phoneValidation,
  body("address")
    .isLength({ min: 5, max: 200 })
    .withMessage("Address must be between 5 and 200 characters"),
  body("skills")
    .isArray({ min: 1 })
    .withMessage("At least one skill is required"),
  body("skills.*")
    .isIn([
      "basic_care",
      "medical_care",
      "dementia_care",
      "mobility_assistance",
      "medication_management",
      "companionship",
      "meal_preparation",
      "housekeeping",
      "personal_hygiene",
      "transportation",
      "emergency_response",
      "physical_therapy",
    ])
    .withMessage("Invalid skill provided"),
];

// Admin specific validations
export const adminSignupValidation = [
  nameValidation,
  emailValidation,
  passwordValidation,
  phoneValidation,
];

// Login validation
export const loginValidation = [
  emailValidation,
  body("password").notEmpty().withMessage("Password is required"),
  body("role").isIn(["family", "care", "admin"]).withMessage("Invalid role"),
];

// Elder information validation
export const elderValidation = [
  body("name")
    .isLength({ min: 2, max: 50 })
    .withMessage("Elder name must be between 2 and 50 characters"),
  body("age")
    .isInt({ min: 1, max: 120 })
    .withMessage("Age must be between 1 and 120"),
  body("address")
    .isLength({ min: 5, max: 200 })
    .withMessage("Address must be between 5 and 200 characters"),
  body("phoneNo")
    .optional()
    .matches(/^\d{10}$/)
    .withMessage("Phone number must be exactly 10 digits"),
];

// Job post validation
export const jobPostValidation = [
  body("elderName")
    .isLength({ min: 2, max: 50 })
    .withMessage("Elder name must be between 2 and 50 characters"),
  body("date").isISO8601().withMessage("Please provide a valid date"),
  body("startTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please provide valid time in HH:MM format"),
  body("durationHours")
    .isFloat({ min: 0.5, max: 24 })
    .withMessage("Duration must be between 0.5 and 24 hours"),
  body("salary")
    .isFloat({ min: 0 })
    .withMessage("Salary must be a positive number"),
  body("location")
    .isLength({ min: 5, max: 200 })
    .withMessage("Location must be between 5 and 200 characters"),
  body("skillRequired")
    .isArray({ min: 1 })
    .withMessage("At least one skill is required"),
  body("skillRequired.*")
    .isIn([
      "basic_care",
      "medical_care",
      "dementia_care",
      "mobility_assistance",
      "medication_management",
      "companionship",
      "meal_preparation",
      "housekeeping",
      "personal_hygiene",
      "transportation",
      "emergency_response",
      "physical_therapy",
    ])
    .withMessage("Invalid skill provided"),
];

export default validate;
