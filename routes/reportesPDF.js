import express from "express";
import db from "./db.js";
import PDFDocument from "pdfkit";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const reportesRouter = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ======================
// CONFIG GRAFICOS
// ======================
const chartCanvas = new ChartJSNodeCanvas({
  width: 900,
  height: 420,
  backgroundColour: "white"
});

// ======================
// ENDPOINT PDF
// ======================
reportesRouter.get("/calificaciones/pdf", async (req, res) => {
  try {

    const { inicio, fin, area } = req.query;

    // ======================
    // FILTRO AREA
    // ======================
    let filtroArea = "";
    let params = [inicio, fin];

    let nombreArea = "GENERAL";

    if (area && area !== "todas") {

      const areaId =
        area === "secretaria" ? 1 :
        area === "colecturia" ? 2 :
        area === "docente" ? 3 :
        null;

      nombreArea = area.toUpperCase();

      if (areaId) {
        filtroArea = "AND c.area_atencion = ?";
        params.push(areaId);
      }
    }

    // ======================
    // QUERY
    // ======================
    const [rows] = await db.query(`
      SELECT 
        DATE(c.fecha) AS dia,
        COUNT(*) AS total,
        ROUND(AVG(c.puntualidad),2) AS puntualidad,
        ROUND(AVG(c.trato),2) AS trato,
        ROUND(AVG(c.resolucion),2) AS resolucion
      FROM calificaciones c
      WHERE DATE(c.fecha) BETWEEN ? AND ?
      AND TIME(c.fecha) BETWEEN '07:00:00' AND '14:30:00'
      ${filtroArea}
      GROUP BY dia
      ORDER BY dia
    `, params);

    // ======================
    // VALIDAR
    // ======================
    if (rows.length === 0) {
      return res.status(404).json({
        error: "No existen datos para generar reporte"
      });
    }

    // ======================
    // TOTALES
    // ======================
    const totalAtenciones = rows.reduce((a, b) => a + b.total, 0);

    const promedioPuntualidad =
      rows.reduce((a, b) => a + Number(b.puntualidad), 0) / rows.length;

    const promedioTrato =
      rows.reduce((a, b) => a + Number(b.trato), 0) / rows.length;

    const promedioResolucion =
      rows.reduce((a, b) => a + Number(b.resolucion), 0) / rows.length;

    const diaMasActividad = rows.reduce((max, row) =>
      row.total > max.total ? row : max
    );

    // ======================
    // GRAFICO LINEA
    // ======================
    const lineChart = await chartCanvas.renderToBuffer({
      type: "line",
      data: {
        labels: rows.map(r => r.dia),
        datasets: [{
          label: "Atenciones",
          data: rows.map(r => r.total),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.2)",
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: {
            position: "top"
          }
        }
      }
    });

    // ======================
    // GRAFICO BARRAS
    // ======================
    const barChart = await chartCanvas.renderToBuffer({
      type: "bar",
      data: {
        labels: rows.map(r => r.dia),
        datasets: [
          {
            label: "Puntualidad",
            data: rows.map(r => r.puntualidad),
            backgroundColor: "#2563eb"
          },
          {
            label: "Trato",
            data: rows.map(r => r.trato),
            backgroundColor: "#16a34a"
          },
          {
            label: "Resolución",
            data: rows.map(r => r.resolucion),
            backgroundColor: "#ea580c"
          }
        ]
      },
      options: {
        responsive: false
      }
    });

    // ======================
    // IA
    // ======================
    const resumenIA = rows.map(r => `
      Fecha: ${r.dia}
      Total: ${r.total}
      Puntualidad: ${r.puntualidad}
      Trato: ${r.trato}
      Resolución: ${r.resolucion}
    `).join("\n");

    const iaResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: `
      Genera un análisis institucional profesional.

      NO uses markdown.
      NO uses asteriscos.
      NO uses negritas.

      El análisis debe incluir:
      - resumen general
      - observaciones
      - retroalimentación
      - recomendaciones
      - análisis de comportamiento

      Datos:
      ${resumenIA}
      `,
      temperature: 0.7
    });

    const textoIA =
      iaResponse.output_text ||
      "No se pudo generar análisis.";

    // ======================
    // PDF
    // ======================
    const doc = new PDFDocument({
      size: "A4",
      margin: 50
    });

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `inline; filename=reporte_${Date.now()}.pdf`
    );

    doc.pipe(res);

    // ======================
    // FONDO
    // ======================
    doc.rect(0, 0, doc.page.width, doc.page.height)
      .fill("#f4f7fb");

    // ======================
    // HEADER
    // ======================
    doc.rect(0, 0, doc.page.width, 110)
      .fill("#0f3d75");

    doc
      .fillColor("white")
      .fontSize(28)
      .font("Helvetica-Bold")
      .text(
        "REPORTE DE CALIFICACIONES",
        50,
        28
      );

    doc
      .fontSize(18)
      .fillColor("#7dd3fc")
      .text(
        `ÁREA: ${nombreArea}`,
        50,
        68
      );

    // ======================
    // INFO
    // ======================
    let currentY = 140;

    doc
      .fillColor("#111827")
      .fontSize(11)
      .font("Helvetica")
      .text(`Periodo: ${inicio} hasta ${fin}`, 60, currentY);

    currentY += 25;

    doc.text(
      `Área analizada: ${nombreArea}`,
      60,
      currentY
    );

    currentY += 25;

    doc.text(
      `Total de atenciones: ${totalAtenciones}`,
      60,
      currentY
    );

    currentY += 25;

    const fechaBonita = new Date(diaMasActividad.dia)
      .toLocaleDateString("es-EC", {
        year: "numeric",
        month: "long",
        day: "numeric"
      });

    doc.text(
      `Día con más actividad: ${fechaBonita}`,
      60,
      currentY
    );

    // ======================
    // CARDS
    // ======================
    currentY += 45;

    const cards = [
      {
        titulo: "Puntualidad",
        valor: promedioPuntualidad.toFixed(2),
        color: "#2563eb"
      },
      {
        titulo: "Trato",
        valor: promedioTrato.toFixed(2),
        color: "#16a34a"
      },
      {
        titulo: "Resolución",
        valor: promedioResolucion.toFixed(2),
        color: "#ea580c"
      }
    ];

    let startX = 60;

    cards.forEach(card => {

      // sombra
      doc.roundedRect(startX + 4, currentY + 4, 140, 90, 10)
        .fill("#dbe4f0");

      // card
      doc.roundedRect(startX, currentY, 140, 90, 10)
        .fill("#ffffff")
        .stroke(card.color);

      doc
        .fillColor(card.color)
        .fontSize(16)
        .font("Helvetica-Bold")
        .text(card.titulo, startX + 12, currentY + 12);

      doc
        .fillColor("#111827")
        .fontSize(26)
        .text(card.valor, startX + 30, currentY + 38);

      const nivel =
        Number(card.valor) >= 4
          ? "Excelente"
          : Number(card.valor) >= 3
            ? "Regular"
            : "Bajo";

      doc
        .fillColor("red")
        .fontSize(10)
        .text(`Nivel: ${nivel}`, startX + 12, currentY + 72);

      startX += 170;
    });

    // ======================
    // GRAFICO 1
    // ======================
    currentY += 140;

    doc
      .fillColor("#0f172a")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("Evolución de Atenciones", 60, currentY);

    currentY += 30;

    doc.image(lineChart, 60, currentY, {
      width: 470
    });

    // ======================
    // NUEVA PAGINA
    // ======================
    doc.addPage({
      margin: 50
    });

    // fondo
    doc.rect(0, 0, doc.page.width, doc.page.height)
      .fill("#f4f7fb");

    // ======================
    // GRAFICO 2
    // ======================
    doc
      .fillColor("#0f172a")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Promedio de Calificaciones", 60, 50);

    doc.image(barChart, 60, 100, {
      width: 470
    });

    // ======================
    // ANALISIS IA
    // ======================
    let iaY = 420;

    doc.roundedRect(40, iaY, 520, 250, 12)
      .fill("#ffffff");

    doc
      .fillColor("#0f172a")
      .fontSize(18)
      .font("Helvetica-Bold")
      .text(
        "Análisis y Retroalimentación",
        60,
        iaY + 20
      );

    const textoLimpio = textoIA
      .replace(/\*\*/g, "")
      .replace(/##/g, "")
      .replace(/###/g, "");

    doc
      .fillColor("#374151")
      .fontSize(11)
      .font("Helvetica")
      .text(
        textoLimpio,
        60,
        iaY + 55,
        {
          width: 470,
          align: "justify",
          lineGap: 4
        }
      );

    // ======================
    // FOOTER
    // ======================
    const footerY = doc.page.height - 70;
    doc.fontSize(10)
      .fillColor("#64748b")
      .text(
        "Sistema de Gestión de Calificaciones - San José",
        0,
        footerY,
        {
          align: "center"
        }
      );

    doc.end();

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Error generando reporte PDF"
    });
  }
});

export default reportesRouter;

