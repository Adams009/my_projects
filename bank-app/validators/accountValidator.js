import { body } from "express-validator";

export const depositValidator = [
  body("amount")
    .notEmpty().withMessage("Amount is required")
    .isFloat({ gt: 0 }).withMessage("Amount must be greater than 0"),
];

export const withdrawValidator = [
  body("amount")
    .notEmpty().withMessage("Amount is required")
    .isFloat({ gt: 0 }).withMessage("Amount must be greater than 0"),
];
