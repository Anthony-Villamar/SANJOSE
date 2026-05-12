
import express from 'express';
import db from './db.js';

const estadisticasRouter = express.Router();

// Estadísticas detalladas por usuario logueado
estadisticasRouter.get('/detalle', async (req, res) => {
  const cedula = req.session.user?.cedula;
  // if (!cedula) return res.status(401).json({ message: 'Usuario no autenticado' });

  try {
    const sql = `
      SELECT 
    ROUND(AVG(c.puntualidad), 2) AS promedio_puntualidad,
    ROUND(AVG(c.trato), 2) AS promedio_trato,
    ROUND(AVG(c.resolucion), 2) AS promedio_resolucion
  FROM calificaciones c
  JOIN usuarios u ON u.cedula = c.cedula_usuario
  WHERE c.cedula_usuario = ?
    AND u.estado = 'activo'
    AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
    `;
    const [rows] = await db.query(sql, [cedula]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener estadísticas detalladas' });
  }
});

// Estadísticas generales TOP 3
estadisticasRouter.get('/top3', async (req, res) => {
  try {
    const sql = `
      SELECT 
  p.nombre, p.apellido,
  ROUND(AVG(c.puntualidad), 2) AS promedio_puntualidad,
  ROUND(AVG(c.trato), 2) AS promedio_trato,
  ROUND(AVG(c.resolucion), 2) AS promedio_resolucion,
  ROUND(AVG((c.puntualidad + c.trato + c.resolucion) / 3), 2) AS promedio
FROM calificaciones c
JOIN personas p ON c.cedula_usuario = p.cedula
JOIN usuarios u ON u.cedula = p.cedula
WHERE u.estado = 'activo'
  AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
GROUP BY c.cedula_usuario
ORDER BY promedio DESC
LIMIT 3;
    `;
    const [rows] = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener estadísticas' });
  }
});

// Estadísticas por día del usuario logueado
estadisticasRouter.get('/detalle/diario', async (req, res) => {
  const cedula = req.session.user?.cedula;
  // if (!cedula) {
  //   return res.status(401).json({ message: 'Usuario no autenticado' });
  // }

  try {
    const sql = `
      SELECT 
        DATE(c.fecha) AS fecha,
        ROUND(AVG(c.puntualidad), 2) AS promedio_puntualidad,
        ROUND(AVG(c.trato), 2) AS promedio_trato,
        ROUND(AVG(c.resolucion), 2) AS promedio_resolucion
      FROM calificaciones c
      WHERE c.cedula_usuario = ?
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
      GROUP BY DATE(c.fecha)
      ORDER BY fecha DESC
    `;

    const [rows] = await db.query(sql, [cedula]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener estadísticas por día' });
  }
});
// estadisticasRouter.get('/detalle/diario', async (req, res) => {
//   const cedula = req.session.user?.cedula;
//   if (!cedula) return res.status(401).json({ message: 'Usuario no autenticado' });

//   try {
//     const sql = `
//       SELECT 
//         DATE(c.fecha) AS fecha,
//         ROUND(AVG(c.puntualidad), 2) AS promedio_puntualidad,
//         ROUND(AVG(c.trato), 2) AS promedio_trato,
//         ROUND(AVG(c.resolucion), 2) AS promedio_resolucion
//       FROM calificaciones c
//       JOIN usuarios u ON u.cedula = c.atendido_por
//       WHERE c.atendido_por = ?
//         AND u.estado = 'activo'
//         AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
//       GROUP BY DATE(c.fecha)
//       ORDER BY fecha DESC
//     `;
//     const [rows] = await db.query(sql, [cedula]);
//     res.json(rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error al obtener estadísticas por día' });
//   }
// });

//  Promedio de estadísticas en un rango de fechas
estadisticasRouter.get('/detalle/promedio', async (req, res) => {
  const cedula = req.session.user?.cedula;
  const { desde, hasta } = req.query;

  // if (!cedula) {
  //   return res.status(401).json({ message: 'Usuario no autenticado' });
  // }

  if (!desde || !hasta) {
    return res.status(400).json({ message: 'Fechas requeridas' });
  }

  try {
    const sql = `
      SELECT
        ROUND(AVG(c.puntualidad), 2) AS promedio_puntualidad,
        ROUND(AVG(c.trato), 2) AS promedio_trato,
        ROUND(AVG(c.resolucion), 2) AS promedio_resolucion
      FROM calificaciones c
      WHERE c.cedula_usuario = ?
        AND c.fecha >= CONCAT(?, ' 07:00:00')
        AND c.fecha <= CONCAT(?, ' 14:30:00')
    `;

    const [rows] = await db.query(sql, [cedula, desde, hasta]);

    res.json(rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error al obtener promedio' });
  }
});

// estadisticasRouter.get('/detalle/promedio', async (req, res) => {
//   const cedula = req.session.user?.cedula;
//   if (!cedula) return res.status(401).json({ message: 'Usuario no autenticado' });

//   const { desde, hasta } = req.query;
//   if (!desde || !hasta) {
//     return res.status(400).json({ message: 'Faltan parámetros de fecha' });
//   }

//   try {
//     const sql = `
//       SELECT 
//         ROUND(AVG(c.puntualidad), 2) AS promedio_puntualidad,
//         ROUND(AVG(c.trato), 2) AS promedio_trato,
//         ROUND(AVG(c.resolucion), 2) AS promedio_resolucion
//       FROM calificaciones c
//       JOIN usuarios u ON u.cedula = c.atendido_por
//       WHERE c.atendido_por = ?
//         AND u.estado = 'activo'
//         AND c.fecha BETWEEN ? AND ?
//         AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
//     `;
//     const [rows] = await db.query(sql, [cedula, desde + " 00:00:00", hasta + " 23:59:59"]);

//     res.json(rows[0] || {});
//   } catch (err) {
//     console.error("Error en /detalle/promedio:", err);
//     res.status(500).json({ message: 'Error al obtener promedio en rango' });
//   }
// });



//  Estadísticas para radar calendario en un rango de fechas y área
estadisticasRouter.get("/calendario", async (req, res) => {
  try {
    const { inicio, fin, area } = req.query;

    let filtroArea = "";
    let params = [inicio, fin];

    if (area && area !== "todas") {
      const areaId =
        area === "secretaria" ? 1 :
        area === "colecturia" ? 2 :
        area === "docente" ? 3 :
        null;

      if (areaId) {
        filtroArea = "AND c.area_atencion = ?";
        params.push(areaId);
      }
    }

    const [rows] = await db.query(
      `
      SELECT 
        DATE(c.fecha) AS dia,
        COUNT(*) AS total,
        ROUND(AVG(c.puntualidad), 2) AS puntualidad,
        ROUND(AVG(c.trato), 2) AS trato,
        ROUND(AVG(c.resolucion), 2) AS resolucion
      FROM calificaciones c
      WHERE DATE(c.fecha) BETWEEN ? AND ?
        AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
        ${filtroArea}
      GROUP BY dia
      ORDER BY dia;
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("Error calendario:", err);
    res.status(500).json({ error: "Error obteniendo estadísticas" });
  }
});

// estadisticasRouter.get("/calendario", async (req, res) => {
//   try {
//     const { inicio, fin, area } = req.query;

//     // Roles permitidos (secretaria, docente, colecturia)
//     const rolesValidos = ["secretaria", "docente", "colecturia"];

//     // Validar área
//     let filtroRol = "";
//     let params = [inicio, fin];
//     if (area && area !== "todas" && rolesValidos.includes(area)) {
//       filtroRol = "AND r.nombre_rol = ?";
//       params.push(area);
//     } else {
//       // todas: solo esas 3
//       filtroRol = "AND r.nombre_rol IN (?, ?, ?)";
//       params.push(...rolesValidos);
//     }

//     const [rows] = await db.query(
//       `
//       SELECT 
//   DATE(c.fecha) AS dia,
//   r.nombre_rol,
//   AVG(c.puntualidad) AS puntualidad,
//   AVG(c.trato) AS trato,
//   AVG(c.resolucion) AS resolucion
// FROM calificaciones c
// JOIN personas p ON c.cedula_usuario = p.cedula
// JOIN usuarios u ON u.cedula = p.cedula
// JOIN roles r ON u.id_rol = r.id_rol
// WHERE DATE(c.fecha) BETWEEN ? AND ?
//   AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
//   AND u.estado = 'activo'
//   ${filtroRol}
// GROUP BY dia, r.nombre_rol
// ORDER BY dia;
//       `,
//       params
//     );

//     res.json(rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Error obteniendo estadísticas" });
//   }
// });

export default estadisticasRouter;