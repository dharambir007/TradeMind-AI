const jwt = require("jsonwebtoken");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");

function signToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    throw new AppError("Name, email, and password are required.", 400);
  }

  const normalizedEmail = String(email).toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new AppError("Account already exists. Please log in.", 409);
  }

  const user = await User.create({
    name: String(name).trim(),
    email: normalizedEmail,
    password,
  });

  return res.status(201).json({
    token: signToken(user),
    user: { id: user._id, name: user.name, email: user.email },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError("Email and password are required.", 400);
  }

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user) {
    throw new AppError("Invalid credentials.", 401);
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    throw new AppError("Invalid credentials.", 401);
  }

  return res.json({
    token: signToken(user),
    user: { id: user._id, name: user.name, email: user.email },
  });
});

module.exports = {
  signup,
  login,
};
