// routes/farmerRoutes.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// ✅ SOLUCIÓN: Usa solo esta línea y elimina las declaraciones individuales
const { Cultivo, Accion, Alerta, SensorData, Project, Usuario } = require("../models");

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


// 🌐 ENDPOINTS PARA SINCRONIZACIÓN WEB-APP

// OBTENER PROYECTOS DE LA WEB Y CONVERTIRLOS A FORMATO APP
router.get("/web-projects", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    console.log(`🌐 Obteniendo proyectos web para usuario: ${userId}`);
    
    // Obtener proyectos de la web
    const webProjects = await Project.find({ userId })
      .sort({ createdAt: -1 });
    
    console.log(`📋 Proyectos web encontrados: ${webProjects.length}`);
    
    // Convertir proyectos web a formato de cultivos de la app
    const proyectosConvertidos = webProjects.map(proyectoWeb => {
      return {
        _id: proyectoWeb._id,
        userId: proyectoWeb.userId,
        crop: proyectoWeb.crop,
        location: proyectoWeb.location,
        status: proyectoWeb.status || 'Activo',
        humidity: proyectoWeb.humidity,
        bioFertilizer: proyectoWeb.bioFertilizer,
        sowingDate: proyectoWeb.sowingDate,
        observations: proyectoWeb.observations,
        recommendations: proyectoWeb.recommendations,
        history: (proyectoWeb.history || []).map(accion => ({
          ...accion.toObject?.() || accion,
          isWebAction: true
        })),
        isWebProject: true,
        synced: true,
        createdAt: proyectoWeb.createdAt,
        isLegacy: true
      };
    });
    
    res.json(proyectosConvertidos);
    
  } catch (error) {
    console.error("❌ Error obteniendo proyectos web:", error);
    res.status(500).json({ error: "Error al obtener proyectos web" });
  }
});

// SINCRONIZAR DATOS COMPLETOS (WEB + APP)
router.get("/sync-all-data", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    console.log(`🔄 Sincronizando todos los datos para usuario: ${userId}`);
    
    // 1. Obtener cultivos de la app
    const cultivosApp = await Cultivo.find({ userId })
      .sort({ createdAt: -1 });
    
    // 2. Obtener proyectos de la web
    const proyectosWeb = await Project.find({ userId })
      .sort({ createdAt: -1 });
    
    // 3. Convertir proyectos web a formato unificado
    const proyectosConvertidos = proyectosWeb.map(proyectoWeb => {
      return {
        _id: proyectoWeb._id,
        userId: proyectoWeb.userId,
        crop: proyectoWeb.crop,
        location: proyectoWeb.location,
        status: proyectoWeb.status || 'Activo',
        humidity: proyectoWeb.humidity,
        bioFertilizer: proyectoWeb.bioFertilizer,
        sowingDate: proyectoWeb.sowingDate,
        observations: proyectoWeb.observations,
        recommendations: proyectoWeb.recommendations,
        history: (proyectoWeb.history || []).map(accion => ({
          ...accion.toObject?.() || accion,
          isWebAction: true
        })),
        isWebProject: true,
        synced: true,
        createdAt: proyectoWeb.createdAt,
        isLegacy: true
      };
    });
    
    // 4. Combinar todos los datos
    const todosLosDatos = [...cultivosApp, ...proyectosConvertidos];
    
    console.log(`✅ Sincronización completada: ${cultivosApp.length} app + ${proyectosWeb.length} web = ${todosLosDatos.length} total`);
    
    res.json({
      mensaje: "Datos sincronizados correctamente",
      datos: todosLosDatos,
      resumen: {
        total: todosLosDatos.length,
        desdeApp: cultivosApp.length,
        desdeWeb: proyectosWeb.length,
        ultimaSincronizacion: new Date()
      }
    });
    
  } catch (error) {
    console.error("❌ Error en sincronización completa:", error);
    res.status(500).json({ error: "Error al sincronizar datos" });
  }
});

// CREAR PROYECTO DESDE LA APP (compatibilidad bidireccional)
router.post("/web-projects", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { crop, location, status, humidity, bioFertilizer, sowingDate, observations, recommendations, history } = req.body;

    if (!crop || !location) {
      return res.status(400).json({ error: "Cultivo y ubicación son requeridos" });
    }

    const nuevoProyectoWeb = new Project({
      userId,
      crop,
      location,
      status: status || 'Activo',
      humidity: humidity || null,
      bioFertilizer: bioFertilizer || '',
      sowingDate: sowingDate || new Date(),
      observations: observations || '',
      recommendations: recommendations || '',
      history: history || [],
      synced: true
    });

    await nuevoProyectoWeb.save();

    console.log(`🌐 Nuevo proyecto web creado desde app: ${crop}`);

    res.json({
      mensaje: "Proyecto web creado correctamente",
      proyecto: nuevoProyectoWeb
    });
    
  } catch (error) {
    console.error("❌ Error creando proyecto web:", error);
    res.status(500).json({ error: "Error al crear proyecto web" });
  }
});

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

// 🌱 ENDPOINTS DE CULTIVOS MEJORADOS

// OBTENER TODOS LOS CULTIVOS DEL USUARIO ACTUAL (INCLUYENDO ACCIONES WEB)
router.get("/crops", authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    
    console.log(`🌱 Obteniendo datos combinados para usuario: ${userId}`);
    
    // 1. Obtener cultivos nuevos (sistema actual)
    const cultivos = await Cultivo.find({ userId })
      .sort({ createdAt: -1 });
    
    console.log(`📊 Cultivos nuevos encontrados: ${cultivos.length}`);

    // 2. Obtener proyectos web
    const proyectosWeb = await Project.find({ userId }).sort({ createdAt: -1 });
    
    console.log(`📝 Proyectos web encontrados: ${proyectosWeb.length}`);

    // 3. Convertir proyectos web a formato de cultivos
    const cultivosDeWeb = proyectosWeb.map(proyectoWeb => {
      return {
        _id: proyectoWeb._id,
        userId: proyectoWeb.userId,
        crop: proyectoWeb.crop,
        location: proyectoWeb.location,
        status: proyectoWeb.status || 'Activo',
        humidity: proyectoWeb.humidity,
        bioFertilizer: proyectoWeb.bioFertilizer,
        sowingDate: proyectoWeb.sowingDate,
        observations: proyectoWeb.observations,
        recommendations: proyectoWeb.recommendations,
        history: (proyectoWeb.history || []).map(accion => ({
          ...accion.toObject?.() || accion,
          isWebAction: true
        })),
        isWebProject: true,
        synced: true,
        createdAt: proyectoWeb.createdAt,
        isLegacy: true
      };
    });

    // 4. Combinar cultivos nuevos con cultivos de web
    const todosLosCultivos = [...cultivos, ...cultivosDeWeb];
    
    console.log(`✅ Datos combinados: ${cultivos.length} cultivos + ${cultivosDeWeb.length} de web = ${todosLosCultivos.length} total`);

    res.json(todosLosCultivos);
  } catch (error) {
    console.error("❌ Error obteniendo datos combinados:", error);
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
      humidity 
    } = req.body;

    if (!crop || !location) {
      return res.status(400).json({ error: "Cultivo y ubicación son requeridos" });
    }

    // Buscar si ya existe un cultivo activo con el mismo nombre y ubicación
    let cultivoExistente = await Cultivo.findOne({ 
      userId, 
      crop, 
      location, 
      status: 'Activo' 
    });

    if (cultivoExistente) {
      // 🔄 AGREGAR ACCIÓN AL HISTORIAL DEL CULTIVO EXISTENTE
      const nuevaAccion = {
        date: new Date(),
        type: actionType || 'other',
        seed: seed || '',
        action: generarDescripcionAccion(actionType, seed, bioFertilizer),
        bioFertilizer: bioFertilizer || '',
        observations: observations || '',
        synced: true
      };

      cultivoExistente.history.push(nuevaAccion);
      
      // Actualizar campos si se proporcionan
      if (humidity) cultivoExistente.humidity = humidity;
      if (bioFertilizer) cultivoExistente.bioFertilizer = bioFertilizer;
      if (observations) cultivoExistente.observations = observations;
      if (recommendations) cultivoExistente.recommendations = recommendations;

      await cultivoExistente.save();

      console.log(`✅ Acción agregada a cultivo existente: ${crop} para usuario ${userId}`);

      res.json({
        mensaje: "Acción agregada al cultivo existente",
        cultivo: cultivoExistente,
        accion: nuevaAccion
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
        synced: true
      };

      const nuevoCultivo = new Cultivo({
        userId,
        crop,
        location,
        status: 'Activo',
        humidity: humidity || null,
        bioFertilizer: bioFertilizer || '',
        sowingDate: new Date(),
        observations: observations || '',
        recommendations: recommendations || '',
        history: [primerHistorial]
      });

      await nuevoCultivo.save();

      console.log(`🌱 Nuevo cultivo creado: ${crop} para usuario ${userId}`);

      res.json({
        mensaje: "Cultivo creado correctamente",
        cultivo: nuevoCultivo
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