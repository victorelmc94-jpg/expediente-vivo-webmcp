# Validación real en Google Cloud

**Fecha:** 25 de agosto de 2026  
**Resultado:** PASS  
**Publicación:** no realizada

## Autenticación y proyecto

- Google Cloud CLI 581.0.0 instalada localmente en `.tools/` y excluida de Git.
- Archivo oficial verificado con SHA-256
  `4ba8775a6fef8e09f9013c711e5a816fd6ce68c8f17da642141f24fd92891530`.
- Login de usuario y Application Default Credentials: activos.
- Credenciales y configuración: fuera del repositorio.
- Proyecto accesible único y activo: `[redacted-project-id]` (nombre redactado).
- Facturación: habilitada; ADC usa el mismo proyecto para cuota.

## APIs y recursos

- Habilitadas y utilizadas: `aiplatform.googleapis.com` y `storage.googleapis.com`.
- `run.googleapis.com`: no habilitada.
- Bucket único: `[redacted-private-bucket]`.
- Ubicación: `EU`; clase `STANDARD`.
- Acceso uniforme: activado.
- Prevención de acceso público: `enforced`; miembros públicos: ninguno.
- Soft delete: desactivado.
- Lifecycle: borrado de objetos con edad de un día.
- Contenido al cierre: 84 objetos sintéticos, 444.434 bytes, siete prefijos de ejecución
  (dos diagnósticos y las cinco ejecuciones finales).

## Error detectado y corrección

La primera ejecución real llegó a Vertex AI y GCS, pero Gemini devolvió predicados libres como
`STATUS` y `DIRECTIVE`. Las citas eran válidas, aunque la reconstrucción quedaba degradada a
estado incierto. El validador no cerraba todavía el vocabulario y el informe técnico podía dar
PASS sin garantizar el significado de esos campos.

Corrección aplicada:

1. vocabulario canónico cerrado en el esquema estructurado del agente;
2. rechazo determinista de cualquier predicado no canónico;
3. mapeo explícito de etiquetas documentales a predicados;
4. temperatura cero y semilla fija para la demo;
5. captura de metadatos de tokens;
6. evaluación cloud de las mismas trece puertas tras cada recorrido.

El diagnóstico corregido produjo 31 afirmaciones, 0 rechazos, estados `OPEN` y `CLOSED` y
13/13 PASS antes de iniciar la serie final.

## Cinco ejecuciones finales

| # | Run ID | Afirmaciones | Rechazos | Errores críticos | Pruebas | Firma |
|---|---|---:|---:|---:|---:|---|
| 1 | `6aa69668-0f68-4220-b233-09c82e7b7c5d` | 31 | 0 | 0 | 13/13 | `296635064f0d...` |
| 2 | `8a495bfa-942c-4f95-a83e-d1a68997ca5f` | 31 | 0 | 0 | 13/13 | `296635064f0d...` |
| 3 | `f7993d15-f18c-4b6d-ac02-680cb9802851` | 31 | 0 | 0 | 13/13 | `296635064f0d...` |
| 4 | `4dd86032-3a37-490b-9e32-386feaff035f` | 31 | 0 | 0 | 13/13 | `296635064f0d...` |
| 5 | `8cdcaf60-da2f-4f4c-b5a4-ef9f09a75658` | 31 | 0 | 0 | 13/13 | `296635064f0d...` |

En las cinco:

- `MON-042/2026`: `OPEN`, 17 afirmaciones, `MONITOR_NEW_NOTICE`.
- `JVB-118/2023`: `CLOSED`, 14 afirmaciones, `NO_ACTION`.
- reclamaciones conservadas como `PARTY_ALLEGATION`;
- plazo de cinco días atribuido a `ADELANTO NORTE SL`, no a `ALICIA DEMO`;
- dos asuntos separados;
- 0 afirmaciones soportadas sin documento, página, fragmento, offsets y hashes válidos;
- página sin texto y adjunto ausente enviados a revisión, sin invención.

La firma contractual completa fue idéntica en las cinco ejecuciones.

## Baseline local frente a Vertex AI

Coinciden en los resultados de producto: 10 entradas, 9 documentos canónicos, 1 duplicado,
12 páginas, 31 afirmaciones, 2 asuntos, estados, acciones, importes críticos, destinatarios y
cobertura de provenance.

Existe una diferencia representacional no crítica en `evidence.missing`: el baseline local
marca esa afirmación como `INSUFFICIENT_EVIDENCE`; Vertex soporta documentalmente el hecho de
que falta el adjunto y añade `MISSING_EVIDENCE`, `needs_human_review=true`. En ambos casos el
contenido ausente se envía a revisión y no se inventa. El tipo local de `procedure.status` se
alineó de `TEXT` a `STATUS` después de identificarlo en la comparación.

## Consumo y coste

Cada ejecución final registró 2.741 tokens de entrada y 4.905 de salida. Total final medido:

- entrada: 13.705 tokens;
- salida: 24.525 tokens;
- total: 38.230 tokens;
- estimación a tarifa estándar no global vigente: **0,1125 USD**.

Incluyendo el diagnóstico corregido hay seis llamadas con metadatos: 45.876 tokens y una
estimación de **0,1350 USD**. La primera llamada diagnóstica se realizó antes de capturar
metadatos; usando el máximo de salida configurado, el techo conservador para las siete llamadas
es inferior a **0,21 USD**. La facturación consolidada puede aparecer con retraso; no se creó
exportación de Billing. Los 444 KB de Storage con lifecycle de un día y sus operaciones son
materialmente menores. Tarifas de referencia:
https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing

## Dependencias y riesgos

- Dependencias directas sin cambios: ADK 2.0.0, GenAI 2.9.0, Storage 7.22.0 y pdfjs 6.2.108.
- Audit actual: 22 vulnerabilidades (20 moderadas, 2 altas, 0 críticas).
- La cifra anterior era 17; el aumento procede de la base de avisos actual, no de nuevas
  dependencias instaladas en esta fase.
- No se ejecutó `npm audit fix --force` ni se cambió ADK.
- Gate antes de publicación: resolver o aceptar explícitamente el árbol vulnerable y comprobar
  que ninguna ruta afectada queda expuesta.
- Riesgo funcional nuevo: el dataset dorado usa etiquetas muy regulares. La siguiente batería
  debe añadir PDFs sintéticos con lenguaje más natural, OCR degradado y variantes de formato.

## Evidencia

- Resumen completo por ejecución: `artifacts/cloud-validation-5-runs.json`.
- Cada run conserva temporalmente sus diez PDFs, `dossier.json` y `run_report.json` en el bucket
  privado, bajo `runs/<run-id>/`.
- La salida ADK registró `backend: VERTEX_AI` y modelo `gemini-3.7-flash`.

## Siguiente hito recomendado

Preparar un despliegue **privado y autenticado** del contenedor existente en un único servicio
Cloud Run, habilitar entonces —y solo entonces— `run.googleapis.com`, ejecutar una prueba de
humo end-to-end contra el servicio y mantener las mismas trece puertas. No se ha iniciado el
deployment ni la submission.
