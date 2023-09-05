const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const express = require("express");
const app = express();
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");

const connectDB = require("./config/database");
const router = require("./routes/route");
const AppError = require("./utils/appError");
const DuplicateKeyError = require("./utils/duplicateKeyError");
const globalErrorHandler = require("./controller/errorController");
// const

// process.on serves as an event listener
// handles all errors anywhere in the code outside of the express and mongodb
process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

require("dotenv").config();
connectDB(process.env.MONGO_URI);

// global middleware
///// SECURITY      //
// set security http headers
app.use(helmet());
//      SECURITY  ////////

//development logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}
///// SECURITY      //
/// this express-rate-limiting middleware helps with protection against a brute force attack or denial of service attacks
// limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP address, try again in an hour",
});

app.use("/api", limiter);
//      SECURITY  ////////

// body parser
// use limit: to limit the amount of  data that comes in the body
app.use(express.json({ limit: "10kb" }));
// app.use(express.urlencoded({ extended: true }));

// Data sanitization against noSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
// This cleans any user input from malicious HTML code
app.use(xss());

// means Http Parameters Pollution
// To prevent parameters  pollution, e.g, passing more than one parameter in query at a time. e.g, sorting twice in a single request query
app.use(hpp());
// use whitelist for any property you want to have its duplicate. e.g, you are querying for "size=35&size=39"
// app.use(hpp({whitelist:[one, second, three, and so on]}));

app.use(cors());
// app.use(morgan("dev"));
app.use("/api", router);

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof DuplicateKeyError) {
    return res
      .status(400)
      .json({ error: "Duplicate key error", message: err.message });
  }
  next(err);
});

// all routes error handler
app.all("*", (req, res, next) => {
  next(new AppError(`cannot get ${req.originalUrl} on this server`, 404));
  // res.status(404).json({
  //   status: "fail",
  //   message: ` cannot get ${req.originalUrl} on this server`,
  // });
});

//global error handler
app.use(globalErrorHandler);

const port = process.env.PORT || 4000;
const server = app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});

// errors that are outside of express
//it handles all errors that occurs in asynchronous code thats not previously handled
//e.g : mongodb connection error
process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! Shutting down...");
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
