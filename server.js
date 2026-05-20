const express = require("express");
const mongoose = require("mongoose");
const morgan = require("morgan");
const cors = require("cors");

// Routes
const cartRoutes = require("./routes/cartRoute");
const userRoutes = require("./routes/userRoutes");
const orderRoutes = require("./routes/ordersRoute");
const authenticationRoute = require("./routes/authenticationRoute");
const brandRoutes = require("./routes/brandRoute");
const categoryRoutes = require("./routes/categoryRoute");
const productRoutes = require("./routes/productRoute");
const registerRoutes = require("./routes/register");

// Create express app
const server = express();

// ✅ MongoDB Connection (Updated to use your Environment Variables)
mongoose
    .connect(process.env.MONGO_URI || "mongodb+srv://muzamiliqbal0393_db_user:Muzamil2233@cluster0.zerb0gq.mongodb.net/?appName=Cluster0", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("✅ Connected to Muzamil's MongoDB");
        const PORT = process.env.PORT || 8080;
        server.listen(PORT, "0.0.0.0", () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("❌ MongoDB connection error:", error);
    });

// ✅ Corrected CORS Configuration (Allows Al-Noor Academy Frontend)
server.use(
    cors({
        origin: "*", // Yeh har origin ko allow karega taake connection ka error na aaye
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

// ✅ Routes
server.use(registerRoutes);
server.use(authenticationRoute);
server.use(productRoutes);
server.use(brandRoutes);
server.use(userRoutes);
server.use(categoryRoutes);
server.use(orderRoutes);
server.use(cartRoutes);

// ✅ Root Route
server.get("/", (req, res) => {
    res.send("✅ API is running successfully!");
});

// ❌ 404 Not Found
server.use((req, res) => {
    res.status(404).json({ msg: "❌ Not Found" });
});

// ❌ Global Error Handler
server.use((err, req, res, next) => {
    console.error("❌ Server Error:", err.message);
    res
        .status(err.status || 500)
        .json({ msg: err.message || "Internal Server Error" });
});