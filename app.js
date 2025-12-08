const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

// -------------------- MongoDB Connection --------------------
mongoose.connect("mongodb://127.0.0.1:27017/WowModularDB")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// -------------------- Mongoose Schema --------------------
const UploadSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  service: String,
  message: String,

  fileName: String,
  filePath: String,

  accepted: { type: Boolean, default: false },

  uploadedAt: { type: Date, default: Date.now }
});

const Upload = mongoose.model("Upload", UploadSchema);

// -------------------- View Engine --------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// -------------------- Middleware --------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); 
// FIXED: Correct path for loading files in admin panel

// -------------------- Multer Storage Setup --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

// -------------------- Routes --------------------

// Home Page
app.get("/", (req, res) => {
  res.render("home");
});

// Contact Form Submit
app.post("/contact", upload.single("designFile"), async (req, res) => {
  let savedData = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    service: req.body.service,
    message: req.body.message,

    fileName: req.file ? req.file.filename : null,
    filePath: req.file ? "/uploads/" + req.file.filename : null
  };

  await Upload.create(savedData);

  res.redirect("/");
});


// Admin Panel (Display All Messages)
app.get("/admin", async (req, res) => {
  try {
    const messages = await Upload.find().sort({ uploadedAt: -1 });
    res.render("admin_panelv2", { messages });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.post("/accept/:id", async (req, res) => {
  try {
    await Upload.findByIdAndUpdate(req.params.id, { accepted: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false });
  }
});

app.post("/delete/:id", async (req, res) => {
  try {
    await Upload.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.json({ success: false });
  }
});



// -------------------- Start Server --------------------
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
