const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");
require("dotenv").config();

// Correct Academy Routes
const authRoutes = require("./routes/auth");
const teacherRoutes = require("./routes/teacher");
const studentRoutes = require("./routes/student");
const parentRoutes = require("./routes/parent");
const classesRoutes = require("./routes/classes");
const adminRoutes = require("./routes/admin");
const teacherApplyRoutes = require("./routes/teacherApply");

const attendanceRoutes = require("./routes/attendance");
const homeworkRoutes = require("./routes/homework");
const messagesRoutes = require("./routes/messages");
const paymentsRoutes = require("./routes/payments");
const notificationsRoutes = require("./routes/notifications");
const walletRoutes = require("./routes/wallet");
const publicRoutes = require("./routes/public");

// Create express app
const server = express();

// ==========================================
//  1. GLOBAL CORE MIDDLEWARES (MUST BE FIRST)
// ==========================================
server.use(
  cors({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
server.use(morgan("dev"));
server.use(express.json()); // ⚡ FIX: Ab routes se pehle body parse hogi
server.use(express.urlencoded({ extended: true }));

// Static file serving
server.use("/uploads", cors(), express.static("uploads"));

// ==========================================
//  2. DATABASE CONNECTION MANAGEMENT
// ==========================================
mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/al_noor_academy";

let isConnected = false;

async function connectDB() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  try {
    console.log("🔄 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    isConnected = true;
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    throw err;
  }
}

// DB connection check middleware
server.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({ msg: "Database connection failed", error: error.message });
  }
});

// ==========================================
//  3. API ROUTES (NOW DATA WILL BE PARSED)
// ==========================================
server.use("/api/auth", authRoutes);
server.use("/api/teacher", teacherRoutes);
server.use("/api/student", studentRoutes);
server.use("/api/parent", parentRoutes);
server.use("/api/classes", classesRoutes);
server.use("/api/admin", adminRoutes);
server.use("/api/admin", teacherApplyRoutes);

server.use("/api/attendance", attendanceRoutes);
server.use("/api/homework", homeworkRoutes);
server.use("/api/messages", messagesRoutes);
server.use("/api/payments", paymentsRoutes);
server.use("/api/notifications", notificationsRoutes);
server.use("/api/wallet", walletRoutes);
server.use("/api/public", publicRoutes);

// Root Route
server.get("/", (req, res) => {
  res.send("✅ Al-Noor Quran Academy API is running successfully!");
});

// Local Development Server Mode
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5001; // Port 5001 as per your env
  server.listen(PORT, () => {
    console.log(`🚀 Local Server running on port ${PORT}`);
  });
}

// 404 Not Found
server.use((req, res) => {
  res.status(404).json({ msg: "❌ Not Found" });
});

// Global Error Handler
server.use((err, req, res, next) => {
  console.error("❌ Server Error Detail:", err);
  res
    .status(err.status || 500)
    .json({ msg: err.message || "Internal Server Error" });
});

module.exports = server;