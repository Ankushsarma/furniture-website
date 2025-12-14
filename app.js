const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

/* ===================== MONGODB CONNECTION ===================== */
mongoose.connect("mongodb://127.0.0.1:27017/WowModularDB")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

/* ===================== MODELS ===================== */

// Contact / Work Orders Model
const UploadSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  service: String,
  message: String,
  fileName: String,
  filePath: String,
  uploadedAt: { type: Date, default: Date.now },
  accepted: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  paymentDone: { type: Boolean, default: false }
});

const Upload = mongoose.model("Upload", UploadSchema);

// Testimonials Model
const TestimonialSchema = new mongoose.Schema({
  author: String,
  rating: Number,
  review: String,
  createdAt: { type: Date, default: Date.now }
});

const Testimonial = mongoose.model("Testimonial", TestimonialSchema);

/* ===================== VIEW ENGINE ===================== */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* ===================== MIDDLEWARE ===================== */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ===================== MULTER ===================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

/* ===================== ROUTES ===================== */

// Home
app.get("/", (req, res) => {
  res.render("home");
});

// Contact Form
app.post("/contact", upload.single("designFile"), async (req, res) => {
  await Upload.create({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    service: req.body.service,
    message: req.body.message,
    fileName: req.file ? req.file.filename : null,
    filePath: req.file ? "/uploads/" + req.file.filename : null
  });
  res.redirect("/");
});

// Admin Panel
app.get("/admin", async (req, res) => {
  const messages = await Upload.find().sort({ uploadedAt: -1 });
  const testimonials = await Testimonial.find().sort({ createdAt: -1 });

  res.render("admin_panelv2", {
    messages,
    testimonials
  });
});

/* ===================== MESSAGE ACTIONS ===================== */

app.post("/accept/:id", async (req, res) => {
  await Upload.findByIdAndUpdate(req.params.id, { accepted: true });
  res.json({ success: true });
});

app.post("/delete/:id", async (req, res) => {
  await Upload.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.post("/order/complete/:id", async (req, res) => {
  await Upload.findByIdAndUpdate(req.params.id, { completed: true });
  res.json({ success: true });
});

app.post("/order/payment/:id", async (req, res) => {
  await Upload.findByIdAndUpdate(req.params.id, { paymentDone: true });
  res.json({ success: true });
});

app.post("/order/delete/:id", async (req, res) => {
  await Upload.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ===================== TESTIMONIAL ROUTES ===================== */

// Add Testimonial
app.post("/testimonial/create", async (req, res) => {
  await Testimonial.create({
    author: req.body.author,
    rating: req.body.rating,
    review: req.body.review
  });
  res.json({ success: true });
});

// Update Testimonial
app.post("/testimonial/update/:id", async (req, res) => {
  await Testimonial.findByIdAndUpdate(req.params.id, {
    author: req.body.author,
    rating: req.body.rating,
    review: req.body.review
  });
  res.json({ success: true });
});

// Delete Testimonial
app.post("/testimonial/delete/:id", async (req, res) => {
  await Testimonial.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ===================== SERVER ===================== */
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
  console.log("http://localhost:3000/admin");
  
});
