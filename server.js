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

// ⚡ FIX: Yahan mongoose.connect call karna zaroori tha
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/al_noor_academy"; 

mongoose
  .connect(MONGO_URI) // <-- Yeh miss tha aapke code mein
  .then(() => {
    console.log("✅ Connected to MongoDB");
    // Start server after DB connection (development mode)
    if (process.env.NODE_ENV !== "production") {
      const PORT = process.env.PORT || 5000;
      server.listen(PORT, () => { // <-- Removed "0.0.0.0" for simplicity
        console.log(`🚀 Server running on port ${PORT}`);
      });
    }
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    // Vercel environment mein crash hone se bachane ke liye handle kiya
    if (process.env.NODE_ENV !== "production") {
        process.exit(1);
    }
  });

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
    console.error("❌ Server Error Detail:", err); // Taake poora error object terminal me dikhe
    res
        .status(err.status || 500)
        .json({ msg: err.message || "Internal Server Error" });
});

module.exports = server; // Required for Vercel Serverless Functions