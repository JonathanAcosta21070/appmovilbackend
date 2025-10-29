// server.js - SOLO esto
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Conexión a MongoDB
mongoose.connect("mongodb+srv://Jona:3412@cluster0.m5nt87h.mongodb.net/miAppAgricola?retryWrites=true&w=majority")
  .then(() => console.log("✅ Conectado a MongoDB"))
  .catch(err => console.log("❌ Error conectando a MongoDB:", err));

// 📦 IMPORTAR RUTAS
const scientistRoutes = require("./routes/scientistRoutes");
const sensorRoutes = require("./routes/sensorRoutes");
const farmerRoutes = require("./routes/farmerRoutes");
const authRoutes = require("./routes/authRoutes");

// 🔧 USAR RUTAS
app.use("/api/scientist", scientistRoutes);
app.use("/api/sensor", sensorRoutes);
app.use("/api/farmer", farmerRoutes);
app.use("/api/auth", authRoutes);

// 🛠️ HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Servidor funcionando correctamente",
    timestamp: new Date(),
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

// 🚀 INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌍 Servidor corriendo en puerto ${PORT}`);
});

// Manejo de errores
process.on('unhandledRejection', (err) => {
  console.error('❌ Error no manejado:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Excepción no capturada:', err);
  process.exit(1);
});