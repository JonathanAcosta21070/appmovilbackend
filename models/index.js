// models/index.js - VERSIÓN CORREGIDA
const mongoose = require("mongoose");

// Esquema de Usuario
const UsuarioSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['farmer', 'scientist'], default: 'farmer' },
  cultivo: { type: String, default: '' },
  ubicacion: { type: String, default: '' },
  fechaRegistro: { type: Date, default: Date.now }
}, { collection: 'users' });

// Esquema para Cultivos (App Móvil)
const CultivoSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario", 
    required: true 
  },
  crop: { type: String, required: true },
  location: { type: String, required: true },
  status: { 
    type: String, 
    default: 'Activo', 
    enum: ['Activo', 'Cosechado', 'Abandonado'] 
  },
  humidity: Number,
  bioFertilizer: String,
  sowingDate: { type: Date, default: Date.now },
  observations: String,
  recommendations: String,
  history: [{
    date: { type: Date, default: Date.now },
    type: { 
      type: String, 
      required: true, 
      enum: ['sowing', 'watering', 'fertilization', 'harvest', 'pruning', 'other'] 
    },
    seed: String,
    action: String,
    bioFertilizer: String,
    observations: String,
    synced: { type: Boolean, default: true }
  }],
  createdAt: { type: Date, default: Date.now }
}, { collection: 'projects' });

// Esquema para Acciones Agrícolas
const AccionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, required: true, enum: ['sowing', 'watering', 'fertilization', 'harvest', 'other'] },
  seed: String,
  sowingDate: Date,
  bioFertilizer: String,
  observations: String,
  date: { type: Date, default: Date.now },
  synced: { type: Boolean, default: true },
  location: String,
  crop: String
}, { collection: 'agriculturalActions' });

// Esquema para Alertas
const AlertaSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, default: 'info', enum: ['info', 'warning', 'success', 'error'] },
  from: { type: String, required: true },
  date: { type: Date, default: Date.now },
  read: { type: Boolean, default: false },
  priority: { type: String, default: 'medium', enum: ['low', 'medium', 'high'] }
}, { collection: 'alerts' });

// Esquema para Datos de Sensores
const SensorDataSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  moisture: Number,
  temperature: Number,
  humidity: Number,
  ph: Number,
  date: { type: Date, default: Date.now },
  location: String,
  crop: String
}, { collection: 'sensorData' });

// 🟢 ESQUEMA CORREGIDO: RecomendacionSchema (no RecomendacionSchema)
const RecomendacionSchema = new mongoose.Schema({
  farmerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  cropId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Cultivo' 
  },
  recommendation: { 
    type: String, 
    required: true 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium' 
  },
  scientistId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  scientistName: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'read', 'completed'], 
    default: 'pending' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { collection: 'recommendations' });

// Crear y exportar modelos
const Usuario = mongoose.model("Usuario", UsuarioSchema);
const Cultivo = mongoose.model("Cultivo", CultivoSchema);
const Accion = mongoose.model("Accion", AccionSchema);
const Alerta = mongoose.model("Alerta", AlertaSchema);
const SensorData = mongoose.model("SensorData", SensorDataSchema);
const Recomendacion = mongoose.model("Recomendacion", RecomendacionSchema);

module.exports = {
  Usuario,
  Cultivo,
  Accion,
  Alerta,
  SensorData,
  Recomendacion
};