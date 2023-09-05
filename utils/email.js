const nodemailer = require("nodemailer");
const pug = require("pug");
const htmlToText = require("html-to-text");

// This is a better way of implementating it
// 1) Create class for Email
module.exports = class Email {
  constructor(user, url) {
    (this.to = user.email),
      (this.firstName = user.name.split(" ")[0]),
      (this.url = url);
    this.from = ` readOne OneCode <${process.env.EMAIL_FROM}>`;
  }
  // 2) Create the transport
  newTransport() {
    if (process.env.NODE_ENV === "production") {
      //we use a sendGrid app here
      return 1;
    }
    return nodemailer.createTransport({
      // service: "Gmail",
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        password: process.env.EMAIL_PASSWORD,
      },
    });
  }
  // send actual email
  async send(template, subject) {
    // 1) Render HTML based on a pug template
    const html = pug.renderFile(
      `${__dirname}/../views/emails/${template}.pug`,
      {
        firstname: this.firstName,
        url: this.url,
        subject,
      }
    );
    // 2) Define the email options
    const mailOptions = {
      from: this.from,
      to: this.email,
      subject,
      html,
      text: options.message,
    };
    // 3) Create a transport and send email

    await this.newTransport().sendMail(mailOptions);
  }
  async sendwelcome() {
    await this.send("Welcome", "Welcome to the E-Voting corridors");
  }
};

// All this here only works by using the "mailTrap".
// only meant for testing purposes "development mode".
// Its disadvantage is that, it cannot send multiple emails at go
// const sendEmail = async (options) => {
//   // 1) Create a transporter
//   const transporter = nodemailer.createTransport({
//     // service: "Gmail",
//     host: process.env.EMAIL_HOST,
//     port: process.env.EMAIL_PORT,
//     auth: {
//       user: process.env.EMAIL_USERNAME,
//       password: process.env.EMAIL_PASSWORD,
//     },
//     // if your using gmail,
//     // you have to activate in your gmail account "less secure app" option
//   });
//   // 2) Define the email options
//   const mailOptions = {
//     from: "readOne OneCode <readone@gmail.com>",
//     to: options.email,
//     subject: options.subject,
//     text: options.message,
//     // html: options.html
//   };

//   // 3) Actually send the email
//   await transporter.sendMail(mailOptions);
// };

// module.exports = sendEmail;
