// const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const User = require("./../model/userSchema");

const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if its there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startswith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(
      new AppError("You are not login! Please login to get access.", 401)
    );
  }

  // 2) Verification token
  // const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const decoded = await jwt.decode(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(
      new AppError("The user belonging to this token does no longer exist", 401)
    );
  }
  // 4) Check if user change password after token was issued
  // This instances-method is created in the userSchema
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please login again", 401)
    );
  }
  //GRANY ACCESS TO PROTECTED ROUTE
  req.user = freshUser;
  next();
});

const restrictTo = (...roles) => {
  return (req, res, next) => {
    //roles is an array ['admin', 'visitor','user']
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("you do not have permission to perform this action ", 403)
      );
    }
    next();
  };
};

module.exports = { protect, restrictTo };
