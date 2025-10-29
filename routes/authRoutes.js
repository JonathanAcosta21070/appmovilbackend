// routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// Importar modelos
const { Usuario } = require("../models");

// 🔐 ENDPOINTS DE AUTENTICACIÓN

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son requeridos" });
    }

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(400).json({ error: "Usuario no encontrado" });
    }

    const esValida = await bcrypt.compare(password, usuario.password);
    if (!esValida) {
      return res.status(400).json({ error: "Contraseña incorrecta" });
    }

    res.json({
      mensaje: "Login exitoso",
      usuario: {
        id: usuario._id,
        name: usuario.name,
        email: usuario.email,
        role: usuario.role,
        cultivo: usuario.cultivo,
        ubicacion: usuario.ubicacion
      },
      token: usuario._id.toString()
    });
  } catch (error) {
    console.error("❌ Error en login:", error);
    res.status(500).json({ error: "Error en el login" });
  }
});

// REGISTRO
router.post("/registro", async (req, res) => {
  try {
    const { name, email, password, role, cultivo, ubicacion } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nombre, email y contraseña son obligatorios" });
    }

    const usuarioExiste = await Usuario.findOne({ email });
    if (usuarioExiste) {
      return res.status(400).json({ error: "El usuario ya existe" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const rolesValidos = ['farmer', 'scientist'];
    const rolFinal = rolesValidos.includes(role) ? role : 'farmer';

    const nuevoUsuario = new Usuario({
      name,
      email,
      password: hashedPassword,
      role: rolFinal,
      cultivo: cultivo || '',
      ubicacion: ubicacion || ''
    });

    await nuevoUsuario.save();

    console.log("👤 Nuevo usuario registrado:", { name, email, role: rolFinal });

    res.json({
      mensaje: "Usuario registrado correctamente",
      usuario: {
        id: nuevoUsuario._id,
        name: nuevoUsuario.name,
        email: nuevoUsuario.email,
        role: nuevoUsuario.role,
        cultivo: nuevoUsuario.cultivo,
        ubicacion: nuevoUsuario.ubicacion
      },
      token: nuevoUsuario._id.toString()
    });
  } catch (error) {
    console.error("❌ Error en registro:", error);
    res.status(500).json({ error: "Error al registrar usuario" });
  }
});

// OBTENER INFORMACIÓN DEL USUARIO
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const usuario = await Usuario.findById(userId);
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      id: usuario._id,
      name: usuario.name,
      email: usuario.email,
      role: usuario.role,
      cultivo: usuario.cultivo,
      ubicacion: usuario.ubicacion,
      fechaRegistro: usuario.fechaRegistro
    });
  } catch (error) {
    console.error("❌ Error obteniendo información del usuario:", error);
    res.status(500).json({ error: "Error al obtener información del usuario" });
  }
});

// ACTUALIZAR PERFIL DE USUARIO
router.put("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, cultivo, ubicacion } = req.body;

    const usuario = await Usuario.findByIdAndUpdate(
      userId,
      { name, cultivo, ubicacion },
      { new: true }
    );

    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      mensaje: "Perfil actualizado correctamente",
      usuario: {
        id: usuario._id,
        name: usuario.name,
        email: usuario.email,
        role: usuario.role,
        cultivo: usuario.cultivo,
        ubicacion: usuario.ubicacion
      }
    });
  } catch (error) {
    console.error("❌ Error actualizando perfil:", error);
    res.status(500).json({ error: "Error al actualizar perfil" });
  }
});

module.exports = router;