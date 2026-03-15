const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const AppError = require("../utils/appError");

const getMe = asyncHandler(async (req, res) => {
  return res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    },
  });
});

const updateMe = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const updateData = {};

  if (name) updateData.name = String(name).trim();
  if (email) updateData.email = String(email).toLowerCase().trim();

  let user;
  try {
    user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError("Email already in use", 409);
    }
    throw err;
  }

  return res.json({
    user: { id: user._id, name: user.name, email: user.email },
  });
});

const deleteMe = asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.user._id);
  return res.json({ message: "Account deleted successfully" });
});

module.exports = {
  getMe,
  updateMe,
  deleteMe,
};
