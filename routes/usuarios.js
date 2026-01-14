import express from 'express';
import db from './db.js';
import bcrypt from 'bcrypt';

const usuariosRouter = express.Router();

// Obtener todos los usuarios (nombre y cédula)
usuariosRouter.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT cedula, nombre FROM personas');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
});

// Registrar usuario nuevo (inserta en personas y usuarios)
usuariosRouter.post('/registrar', async (req, res) => {
  const {
    cedula_usuario, nombre, apellido, usuario,
    contrasena, rol, correo, telefono
  } = req.body;

  if (!cedula_usuario || !nombre || !apellido || !usuario || !contrasena || !rol || !correo || !telefono) {
    return res.status(400).json({ error: "Faltan datos obligatorios." });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Insertar en personas (ignora si ya existe)
    await conn.query(`
      INSERT INTO personas (cedula, nombre, apellido, correo, telefono)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE nombre = VALUES(nombre),
                              apellido = VALUES(apellido),
                              correo = VALUES(correo),
                              telefono = VALUES(telefono)
    `, [cedula_usuario, nombre, apellido, correo || null, telefono || null]);

    // Obtener id del rol
    const [[rolRow]] = await conn.query(`SELECT id_rol FROM roles WHERE nombre_rol = ?`, [rol]);
    if (!rolRow) {
      await conn.rollback();
      return res.status(400).json({ error: "Rol no válido." });
    }

    // Insertar en usuarios
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    await conn.query(`
      INSERT INTO usuarios (cedula, usuario, contrasena, id_rol)
      VALUES (?, ?, ?, ?)
    `, [cedula_usuario, usuario, hashedPassword, rolRow.id_rol]);

    await conn.commit();
    res.status(201).json({ success: true, message: "Usuario registrado correctamente." });

  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: "Usuario ya existe." });
    } else {
      console.error(err);
      res.status(500).json({ error: "Error al registrar usuario." });
    }
  } finally {
    conn.release();
  }
});

// Actualizar datos de usuario (personas y usuarios)
usuariosRouter.patch('/:cedula', async (req, res) => {
  const { cedula } = req.params;
  const {
    nombre, apellido, correo, telefono,
    usuario, contrasena, rol
  } = req.body;

  if (!cedula) {
    return res.status(400).json({ error: "Cédula faltante." });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Actualizar personas
    if (nombre || apellido || correo || telefono) {
      const camposPersona = [];
      const valoresPersona = [];

      if (nombre) { camposPersona.push("nombre = ?"); valoresPersona.push(nombre); }
      if (apellido) { camposPersona.push("apellido = ?"); valoresPersona.push(apellido); }
      if (correo) { camposPersona.push("correo = ?"); valoresPersona.push(correo); }
      if (telefono) { camposPersona.push("telefono = ?"); valoresPersona.push(telefono); }

      if (camposPersona.length > 0) {
        await conn.query(
          `UPDATE personas SET ${camposPersona.join(', ')} WHERE cedula = ?`,
          [...valoresPersona, cedula]
        );
      }
    }

    // Actualizar usuarios
    const camposUsuario = [];
    const valoresUsuario = [];

    if (usuario) {
      camposUsuario.push("usuario = ?");
      valoresUsuario.push(usuario);
    }

    if (contrasena && contrasena.trim() !== "") {
      const hashedPassword = await bcrypt.hash(contrasena, 10);
      camposUsuario.push("contrasena = ?");
      valoresUsuario.push(hashedPassword);
    }

    if (rol) {
      const [[rolRow]] = await conn.query(`SELECT id_rol FROM roles WHERE nombre_rol = ?`, [rol]);
      if (!rolRow) {
        await conn.rollback();
        return res.status(400).json({ error: "Rol no válido." });
      }
      camposUsuario.push("id_rol = ?");
      valoresUsuario.push(rolRow.id_rol);
    }


    if (camposUsuario.length > 0) {
      await conn.query(
        `UPDATE usuarios SET ${camposUsuario.join(', ')} WHERE cedula = ?`,
        [...valoresUsuario, cedula]
      );
    }

    await conn.commit();
    res.json({ success: true, message: "Usuario actualizado correctamente." });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: "Error al actualizar usuario." });
  } finally {
    conn.release();
  }
});


// Buscar usuario por cédula
usuariosRouter.get('/buscar/:cedula', async (req, res) => {
  const cedula = req.params.cedula;
  try {
    const [[row]] = await db.query(`
      SELECT p.nombre, p.apellido, p.correo, p.telefono,
             u.usuario, r.nombre_rol AS rol
      FROM personas p
      JOIN usuarios u ON p.cedula = u.cedula
      JOIN roles r ON u.id_rol = r.id_rol
      WHERE p.cedula = ?
      AND u.estado = 'activo'
    `, [cedula]);

    if (!row) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error al buscar usuario' });
  }
});

usuariosRouter.get('/buscar-con-roles/:cedula', async (req, res) => {
  const cedula = req.params.cedula;
  try {
    const [[usuario]] = await db.query(
      `SELECT u.usuario, p.nombre, p.apellido, p.correo, p.telefono, r.nombre_rol AS rol
       FROM usuarios u
       JOIN personas p ON u.cedula = p.cedula
       JOIN roles r ON u.id_rol = r.id_rol
       WHERE u.cedula = ?
       AND u.estado = 'activo'`,
      [cedula]
    );

    const [roles] = await db.query(`SELECT nombre_rol FROM roles`);

    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    res.json({ success: true, usuario, roles: roles.map(r => r.nombre_rol) });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error interno al obtener datos' });
  }
});


// Obtener todos los roles
usuariosRouter.get('/roles', async (req, res) => {
  try {
    const [roles] = await db.query('SELECT nombre_rol FROM roles');
    const rolesNombres = roles.map(r => r.nombre_rol);
    res.json(rolesNombres);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener roles" });
  }
});


// Desactivar
usuariosRouter.patch('/:cedula/desactivar', async (req, res) => {
  try {
    const [result] = await db.query(
      `UPDATE usuarios SET estado = 'inactivo' WHERE cedula = ?`,
      [req.params.cedula]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ success: true, message: 'Usuario desactivado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

// Activar
usuariosRouter.patch('/:cedula/activar', async (req, res) => {
  try {
    const [result] = await db.query(
      `UPDATE usuarios SET estado = 'activo' WHERE cedula = ?`,
      [req.params.cedula]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ success: true, message: 'Usuario activado' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al activar usuario' });
  }
});


// Lista para panel admin: soporta ?estado=activo|inactivo y ?rol=nombre_rol
usuariosRouter.get('/admin-list', async (req, res) => {
  const { estado, rol } = req.query;

  const where = [];
  const params = [];

  if (estado === 'activo' || estado === 'inactivo') {
    where.push('u.estado = ?');
    params.push(estado);
  }
  if (rol && rol !== 'todos') {
    where.push('r.nombre_rol = ?');
    params.push(rol);
  }

  const sql = `
    SELECT
      p.cedula,
      p.nombre,
      p.apellido,
      u.usuario,
      r.nombre_rol AS rol,
      u.estado
    FROM usuarios u
    JOIN personas p ON p.cedula = u.cedula
    JOIN roles r ON r.id_rol = u.id_rol
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.apellido, p.nombre
  `;

  try {
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al obtener lista de usuarios' });
  }
});

//validar cédula con web service externo
usuariosRouter.get("/verificacion/:cedula", async (req, res) => {
  const cedula = req.params.cedula;

  try {
    const r = await fetch(`https://webservices.ec/api/cedula/${cedula}`, {
      headers: {
        "Authorization": `Bearer ${process.env.TOKEN_WEB_SERVICES}`,
        "Accept": "application/json"
      }
    });

    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error consultando cédula" });
  }
});

//valiar whatsapp con web service externo aun probando si usarlo o no con este porque cobra
// usuariosRouter.get("/verificacion-whatsapp/:telefono", async (req, res) => {
//   const telefono = req.params.telefono;

//   try {
//     const r = await fetch(`https://webservices.ec/api/checkwhatsapp/${telefono}`, {
//       headers: {
//         "Authorization": `Bearer ${process.env.TOKEN_WEB_SERVICES}`,
//         "Accept": "application/json"
//       }
//     });

//     const data = await r.json();
//     res.json(data); // devolvemos la respuesta tal cual
//   } catch (err) {
//     console.error("ERROR WHATSAPP API:", err);
//     res.status(500).json({ error: "Error al consultar WhatsApp" });
//   }
// });


// Verificar si un número tiene WhatsApp usando Zampisoft no cobra por consulta
usuariosRouter.get("/verificacion-whatsapp/:telefonoLocal", async (req, res) => {
  const telefonoLocal = req.params.telefonoLocal;

  try {
    // Validación básica: 10 dígitos y empieza con 0
    const regexTel = /^0\d{9}$/;
    if (!regexTel.test(telefonoLocal)) {
      return res.status(400).json({ error: "Número de teléfono inválido" });
    }

    // Convertir a formato internacional: +593 + sin el primer 0
    const telefonoInternacional = `+593${telefonoLocal.slice(1)}`;

    const url = `https://apiconsult.zampisoft.com/api/check-phone?phone=${encodeURIComponent(telefonoInternacional)}&token=${process.env.ZAMPISOFT_TOKEN}`;

    const r = await fetch(url); // si tu Node no tiene fetch nativo: import fetch from 'node-fetch'
    if (!r.ok) {
      console.error("Error Zampisoft:", r.status, await r.text());
      return res.status(502).json({ error: "Error al consultar servicio de WhatsApp" });
    }

    const data = await r.json();
    res.json(data); // devolvemos tal cual lo que responde Zampisoft
  } catch (err) {
    console.error("ERROR WHATSAPP API:", err);
    res.status(500).json({ error: "Error interno al verificar WhatsApp" });
  }
});


//obtener usuario por rol para encuestas
usuariosRouter.get("/:rolfetch", async (req, res) => {
  const rol = req.params.rolfetch;
  try {
   const [usuarios] = await db.query(`
      SELECT p.cedula, p.nombre, p.apellido
      FROM personas p
      JOIN usuarios u ON p.cedula = u.cedula
      JOIN roles r ON u.id_rol = r.id_rol
      WHERE r.nombre_rol = ?
      AND u.estado = 'activo'
      AND u.cedula NOT IN ('0000000001', '0000000002', '0000000003')
    `, [rol]);
      
  
  res.json(usuarios);
    
  }
  catch (error) {
    console.error("Error al obtener usuarios por rol:", error);
    res.status(500).json({ error: "Error al obtener usuarios por rol" });
  }
});



//ENDPOINTS NUEVOS 
usuariosRouter.get('/area/:area', async (req, res) => {
  const { area } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT p.cedula, p.nombre, p.apellido
      FROM usuarios u
      JOIN personas p ON u.cedula = p.cedula
      JOIN roles r ON u.id_rol = r.id_rol
      WHERE r.nombre_rol = ?
        AND u.estado = 'activo'
    `, [area]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al cargar personal" });
  }
});


export default usuariosRouter;
