// routes/sensorRoutes.js
const express = require("express");
const router = express.Router();

// ✅ SOLO IMPORTAR modelos - NO crear esquemas aquí
const { SensorData, Usuario } = require("../models");

// 🔐 Configuración
const API_KEY_ESP32 = "3412";

// 🛡️ Middleware de autenticación para ESP32
const authenticateESP32 = (req, res, next) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  
  if (!apiKey) {
    return res.status(401).json({ error: "API Key requerida" });
  }
  
  if (apiKey !== API_KEY_ESP32) {
    console.log("❌ API Key inválida del ESP32:", apiKey);
    return res.status(401).json({ error: "No autorizado" });
  }
  
  console.log("✅ Autenticación ESP32 exitosa");
  next();
};

// 📊 ENDPOINT PARA RECIBIR DATOS DEL ESP32
router.post("/sensor-data", authenticateESP32, async (req, res) => {
  try {
    const { userId, moisture, temperature, humidity, ph, location, crop } = req.body;
    
    console.log(`📊 Datos recibidos del ESP32:`, {
      userId,
      moisture,
      temperature,
      humidity,
      ph,
      location,
      crop
    });

    // Validaciones básicas
    if (!userId) {
      return res.status(400).json({ error: "userId es requerido" });
    }

    if (moisture === undefined || temperature === undefined) {
      return res.status(400).json({ error: "Datos del sensor incompletos" });
    }

    // 🗄️ Guardar en MongoDB
    const nuevoDato = new SensorData({
      userId,
      moisture,
      temperature,
      humidity: humidity || 45.0,
      ph: ph || 6.5,
      location: location || "Campo Principal",
      crop: crop || "Maíz",
      date: new Date()
    });

    await nuevoDato.save();

    console.log(`✅ Datos guardados para usuario: ${userId}`);

    res.status(201).json({
      success: true,
      message: "Datos del sensor guardados correctamente",
      data: {
        id: nuevoDato._id,
        moisture,
        temperature,
        timestamp: nuevoDato.date
      }
    });

  } catch (error) {
    console.error("❌ Error procesando datos del sensor:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: "Datos inválidos" });
    }
    
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = router;