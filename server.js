const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");
require("dotenv").config(); // Essential for Vercel to load env variables

// Correct Academy Routes
const authRoutes = require("./routes/auth");
const teacherRoutes = require("./routes/teacher");
const studentRoutes = require("./routes/student");
const parentRoutes = require("./routes/parent");
const classesRoutes = require("./routes/classes");
const adminRoutes = require("./routes/admin");
const attendanceRoutes = require("./routes/attendance");
const homeworkRoutes = require("./routes/homework");
const messagesRoutes = require("./routes/messages");
const paymentsRoutes = require("./routes/payments");
const notificationsRoutes = require("./routes/notifications");

// Create express app
const server = express();

// ✅ MongoDB Connection Settings
mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/al_noor_academy"; 

// ⚡ FIX: Database Connection Cache (Serverless ke liye zaroori hai)
let isConnected = false;

async function connectDB() {
  if (isConnected) {
    return;
  }

  // Agar pehle se connecting state (2) mein ho toh wait karein
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }

  try {
    console.log("🔄 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGO_URI);
    isConnected = true;
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    throw err;
  }
}

// ⚡ FIX MIDDLEWARE: Har incoming request par check karein ke DB connected hai ya nahi
server.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({ msg: "Database connection failed", error: error.message });
  }
});

// Start server ONLY for Local Development mode
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Local Server running on port ${PORT}`);
  });
}

// ✅ CORS Configuration
server.use(
    cors({
        origin: "*", 
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

// ✅ Static file serving (uploads)
server.use("/uploads", cors(), express.static("uploads"));

// ✅ Middleware
server.use(morgan("dev"));
server.use(express.json());

// ✅ API Routes (Online Academy)
server.use("/api/auth", authRoutes);
server.use("/api/teacher", teacherRoutes);
server.use("/api/student", studentRoutes);
server.use("/api/parent", parentRoutes);
server.use("/api/classes", classesRoutes);
server.use("/api/admin", adminRoutes);
server.use("/api/attendance", attendanceRoutes);
server.use("/api/homework", homeworkRoutes);
server.use("/api/messages", messagesRoutes);
server.use("/api/payments", paymentsRoutes);
server.use("/api/notifications", notificationsRoutes);

// ✅ Root Route
server.get("/", (req, res) => {
    res.send("✅ Al-Noor Quran Academy API is running successfully!");
});

// ❌ 404 Not Found
server.use((req, res) => {
    res.status(404).json({ msg: "❌ Not Found" });
});

// ❌ Global Error Handler
server.use((err, req, res, next) => {
    console.error("❌ Server Error Detail:", err); 
    res
        .status(err.status || 500)
        .json({ msg: err.message || "Internal Server Error" });
});

module.exports = server; // Required for Vercel Serverless Functions