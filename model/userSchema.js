const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");

const userSchema = mongoose.Schema({
  fullname: {
    type: String,
    required: [true, "please enter your full name"],
    lowercase: true,
  },
  photo: String,
  email: {
    type: String,
    required: [true, "please enter your email"],
    lowercase: true,
    validate: [validator.isEmail, "please provide a valid email"],
    unique: true,
  },
  role: {
    type: String,
    enum: ["admin", "user", "visitor"],
    default: "user",
  },
  nin: {
    type: Number,
    required: [true, "please enter your identification number"],
    unique: true,
  },
  address: {
    type: String,
    required: [true, "please enter your address"],
  },
  password: {
    type: String,
    required: [true, "please enter your password"],
    minlength: 6,
    select: false,
  },
  confirmPassword: {
    type: String,
    required: [true, "please confirm your password"],
    validate: {
      validator: function (el) {
        return el === this.password;
      },
      message: "Passwords are not the same",
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

// hashing user's password
userSchema.pre("save", async function (next) {
  // it only works when the user password is modified
  if (!this.isModified("password")) return next();
  //hash the password here
  this.password = await bcrypt.hash(this.password, 12);
  this.confirmPassword = undefined;
  next();
});
userSchema.pre("save", function (next) {
  // that's if you don't change the password or just creating a new user
  if (!this.isModified("password") || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// this middleware queries all "find" keyword only for active users
userSchema.pre("/^find/", function (next) {
  //this points to the current query
  // $ne means not equal to : so, only users set to false will not be displayed
  // which means our deleted user, because of the function we created
  this.find({ active: { $ne: false } });
  next();
});

//verify the password when loggin in
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    console.log(changedTimestamp, JWTTimestamp);
    return JWTTimestamp < changedTimestamp;
  }
  // False means that the password hasn't changed
  return false;
};

// function to generate password reset token
// used in forgot-password controller
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model("User", userSchema);
