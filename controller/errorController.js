const AppError = require("./../utils/appError");

// this works for invalid request in mongodb
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path} : ${err.value}`;
  return next(new AppError(message, 400));
};
// this works for duplication feild in mongodb
// (["'])(?:(?=(\\?))\2.)*?\1
// (["'])(\\?.)*?\1
// const handleDuplicateFieldsDB = (err) => {
//   const value = err.errmessage.match(/(["'])(\\?.)*?\1/)[1];
//   console.log(value);
//   const message = `Duplicate field value: ${value}. Please use another value`;
//   return new AppError(message, 400);
// };

// const handleDuplicateFieldsDB = (err) => {
//   const match = err.errmessage.match(/(['"])(.*?)\1/);
//   if (match && match[2]) {
//     const value = match[2];
//     console.log(value);
//     const message = `Duplicate field value: ${value}. Please use another value`;
//     return new AppError(message, 400);
//   }
//   // Handle the case where no match is found
//   return new AppError("Unknown error", 500);
// };

const handleDuplicateFieldsDB = (error) => {
  // Check if err is defined and has an errmsg property
  if (error && error.errmsg) {
    const value = err.errmessage.match(/(["'])(\\?.)*?\1/);
    if (value && value[1]) {
      console.log(value[1]);
      const message = `Duplicate field value: ${value[1]}. Please use another value`;
      return new AppError(message, 400);
    }
  }

  // Handle the case where err is undefined or doesn't have an errmsg property
  return new AppError("Unknown error", 500);
};

const handleValidatidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")} `;
  return next(new AppError(message, 400));
};
const handleJWTError = () => new AppError("Invalid Token, Please login again");

const handleJWTExpiredError = () =>
  new AppError("Your token has expired, please login again", 401);

// error in development mode
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    err: err,
    message: err.message,
    stack: err.stack,
  });
};

// error in production mode
const sendErrorProd = (err, res) => {
  // Operational,trusted error : send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });

    //programming or other unknown error : don't leak error details
  } else {
    // 1) log the error
    console.error("ERROR ", err);

    // 2) send generic message
    res.status(500).json({
      status: "error",
      message: "Something went very wrong",
    });
  }
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === "production") {
    let error = { ...err };
    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.code === "ValidationError")
      error = handleValidatidationErrorDB(error);
    if (error.name === "jsonWebTokenError") error = handleJWTError();
    if (error.name === "TokenExpiredError") error = handleJWTExpiredError();
    sendErrorProd(err, res);
  }
};
