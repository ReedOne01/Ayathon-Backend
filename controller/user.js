const User = require("../model/userSchema");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const sharp = require("sharp");

const catchAsync = require("./../utils/catchAsync");
const AppError = require("../utils/appError");
const sendEmail = require("../utils/email");

//To upload photo
// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "public / img / users");
//   },
//   filename: (req, file, cb) => {
//     const ext = file.mimetype.split("/")[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });
const multerStorage = multer.memoryStorage();
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Not an image, please upload only images", 400), false);
  }
};
const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single("photo");
// photo uploading ends

// To resize the image to fit your own size-choice
exports.resizeUserphoto = (req, res, next) => {
  if (!req.file) return next();

  // filename
  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  // when using sharp-package, its better to save ur files on memory storage, not on disk storage
  // Thats why we need to disable the diskStorage settings in multerStorage function above
  sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat("jpeg")
    .jpeg({ quality: 90 })
    .toFile(`public / img / users/${req.file.filename}`);
  next();
};

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });

  return newObj;
};
const generateToken = catchAsync(async (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
});
const createSendToken = (user, statusCode, res) => {
  const token = generateToken(user._id);
  console.log(token);

  //send cookie with the jwt

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    // secure: true,
    httpOnly: true,
  };
  // secure only works when we are using https(in production mode)
  if (process.env.NODE_EN === "production") cookieOptions.secure = true;
  //send cookie with the jwt
  res.cookie("jwt", token, cookieOptions);

  //remove the password from the output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

const register = catchAsync(async (req, res, next) => {
  const { fullname, password, confirmPassword, email, address, nin } = req.body;

  // if (password !== confirmPassword)
  //   return next(new AppError("password must be the same", 404));

  const existingUser = await User.findOne({ email });
  if (existingUser) return next(new AppError("user already exists", 404));

  // const salt = 12;
  // const hashedPassword = await bcrypt.hash(password, salt);
  const newUser = await User.create({
    fullname,
    email,
    password,
    confirmPassword,
    // password: hashedPassword,
    address,
    nin,
  });
  createSendToken(newUser, 201, res);

  // done at the top with createSendToken function
  // res.status(200).json({
  //   token: await generateToken(newUser._id),
  //   data: newUser,
  // });
});
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password)
    return next(new AppError("please enter your email or password", 400));

  const existingUser = await User.findOne({ email }).select("+password");
  // if (!existingUser) return next(new AppError("user does  not exists", 400));

  //comparing user password from the schema
  if (
    !existingUser ||
    !(await User.correctPassword(password, existingUser.password))
  ) {
    return next(new AppError("Incorrect username or password", 401));
  }
  // const comparePassword = await bcrypt.compare(password, existingUser.password);
  // if (!comparePassword) return next(new AppError("incorrect credentials", 400));

  createSendToken(existingUser, 200, res);

  // const Token = generateToken(existingUser._id);
  // res.status(200).send({
  //   message: "user login successfully",
  //   token: Token,
  // });
});

const allUsers = catchAsync(async (req, res, next) => {
  const user = await User.find();
  res.status(200).json({
    Total: user.length,
    user,
  });
});
const oneUser = catchAsync(async (req, res, next) => {
  const nin = req.params.nin;
  const user = await User.findOne(nin);
  if (!user) return next(new AppError("user not found", 404));

  res.status(200).json({
    user,
  });
});

const forgotPassword = catchAsync(
  async (req, res, next) => {
    // 1) get the user from database
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return next(new AppError("user not found", 404));
    }
    // 2) generate random reset token
    // this is function is already done in the userSchema
    const resetToken = await User.createPasswordResetToken();
    // validateBeforeSave helps to deactivate all validation in the userSchema
    await User.save({ validateBeforeSave: false });

    // 3) send it to user's email address
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/api/resetPassword/${resetToken}`;

    const message = `Forgot Password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget ypur password, please ignore this email!`;
    try {
      await sendEmail({
        email: user.email,
        subject: "Your password reset token (valid for 10mins)",
        message,
      });

      res.status(200).json({
        status: "success",
        message: "Token sent to email!",
      });
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      return next(
        new AppError("There was an error sending the mail. Please try again!"),
        500
      );
    }
  },
  {
    toJSON: { virtual: true },
    toObject: { virtual: true },
  }
);

const resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  // firstly, you have to encrypt the passwordResetToken again so as to compare it with the one stored in the database
  const hashToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("Invalid token or token has expired", 400));
  }
  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  // here, we need the vailidator to validate the password and confirmPassword
  //thats why we didn't deactivate with the keyword "vailidateBeforeSave:false"
  await user.save();
  // 3) Update changedPasswordAt property for the user

  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);

  // const Token = await generateToken(user._id);
  // res.status(200).json({
  //   status: "success",
  //   Token,
  // });
});

const updatePassword = catchAsync(async (req, res, next) => {
  //get the user from the db
  const user = await User.findById(req.user.id).select("+password");

  // check if the curent password is correct
  if (!(await user.correctPassword(req.body.confirmPassword, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }
  // 3) if so, update password
  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  await user.save();
  // 4) sent JWT
  createSendToken(user, 200, res);
});

const updateUserData = catchAsync(async (req, res, next) => {
  console.log(file);
  console.log(req.body);
  // 1) create error if the user  POSTs password data
  if (req.body.password || req.body.confirmPassword) {
    next(
      new AppError(
        "This route is not for password update. Please use '/updateMyPassword'",
        400
      )
    );
  }
  // 2) filter out the unwanted fields names that are not allowed to be updated
  // filterObj function is created at the top
  const filteredBody = filterObj(req.body, "name", "email");
  //  To update photo fields
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) update user data
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });
  res.status(201).json({
    status: "success",
    data: {
      user: updatedUser,
    },
  });
});

const deleteUser = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: "success",
    data: null,
  });
});

module.exports = {
  register,
  login,
  deleteUser,
  allUsers,
  oneUser,
  forgotPassword,
  resetPassword,
  updatePassword,
  updateUserData,
  deleteUser,
};
