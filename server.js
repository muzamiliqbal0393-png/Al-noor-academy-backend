const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");
require("dotenv").config();

// Routes
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
const analyticsRoutes = require("./routes/analytics");

// Create express app
const server = express();

// ==========================================
//  1. MANUAL CORS HEADERS — MUST BE FIRST
//  This guarantees CORS headers on ALL responses,
//  including 500 errors where cors() might not run.
// ==========================================
server.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  // Handle preflight requests immediately
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// ==========================================
//  2. OTHER MIDDLEWARES
// ==========================================
// NOTE: credentials:false because origin:"*" + credentials:true is forbidden by browsers
server.use(cors({
  origin: "*",
  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

server.use(morgan("dev"));
server.use(express.json({ limit: "10mb" }));
server.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static file serving
server.use("/uploads", express.static("uploads"));

// ==========================================
//  3. DATABASE & ENV FALLBACKS
// ==========================================
mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);

const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://muzamiliqbal0393_db_user:Muzamil2233@cluster0.zerb0gq.mongodb.net/al_noor_academy?retryWrites=true&w=majority";

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "alnoor_super_secret_jwt_key_2025";
if (!process.env.JWT_EXPIRE)  process.env.JWT_EXPIRE  = "30d";

let isConnected = false;

async function connectDB() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  try {
    console.log("🔄 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    isConnected = false;
    console.error("❌ MongoDB connection error:", err.message);
    throw err;
  }
}

// DB connection middleware — runs before every route
server.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    // CORS headers already set above, so this response will be readable by browser
    return res.status(500).json({
      success: false,
      msg: "Database connection failed. Please try again.",
      error: error.message,
    });
  }
});

// ==========================================
//  4. API ROUTES
// ==========================================
server.use("/api/auth",          authRoutes);
server.use("/api/teacher",       teacherRoutes);
server.use("/api/student",       studentRoutes);
server.use("/api/parent",        parentRoutes);
server.use("/api/classes",       classesRoutes);
server.use("/api/admin",         adminRoutes);
server.use("/api/teacher-apply", teacherApplyRoutes);
server.use("/api/attendance",    attendanceRoutes);
server.use("/api/homework",      homeworkRoutes);
server.use("/api/messages",      messagesRoutes);
server.use("/api/payments",      paymentsRoutes);
server.use("/api/notifications", notificationsRoutes);
server.use("/api/wallet",        walletRoutes);
server.use("/api/public",        publicRoutes);
server.use("/api/analytics",     analyticsRoutes);

// Root health check
server.get("/", (req, res) => {
  res.json({ success: true, message: "✅ Al-Noor Quran Academy API is running!" });
});

// Local dev mode
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5001;
  server.listen(PORT, () => {
    console.log(`🚀 Local Server running on http://localhost:${PORT}`);
  });
}

// 404 Handler
server.use((req, res) => {
  res.status(404).json({ success: false, msg: "❌ Route not found" });
});

// Global Error Handler — CORS headers already set above
server.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    msg: err.message || "Internal Server Error",
  });
});

module.exports = server;