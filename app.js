const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

const app = express();

/* ================= MONGODB ================= */
mongoose.connect(process.env.URL)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error(err));

let gridfsBucket;
mongoose.connection.once("open", () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(
    mongoose.connection.db,
    { bucketName: "uploads" }
  );
});

/* ================= MODELS ================= */

// CONTACT / WORK ORDERS
const UploadSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  service: String,
  message: String,
  fileName: String,   // original filename
  filePath: String,   // GridFS file ID
  uploadedAt: { type: Date, default: Date.now },
  accepted: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
  paymentDone: { type: Boolean, default: false }
});
const Upload = mongoose.model("Upload", UploadSchema);

// TESTIMONIALS
const TestimonialSchema = new mongoose.Schema({
  author: String,
  rating: Number,
  review: String,
  createdAt: { type: Date, default: Date.now }
});
const Testimonial = mongoose.model("Testimonial", TestimonialSchema);

// PROJECTS
const ProjectSchema = new mongoose.Schema({
  title: String,
  description: String,
  category: {
    type: String,
    default: "living-room"
  },
  imageUrl: String,   // ✅ IMPORTANT
  order: Number,
  createdAt: { type: Date, default: Date.now }
});

const Project = mongoose.model("Project", ProjectSchema);


/* ================= VIEW ENGINE ================= */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* ================= MIDDLEWARE ================= */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* ================= MULTER (1MB LIMIT) ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }
});

/* ================= GRIDFS HELPER ================= */
function uploadToGridFS(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.mimetype.startsWith("image/")) {
      return reject("Only image files allowed");
    }

    const uploadStream = gridfsBucket.openUploadStream(
      Date.now() + "-" + file.originalname,
      { contentType: file.mimetype }
    );

    uploadStream.end(file.buffer);

    uploadStream.on("finish", () => resolve(uploadStream.id));
    uploadStream.on("error", reject);
  });
}

/* ================= ROUTES ================= */

// HOME
// Home page
app.get("/", async (req, res) => {
  const testimonials = await Testimonial.find().sort({ createdAt: -1 });

  const totalTestimonials = testimonials.length;

  const avgRating =
    totalTestimonials === 0
      ? 0
      : (
          testimonials.reduce((sum, t) => sum + t.rating, 0) /
          totalTestimonials
        ).toFixed(1);

  res.render("home", {
    testimonials,
    totalTestimonials,
    avgRating
  });
});


// CONTACT FORM
app.post("/contact", upload.single("designFile"), async (req, res) => {
  let fileId = null;
  if (req.file) fileId = await uploadToGridFS(req.file);

  await Upload.create({
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone,
    service: req.body.service,
    message: req.body.message,
    fileName: req.file ? req.file.originalname : null,
    filePath: fileId ? fileId.toString() : null
  });

  res.redirect("/");
});

// ADMIN PANEL
app.get("/admin", async (req, res) => {
  const messages = await Upload.find().sort({ uploadedAt: -1 });
  const testimonials = await Testimonial.find().sort({ createdAt: -1 });
  const projects = await Project.find().sort({ createdAt: -1 });
  res.render("admin_panelv2", { messages, testimonials, projects });
});

/* ================= WORK ORDERS ================= */
app.post("/accept/:id", async (req, res) => {
  await Upload.findByIdAndUpdate(req.params.id, { accepted: true });
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
  const msg = await Upload.findById(req.params.id);
  if (msg?.filePath) {
    await gridfsBucket.delete(new mongoose.Types.ObjectId(msg.filePath));
  }
  await Upload.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ================= TESTIMONIALS ================= */
app.post("/testimonial/create", async (req, res) => {
  await Testimonial.create(req.body);
  res.json({ success: true });
});

app.post("/testimonial/update/:id", async (req, res) => {
  await Testimonial.findByIdAndUpdate(req.params.id, req.body);
  res.json({ success: true });
});

app.post("/testimonial/delete/:id", async (req, res) => {
  await Testimonial.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ================= PROJECTS ================= */
app.post("/project/create", async (req, res) => {
  await Project.create({
    title: req.body.title,
    description: req.body.description,
    category: req.body.category || "living-room",
    imageUrl: req.body.image,   // 👈 admin sends "image"
    order: req.body.order
  });

  res.json({ success: true });
});


app.post("/project/update/:id", async (req, res) => {
  await Project.findByIdAndUpdate(req.params.id, {
    title: req.body.title,
    description: req.body.description,
    category: req.body.category || "living-room",
    imageUrl: req.body.image,
    order: req.body.order
  });

  res.json({ success: true });
});



// DELETE PROJECT
app.post("/project/delete/:id", async (req, res) => {
  await Project.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// PROJECTS PAGE
app.get("/projects", async (req, res) => {
  const projects = await Project.find().sort({ order: 1 });
  res.render("projects", { projects });
});

/* ================= FILE VIEW ================= */
app.get("/uploads/:id", async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const files = await gridfsBucket.find({ _id: fileId }).toArray();
    if (!files.length) return res.status(404).send("File not found");

    const file = files[0];
    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="${file.filename}"`
    });

    gridfsBucket.openDownloadStream(fileId).pipe(res);
  } catch {
    res.status(400).send("Invalid file ID");
  }
});

/* ================= FILE DOWNLOAD ================= */
app.get("/uploads/download/:id", async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const files = await gridfsBucket.find({ _id: fileId }).toArray();
    if (!files.length) return res.status(404).send("File not found");

    const file = files[0];
    res.set({
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`
    });

    gridfsBucket.openDownloadStream(fileId).pipe(res);
  } catch {
    res.status(400).send("Invalid file ID");
  }
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
