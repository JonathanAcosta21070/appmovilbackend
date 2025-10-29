const express = require("express");
const router = express.Router();

// Importar modelos - SOLO UNA VEZ
const { Cultivo, SensorData, Usuario } = require("../models");

// 🚀 MIDDLEWARE DE AUTENTICACIÓN
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: "Token de autorización requerido" });
    }
    
    const usuario = await Usuario.findById(token);
    if (!usuario) {
      return res.status(401).json({ error: "Usuario no válido" });
    }
    
    req.userId = token;
    req.user = usuario;
    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido" });
  }
};

// 🔥 RUTAS PRINCIPALES QUE FALTAN - AGREGA ESTAS:

// OBTENER TODOS LOS AGRICULTORES
router.get("/farmers", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado - Solo científicos" });
    }

    const farmers = await Usuario.find({ role: 'farmer' })
      .select('name email cultivo ubicacion createdAt')
      .sort({ createdAt: -1 });

    console.log(`👨‍🌾 Agricultores encontrados: ${farmers.length}`);
    
    res.json(farmers);
    
  } catch (error) {
    console.error("❌ Error obteniendo agricultores:", error);
    res.status(500).json({ error: "Error al obtener agricultores" });
  }
});

// OBTENER DATOS RECIENTES DE SENSORES
router.get("/recent-sensor-data", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 50 } = req.query;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado - Solo científicos" });
    }

    const sensorData = await SensorData.find()
      .populate('userId', 'name email')
      .sort({ date: -1 })
      .limit(parseInt(limit));

    console.log(`📊 Datos recientes de sensores: ${sensorData.length}`);
    
    res.json(sensorData);
    
  } catch (error) {
    console.error("❌ Error obteniendo datos recientes:", error);
    res.status(500).json({ error: "Error al obtener datos recientes" });
  }
});

// OBTENER ESTADÍSTICAS GENERALES
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado - Solo científicos" });
    }

    const totalFarmers = await Usuario.countDocuments({ role: 'farmer' });
    const totalCrops = await Cultivo.countDocuments();
    const totalSensorData = await SensorData.countDocuments();
    
    // Últimos datos de sensores para estadísticas
    const recentData = await SensorData.find()
      .sort({ date: -1 })
      .limit(100);

    const avgMoisture = recentData.length > 0 
      ? recentData.reduce((sum, data) => sum + (data.moisture || 0), 0) / recentData.length 
      : 0;

    const avgTemperature = recentData.length > 0 
      ? recentData.reduce((sum, data) => sum + (data.temperature || 0), 0) / recentData.length 
      : 0;

    res.json({
      totalFarmers,
      totalCrops,
      totalSensorData,
      avgMoisture: Math.round(avgMoisture * 10) / 10,
      avgTemperature: Math.round(avgTemperature * 10) / 10,
      lastUpdated: new Date()
    });
    
  } catch (error) {
    console.error("❌ Error obteniendo estadísticas:", error);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// 🔽 RUTAS EXISTENTES (las que ya tenías):

// OBTENER CULTIVOS DE UN AGRICULTOR
router.get("/farmers/:farmerId/crops", authenticateToken, async (req, res) => {
  try {
    const { farmerId } = req.params;
    const userId = req.userId;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const crops = await Cultivo.find({ userId: farmerId })
      .sort({ createdAt: -1 });

    console.log(`🌱 Cultivos del agricultor ${farmerId}: ${crops.length}`);
    
    res.json(crops);
    
  } catch (error) {
    console.error("❌ Error obteniendo cultivos:", error);
    res.status(500).json({ error: "Error al obtener cultivos" });
  }
});

// OBTENER DATOS DE SENSOR DE UN AGRICULTOR
router.get("/farmers/:farmerId/sensor-data", authenticateToken, async (req, res) => {
  try {
    const { farmerId } = req.params;
    const { limit = 50 } = req.query;
    const userId = req.userId;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const sensorData = await SensorData.find({ userId: farmerId })
      .sort({ date: -1 })
      .limit(parseInt(limit));

    console.log(`📊 Datos de sensor del agricultor ${farmerId}: ${sensorData.length}`);
    
    res.json(sensorData);
    
  } catch (error) {
    console.error("❌ Error obteniendo datos de sensor:", error);
    res.status(500).json({ error: "Error al obtener datos de sensor" });
  }
});

module.exports = router;