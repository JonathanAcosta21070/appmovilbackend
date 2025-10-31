const express = require("express");
const router = express.Router();

// Importar modelos
const { Cultivo, SensorData, Usuario, Recomendacion } = require("../models");

// 🚀 MIDDLEWARE DE AUTENTICACIÓN CORREGIDO - VERSIÓN COMPLETA
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    
    console.log('🔐 [AUTH] Verificando token:', {
      token: token ? `${token.substring(0, 10)}...` : 'empty',
      path: req.path,
      method: req.method
    });
    
    if (!token) {
      return res.status(401).json({ error: "Token de autorización requerido" });
    }
    
    // 🔥 CORRECCIÓN PRINCIPAL: Verificar si es un ObjectId válido
    const isValidObjectId = token.match(/^[0-9a-fA-F]{24}$/);
    
    if (!isValidObjectId) {
      console.log('⚠️ [AUTH] Token no es ObjectId válido, verificando rutas públicas...');
      
      // Lista de rutas que pueden funcionar sin ObjectId válido
      const publicStatsRoutes = [
        '/scientist/stats/simple',
        '/scientist/stats/farmers/ranking', 
        '/scientist/stats/biofertilizers',
        '/scientist/stats/complete'
      ];
      
      // Permitir acceso a rutas de estadísticas públicas
      if (publicStatsRoutes.some(route => req.path.includes(route))) {
        console.log('✅ [AUTH] Permitiendo acceso a ruta pública de estadísticas');
        req.userId = 'system-stats';
        return next();
      }
      
      console.log('❌ [AUTH] Token inválido para ruta protegida:', req.path);
      return res.status(401).json({ 
        error: "Token de autenticación inválido",
        details: "Se requiere un ID de usuario válido"
      });
    }
    
    // Buscar usuario solo si el token es un ObjectId válido
    const usuario = await Usuario.findById(token);
    if (!usuario) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }
    
    // Verificar rol de científico
    if (usuario.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado - Se requiere rol de científico" });
    }
    
    req.userId = token;
    req.user = usuario;
    
    console.log('✅ [AUTH] Usuario autenticado:', usuario.name, `(${usuario.role})`);
    next();
    
  } catch (error) {
    console.error("❌ [AUTH] Error en autenticación:", error);
    
    // Para errores de cast (ObjectId inválido), dar mensaje más específico
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(401).json({ 
        error: "Formato de ID inválido",
        details: "El ID de usuario debe ser un ObjectId de MongoDB válido"
      });
    }
    
    res.status(500).json({ error: "Error interno del servidor en autenticación" });
  }
};

// 🔥 RUTAS PRINCIPALES - CON ORDEN CORREGIDO

// 1. OBTENER TODOS LOS AGRICULTORES
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

// 2. OBTENER DETALLES DE UN AGRICULTOR ESPECÍFICO
router.get("/farmers/:farmerId", authenticateToken, async (req, res) => {
  try {
    const { farmerId } = req.params;
    const userId = req.userId;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const farmer = await Usuario.findById(farmerId)
      .select('name email cultivo ubicacion createdAt fechaRegistro');

    if (!farmer) {
      return res.status(404).json({ error: "Agricultor no encontrado" });
    }

    console.log(`✅ Detalles del agricultor obtenidos: ${farmer.name}`);
    res.json(farmer);
    
  } catch (error) {
    console.error("❌ Error obteniendo detalles del agricultor:", error);
    res.status(500).json({ error: "Error al obtener detalles del agricultor" });
  }
});

// 3. OBTENER DATOS RECIENTES DE SENSORES
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

// 🔥 CORRECCIÓN CRÍTICA: RUTAS DE ESTADÍSTICAS EN ORDEN CORRECTO

// 4. OBTENER RANKING DE AGRICULTORES - ESPECÍFICA PRIMERO
router.get("/stats/farmers/ranking", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    console.log('🔍 Buscando ranking de agricultores...');

    // Obtener todos los agricultores con conteo de proyectos (cultivos)
    const farmersRanking = await Cultivo.aggregate([
      {
        $group: {
          _id: "$userId",
          totalProyectos: { $sum: 1 },
          cultivosUnicos: { $addToSet: "$crop" }
        }
      },
      {
        $lookup: {
          from: "usuarios",
          localField: "_id",
          foreignField: "_id",
          as: "farmerInfo"
        }
      },
      {
        $unwind: "$farmerInfo"
      },
      {
        $project: {
          nombre: "$farmerInfo.name",
          email: "$farmerInfo.email",
          ubicacion: "$farmerInfo.ubicacion",
          totalProyectos: 1,
          cultivosUnicos: { $size: "$cultivosUnicos" }
        }
      },
      {
        $sort: { totalProyectos: -1 }
      },
      {
        $limit: 10 // Limitar a top 10
      }
    ]);

    console.log(`🏆 Ranking de agricultores generado: ${farmersRanking.length} agricultores`);
    res.json(farmersRanking);
    
  } catch (error) {
    console.error("❌ Error generando ranking de agricultores:", error);
    res.status(500).json({ 
      error: "Error al generar ranking",
      details: error.message 
    });
  }
});

// 5. OBTENER ESTADÍSTICAS DE BIOFERTILIZANTES - ESPECÍFICA PRIMERO
router.get("/stats/biofertilizers", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    console.log('🔍 Buscando estadísticas de biofertilizantes...');

    // Obtener estadísticas de biofertilizantes
    const biofertilizerStats = await Cultivo.aggregate([
      {
        $match: {
          bioFertilizer: { $exists: true, $ne: "" }
        }
      },
      {
        $group: {
          _id: "$bioFertilizer",
          totalProyectos: { $sum: 1 },
          agricultoresUnicos: { $addToSet: "$userId" }
        }
      },
      {
        $project: {
          biofertilizante: "$_id",
          totalProyectos: 1,
          totalAgricultores: { $size: "$agricultoresUnicos" },
          _id: 0
        }
      },
      {
        $sort: { totalProyectos: -1 }
      }
    ]);

    console.log(`🧪 Estadísticas de biofertilizantes: ${biofertilizerStats.length} tipos`);
    res.json(biofertilizerStats);
    
  } catch (error) {
    console.error("❌ Error obteniendo estadísticas de biofertilizantes:", error);
    res.status(500).json({ 
      error: "Error al obtener estadísticas",
      details: error.message 
    });
  }
});

// 6. OBTENER ESTADÍSTICAS SIMPLIFICADAS - ✅ ESPECÍFICA PRIMERO (ANTES DE /stats)
router.get("/stats/simple", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    console.log('📊 Generando estadísticas simples...');

    // Obtener estadísticas básicas sin agregaciones complejas
    const totalAgricultores = await Usuario.countDocuments({ role: 'farmer' });
    const totalCultivos = await Cultivo.countDocuments();
    
    // Obtener biofertilizantes únicos
    const biofertilizantes = await Cultivo.distinct("bioFertilizer", { 
      bioFertilizer: { $exists: true, $ne: "" } 
    });

    // Obtener agricultores con conteo simple
    const agricultoresConProyectos = await Cultivo.aggregate([
      {
        $group: {
          _id: "$userId",
          totalProyectos: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "usuarios",
          localField: "_id",
          foreignField: "_id",
          as: "farmerInfo"
        }
      },
      {
        $unwind: "$farmerInfo"
      },
      {
        $project: {
          nombre: "$farmerInfo.name",
          totalProyectos: 1
        }
      },
      {
        $sort: { totalProyectos: -1 }
      },
      {
        $limit: 5
      }
    ]);

    // Obtener los conteos de proyectos para cada biofertilizante
    const biofertilizantesConProyectos = await Promise.all(
      biofertilizantes.map(async (bf) => {
        const totalProyectos = await Cultivo.countDocuments({ bioFertilizer: bf });
        return {
          biofertilizante: bf,
          totalProyectos
        };
      })
    );

    const stats = {
      rankingAgricultores: agricultoresConProyectos,
      biofertilizantes: biofertilizantesConProyectos,
      general: {
        totalAgricultores,
        totalProyectos: totalCultivos,
        totalBiofertilizantes: biofertilizantes.length
      },
      fechaGeneracion: new Date()
    };

    console.log('✅ Estadísticas simples generadas exitosamente');
    res.json(stats);
    
  } catch (error) {
    console.error("❌ Error generando estadísticas simples:", error);
    res.status(500).json({ 
      error: "Error al generar estadísticas",
      details: error.message 
    });
  }
});

// 7. OBTENER ESTADÍSTICAS GENERALES - ✅ DESPUÉS DE LAS ESPECÍFICAS
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

// 8. OBTENER ESTADÍSTICAS DE UN AGRICULTOR ESPECÍFICO - ✅ ÚLTIMA (RUTA DINÁMICA)
router.get("/stats/:farmerId", authenticateToken, async (req, res) => {
  try {
    const { farmerId } = req.params;
    const userId = req.userId;

    console.log('🔍 [STATS] Obteniendo estadísticas para agricultor:', {
      farmerId,
      userId: userId.substring(0, 10) + '...'
    });

    // 🔥 CORRECCIÓN: Validar que farmerId sea un ObjectId válido
    if (!farmerId.match(/^[0-9a-fA-F]{24}$/)) {
      console.log('❌ [STATS] farmerId no es válido:', farmerId);
      return res.status(400).json({ 
        error: "ID de agricultor inválido",
        details: "El ID debe ser un ObjectId de MongoDB válido"
      });
    }

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    // Obtener datos del agricultor
    const farmer = await Usuario.findById(farmerId);
    if (!farmer) {
      return res.status(404).json({ error: "Agricultor no encontrado" });
    }

    // Obtener cultivos del agricultor
    const crops = await Cultivo.find({ userId: farmerId });
    
    // Obtener datos de sensores recientes
    const recentSensorData = await SensorData.find({ userId: farmerId })
      .sort({ date: -1 })
      .limit(100);

    // Calcular estadísticas
    const stats = {
      farmer: {
        name: farmer.name,
        location: farmer.ubicacion,
        mainCrop: farmer.cultivo
      },
      crops: {
        total: crops.length,
        active: crops.filter(c => c.status === 'activo').length,
        harvested: crops.filter(c => c.status === 'cosechado').length
      },
      sensorData: {
        total: recentSensorData.length,
        avgMoisture: recentSensorData.length > 0 
          ? Math.round(recentSensorData.reduce((sum, data) => sum + (data.moisture || 0), 0) / recentSensorData.length * 10) / 10 
          : 0,
        avgTemperature: recentSensorData.length > 0 
          ? Math.round(recentSensorData.reduce((sum, data) => sum + (data.temperature || 0), 0) / recentSensorData.length * 10) / 10 
          : 0,
        needsWater: recentSensorData.filter(data => data.moisture < 30).length
      },
      lastUpdated: new Date()
    };

    console.log(`📊 Estadísticas obtenidas para agricultor: ${farmer.name}`);
    res.json(stats);
    
  } catch (error) {
    console.error("❌ Error obteniendo estadísticas del agricultor:", error);
    
    // Manejar específicamente el error de Cast
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({ 
        error: "ID de agricultor inválido",
        details: "El formato del ID no es correcto"
      });
    }
    
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// 9. OBTENER CULTIVOS DE UN AGRICULTOR
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

// 10. OBTENER DATOS DE SENSOR DE UN AGRICULTOR
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

// 11. OBTENER DETALLES DE UN CULTIVO ESPECÍFICO
router.get("/crops/:cropId", authenticateToken, async (req, res) => {
  try {
    const { cropId } = req.params;
    const userId = req.userId;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const crop = await Cultivo.findById(cropId)
      .populate('userId', 'name email ubicacion');

    if (!crop) {
      return res.status(404).json({ error: "Cultivo no encontrado" });
    }

    console.log(`✅ Detalles del cultivo obtenidos: ${crop.crop}`);
    res.json(crop);
    
  } catch (error) {
    console.error("❌ Error obteniendo detalles del cultivo:", error);
    res.status(500).json({ error: "Error al obtener detalles del cultivo" });
  }
});

// 12. ENVIAR RECOMENDACIÓN
router.post("/recommendations", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { farmerId, cropId, recommendation, priority, scientistId, scientistName } = req.body;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado - Solo científicos" });
    }

    // Validar campos requeridos
    if (!farmerId || !recommendation) {
      return res.status(400).json({ error: "FarmerId y recommendation son requeridos" });
    }

    // Verificar que el agricultor existe
    const farmer = await Usuario.findById(farmerId);
    if (!farmer) {
      return res.status(404).json({ error: "Agricultor no encontrado" });
    }

    // Verificar que el cultivo existe si se proporciona cropId
    if (cropId) {
      const crop = await Cultivo.findById(cropId);
      if (!crop) {
        return res.status(404).json({ error: "Cultivo no encontrado" });
      }
    }

    // Crear la recomendación
    const newRecommendation = new Recomendacion({
      farmerId,
      cropId: cropId || null,
      recommendation,
      priority: priority || 'medium',
      scientistId: scientistId || userId,
      scientistName: scientistName || scientist.name,
      status: 'pending',
      createdAt: new Date()
    });

    await newRecommendation.save();

    console.log(`💡 Recomendación enviada a agricultor: ${farmer.name}`);
    
    res.status(201).json({
      success: true,
      message: "Recomendación enviada exitosamente",
      recommendation: newRecommendation
    });
    
  } catch (error) {
    console.error("❌ Error enviando recomendación:", error);
    res.status(500).json({ error: "Error al enviar recomendación" });
  }
});

// 13. OBTENER RECOMENDACIONES ANTERIORES
router.get("/recommendations/:farmerId", authenticateToken, async (req, res) => {
  try {
    const { farmerId } = req.params;
    const userId = req.userId;

    // Verificar que el usuario sea científico
    const scientist = await Usuario.findById(userId);
    if (!scientist || scientist.role !== 'scientist') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const recommendations = await Recomendacion.find({ farmerId })
      .sort({ createdAt: -1 })
      .limit(20);

    console.log(`📋 Recomendaciones anteriores obtenidas: ${recommendations.length}`);
    res.json(recommendations);
    
  } catch (error) {
    console.error("❌ Error obteniendo recomendaciones:", error);
    res.status(500).json({ error: "Error al obtener recomendaciones" });
  }
});

// 14. DEBUG ENDPOINT PARA CULTIVOS
router.get("/debug/crop/:cropId", authenticateToken, async (req, res) => {
  try {
    const { cropId } = req.params;
    const userId = req.userId;

    const crop = await Cultivo.findById(cropId)
      .populate('userId', 'name email ubicacion');

    if (!crop) {
      return res.status(404).json({ error: "Cultivo no encontrado" });
    }

    const debugData = {
      summary: {
        id: crop._id,
        crop: crop.crop,
        location: crop.location,
        farmer: crop.userId?.name || 'No disponible',
        historyCount: crop.history?.length || 0,
        hasObservations: !!crop.observations,
        hasRecommendations: !!crop.recommendations,
        hasHumidity: !!crop.humidity,
        hasSeed: !!crop.seed,
        hasBioFertilizer: !!crop.bioFertilizer,
        status: crop.status,
        synced: crop.synced
      },
      rawData: crop
    };

    console.log(`🐛 Debug data para cultivo: ${crop.crop}`);
    res.json(debugData);
    
  } catch (error) {
    console.error("❌ Error en debug endpoint:", error);
    res.status(500).json({ error: "Error en debug" });
  }
});

module.exports = router;