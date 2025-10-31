// routes/farmerRoutes.js - VERSIÓN UNIFICADA
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// ✅ SOLO Cultivo - ELIMINADO Project
const { Cultivo, Accion, Alerta, SensorData, Usuario } = require("../models");

// 🚀 MIDDLEWARE DE AUTENTICACIÓN MEJORADO
const authenticateToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ error: "Token de autorización requerido" });
    }
    
    // ✅ ACEPTAR TANTO OBJECTID COMO STRING
    let usuario;
    
    // Verificar si es un ObjectId válido
    if (mongoose.Types.ObjectId.isValid(token)) {
      usuario = await Usuario.findById(token);
    } else {
      // Si no es ObjectId, buscar por otro campo (como email)
      usuario = await Usuario.findOne({ 
        $or: [
          { _id: token }, // Por si acaso
          { email: token }
        ]
      });
    }
    
    if (!usuario) {
      return res.status(401).json({ error: "Usuario no válido" });
    }
    
    req.userId = usuario._id; // ✅ Siempre usar el ObjectId real
    req.user = usuario;
    next();
  } catch (error) {
    console.error("❌ Error en autenticación:", error);
    res.status(401).json({ error: "Token inválido" });
  }
};

// 🗑️ ELIMINAR UNA ACCIÓN DEL HISTORIAL DE UN CULTIVO
router.delete('/crops/:cropId/history/:actionId', authenticateToken, async (req, res) => {
  try {
    const { cropId, actionId } = req.params;
    const userId = req.userId;

    console.log(`🗑️ Eliminando acción ${actionId} del cultivo ${cropId} del usuario ${userId}`);

    const result = await Cultivo.updateOne(
      { _id: cropId, userId },
      { $pull: { history: { _id: actionId } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: "Acción no encontrada o cultivo inexistente" });
    }

    console.log("✅ Acción eliminada correctamente en MongoDB");
    res.json({ mensaje: "Acción eliminada correctamente" });

  } catch (error) {
    console.error("❌ Error al eliminar acción:", error);
    res.status(500).json({ error: "Error al eliminar la acción" });
  }
});

// 📝 ENDPOINTS DE ACCIONES AGRÍCOLAS

// OBTENER ACCIONES DEL USUARIO ACTUAL
router.get("/actions", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit, type } = req.query;
    
    console.log(`📊 Obteniendo acciones para usuario: ${userId}`);
    
    let query = { userId };
    if (type && type !== 'all') {
      query.type = type;
    }

    let acciones = Accion.find(query).sort({ date: -1 });
    
    if (limit) {
      acciones = acciones.limit(parseInt(limit));
    }

    const resultado = await acciones;
    console.log(`✅ Encontradas ${resultado.length} acciones para usuario ${userId}`);
    res.json(resultado);
  } catch (error) {
    console.error("❌ Error obteniendo acciones:", error);
    res.status(500).json({ error: "Error al obtener acciones" });
  }
});

// CREAR NUEVA ACCIÓN
router.post("/actions", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { type, seed, sowingDate, bioFertilizer, observations, location, crop } = req.body;

    if (!type) {
      return res.status(400).json({ error: "El tipo de acción es requerido" });
    }

    const nuevaAccion = new Accion({
      userId,
      type,
      seed,
      sowingDate: sowingDate ? new Date(sowingDate) : undefined,
      bioFertilizer,
      observations,
      location,
      crop,
      date: new Date(),
      synced: true
    });

    await nuevaAccion.save();

    console.log(`✅ Nueva acción registrada: ${type} para usuario ${userId}`);

    res.json({
      mensaje: "Acción registrada correctamente",
      accion: nuevaAccion
    });
  } catch (error) {
    console.error("❌ Error creando acción:", error);
    res.status(500).json({ error: "Error al crear acción" });
  }
});

// 🔔 ENDPOINTS DE ALERTAS

// OBTENER ALERTAS DEL USUARIO ACTUAL
router.get("/alerts", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { unreadOnly } = req.query;

    console.log(`🔔 Obteniendo alertas para usuario: ${userId}`);
    
    let query = { userId };
    if (unreadOnly === 'true') {
      query.read = false;
    }

    const alertas = await Alerta.find(query).sort({ date: -1 });
    
    console.log(`✅ Encontradas ${alertas.length} alertas para usuario ${userId}`);
    res.json(alertas);
  } catch (error) {
    console.error("❌ Error obteniendo alertas:", error);
    res.status(500).json({ error: "Error al obtener alertas" });
  }
});

// 📊 ENDPOINTS DE DATOS DE SENSORES

// OBTENER DATOS DE SENSORES DEL USUARIO ACTUAL
router.get("/sensor-data", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit, startDate, endDate } = req.query;

    console.log(`📊 Obteniendo datos de sensor para usuario: ${userId}`);
    
    let query = { userId };
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    let datosQuery = SensorData.find(query).sort({ date: -1 });
    
    if (limit) {
      datosQuery = datosQuery.limit(parseInt(limit));
    }

    const datos = await datosQuery;
    console.log(`✅ Encontrados ${datos.length} datos de sensor para usuario ${userId}`);
    
    res.json(datos);
  } catch (error) {
    console.error("❌ Error obteniendo datos de sensor:", error);
    res.status(500).json({ error: "Error al obtener datos de sensor" });
  }
});

// 🌱 ENDPOINTS DE CULTIVOS UNIFICADOS

// OBTENER TODOS LOS CULTIVOS DEL USUARIO ACTUAL
router.get("/crops", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    console.log(`🌱 Obteniendo cultivos para usuario: ${userId}`);
    
    // ✅ SOLO UN MODELO - Cultivo
    const cultivos = await Cultivo.find({ userId })
      .sort({ createdAt: -1 });
    
    console.log(`📊 Cultivos encontrados: ${cultivos.length}`);

    res.json(cultivos);
  } catch (error) {
    console.error("❌ Error obteniendo cultivos:", error);
    res.status(500).json({ error: "Error al obtener datos" });
  }
});

// OBTENER UN CULTIVO ESPECÍFICO
router.get("/crops/:cropId", authenticateToken, async (req, res) => {
  try {
    const { cropId } = req.params;
    const userId = req.userId;

    const cultivo = await Cultivo.findOne({ _id: cropId, userId });
    
    if (!cultivo) {
      return res.status(404).json({ error: "Cultivo no encontrado" });
    }

    res.json(cultivo);
  } catch (error) {
    console.error("❌ Error obteniendo cultivo:", error);
    res.status(500).json({ error: "Error al obtener cultivo" });
  }
});

// CREAR NUEVO CULTIVO O AGREGAR ACCIÓN A CULTIVO EXISTENTE
router.post("/crops", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { 
      crop, 
      location, 
      actionType, 
      seed, 
      bioFertilizer, 
      observations, 
      recommendations,
      humidity,
      status = 'Activo' // Permitir actualizar estado
    } = req.body;

    if (!crop || !location) {
      return res.status(400).json({ error: "Cultivo y ubicación son requeridos" });
    }

    // 🔍 BUSCAR CULTIVO EXISTENTE - MEJORADO
    // Normalizar nombres para evitar diferencias por espacios/mayúsculas
    const normalizedCrop = crop.trim().toLowerCase();
    const normalizedLocation = location.trim().toLowerCase();

    let cultivoExistente = await Cultivo.findOne({ 
      userId, 
      $expr: {
        $and: [
          { $eq: [{ $toLower: "$crop" }, normalizedCrop] },
          { $eq: [{ $toLower: "$location" }, normalizedLocation] }
        ]
      },
      status: 'Activo' // Solo cultivos activos
    });

    if (cultivoExistente) {
      console.log(`🔄 Cultivo existente encontrado: ${cultivoExistente._id}`);
      
      // 📝 CREAR NUEVA ACCIÓN PARA EL HISTORIAL
      const nuevaAccion = {
        date: new Date(),
        type: actionType || 'other',
        seed: seed || '',
        action: generarDescripcionAccion(actionType, seed, bioFertilizer),
        bioFertilizer: bioFertilizer || '',
        observations: observations || '',
        synced: true,
        _id: new mongoose.Types.ObjectId() // ✅ ID único para cada acción
      };

      // 🔄 AGREGAR AL HISTORIAL (al inicio para mantener orden cronológico)
      cultivoExistente.history.unshift(nuevaAccion);
      
      // 📊 ACTUALIZAR CAMPOS DEL CULTIVO SI SE PROPORCIONAN
      if (humidity !== undefined) cultivoExistente.humidity = humidity;
      if (bioFertilizer) cultivoExistente.bioFertilizer = bioFertilizer;
      if (observations) {
        cultivoExistente.observations = observations;
      }
      if (recommendations) cultivoExistente.recommendations = recommendations;
      if (status) cultivoExistente.status = status;

      // 📅 Actualizar fecha de siembra si es una acción de siembra
      if (actionType === 'sowing') {
        cultivoExistente.sowingDate = new Date();
      }

      await cultivoExistente.save();

      console.log(`✅ Acción agregada a cultivo existente: ${crop} en ${location}`);

      res.json({
        mensaje: "Acción agregada al cultivo existente",
        cultivo: cultivoExistente,
        accion: nuevaAccion,
        tipo: "accion_agregada"
      });

    } else {
      // 🆕 CREAR NUEVO CULTIVO
      const primerHistorial = {
        date: new Date(),
        type: actionType || 'sowing',
        seed: seed || '',
        action: generarDescripcionAccion(actionType || 'sowing', seed, bioFertilizer),
        bioFertilizer: bioFertilizer || '',
        observations: observations || '',
        synced: true,
        _id: new mongoose.Types.ObjectId()
      };

      const nuevoCultivo = new Cultivo({
        userId,
        crop: crop.trim(), // Limpiar espacios
        location: location.trim(), // Limpiar espacios
        status: 'Activo',
        humidity: humidity || null,
        bioFertilizer: bioFertilizer || '',
        sowingDate: new Date(),
        observations: observations || '',
        recommendations: recommendations || '',
        history: [primerHistorial]
      });

      await nuevoCultivo.save();

      console.log(`🌱 Nuevo cultivo creado: ${crop} en ${location}`);

      res.json({
        mensaje: "Cultivo creado correctamente",
        cultivo: nuevoCultivo,
        tipo: "nuevo_cultivo"
      });
    }
  } catch (error) {
    console.error("❌ Error creando/actualizando cultivo:", error);
    res.status(500).json({ error: "Error al crear/actualizar cultivo" });
  }
});

// FUNCIÓN AUXILIAR PARA GENERAR DESCRIPCIÓN DE ACCIÓN
function generarDescripcionAccion(tipo, semilla, bioFertilizante) {
  switch (tipo) {
    case 'sowing':
      return `Siembra de ${semilla || 'cultivo'}`;
    case 'watering':
      return 'Riego aplicado';
    case 'fertilization':
      return `Aplicación de ${bioFertilizante || 'biofertilizante'}`;
    case 'harvest':
      return 'Cosecha realizada';
    case 'pruning':
      return 'Poda realizada';
    default:
      return 'Acción realizada';
  }
}

// ACTUALIZAR CULTIVO
router.put("/crops/:cropId", authenticateToken, async (req, res) => {
  try {
    const { cropId } = req.params;
    const userId = req.userId;
    const { status, observations, recommendations, humidity } = req.body;

    const cultivo = await Cultivo.findOneAndUpdate(
      { _id: cropId, userId },
      { 
        status: status || 'Activo',
        observations,
        recommendations, 
        humidity
      },
      { new: true }
    );

    if (!cultivo) {
      return res.status(404).json({ error: "Cultivo no encontrado" });
    }

    res.json({
      mensaje: "Cultivo actualizado correctamente",
      cultivo
    });
  } catch (error) {
    console.error("❌ Error actualizando cultivo:", error);
    res.status(500).json({ error: "Error al actualizar cultivo" });
  }
});

// ELIMINAR CULTIVO
router.delete("/crops/:cropId", authenticateToken, async (req, res) => {
  try {
    const { cropId } = req.params;
    const userId = req.userId;

    const cultivo = await Cultivo.findOneAndDelete({ _id: cropId, userId });

    if (!cultivo) {
      return res.status(404).json({ error: "Cultivo no encontrado" });
    }

    res.json({
      mensaje: "Cultivo eliminado correctamente"
    });
  } catch (error) {
    console.error("❌ Error eliminando cultivo:", error);
    res.status(500).json({ error: "Error al eliminar cultivo" });
  }
});

// OBTENER ÚLTIMO DATO DE SENSOR DEL USUARIO ACTUAL
router.get("/sensor-data/latest", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;

    console.log(`📊 Obteniendo último dato de sensor para usuario: ${userId}`);
    
    const ultimoDato = await SensorData.findOne({ userId })
      .sort({ date: -1 })
      .limit(1);

    console.log(`✅ Último dato encontrado para usuario ${userId}:`, ultimoDato ? 'Sí' : 'No');
    res.json(ultimoDato || {});
  } catch (error) {
    console.error("❌ Error obteniendo último dato:", error);
    res.status(500).json({ error: "Error al obtener último dato" });
  }
});

module.exports = router;