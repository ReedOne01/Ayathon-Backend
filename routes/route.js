const {
  register,
  login,
  allUsers,
  oneUser,
  forgotPassword,
  resetPassword,
  updateUserData,
  deleteUser,
  // uploadUserPhoto,
} = require("../controller/user");
const { protect, restrictTo } = require("./../middlewares/authMiddleWare");

const router = require("express").Router();

router.post("/signup", register);
router.post("/login", login);
router.get("/allUsers", protect, allUsers);
router.get("/oneUser", oneUser);
router.post("/forgotPassword", forgotPassword);
router.patch("/resetPassword/:token", resetPassword);
router.patch("/updatePassword/", protect, resetPassword);
router.patch("/updateUser/", protect, updateUserData);
router.post("/delete", protect, restrictTo("admin"), deleteUser);

module.exports = router;
