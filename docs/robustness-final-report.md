# Robustez final antes de demo

**Fecha:** 26 de agosto de 2026  
**Resultado:** PASS  
**Veredicto:** BACKEND MVP CONGELADO  
**Publicación anónima:** no realizada  
**Vídeo/submission:** no iniciados

## Resultado ejecutivo

Expediente Vivo superó un segundo dataset completamente sintético, independiente y menos
uniforme que el dorado. El ground truth se escribió antes de ejecutar Gemini. Tras corregir una
desviación de escalado de Cloud Run, se realizaron tres recorridos consecutivos sobre la revisión
privada definitiva:

- 3/3 recorridos completos PASS;
- 15/15 controles de robustez PASS en cada recorrido;
- 0 errores críticos;
- 100 % de exactitud y precisión de hechos evaluados;
- 100 % de exactitud de alegaciones, cronología y cantidades;
- 100 % de provenance en las 21 afirmaciones soportadas de cada recorrido;
- 0 hechos inesperados y 0 alegaciones inesperadas;
- misma firma contractual en las tres ejecuciones;
- acceso anónimo rechazado con HTTP 403.

El backend no inventó desde evidencia insuficiente ni desde la página degradada. Conservó una
contradicción como no resuelta, mantuvo alegaciones como alegaciones, asignó el plazo a la otra
parte y separó los dos asuntos.

## Composición del segundo dataset

Dataset `robustness-v2`, sujeto sintético `NORA VEGA`:

- 11 PDFs de entrada;
- 10 documentos canónicos y 1 duplicado byte a byte con otro nombre;
- 14 páginas canónicas;
- 2 asuntos independientes: `PZA-731/2025` y `RVB-204/2024`;
- 3 documentos multipágina;
- nombres deliberadamente ambiguos (`scan_0047.pdf`, `recibido.pdf`, `papel_82.pdf`, etc.);
- fechas como `3 de febrero de 2025`, `2025-04-18`, `22 abr. 2025`, `09.10.2024` y
  `11-X-2024`;
- cantidades en texto, formato europeo y formato internacional;
- referencias cruzadas a contrato, factura, anexos y resoluciones;
- dos estados incompatibles del mismo asunto en la misma fecha;
- alegaciones de dos contrapartes que no son deuda reconocida;
- plazo de siete días dirigido exclusivamente a `BRUMA TALLERES SL`;
- un documento sin fecha inequívoca;
- una página degradada con solo 19 caracteres extraíbles y calidad `LOW`;
- dos documentos que mencionan información ausente y no permiten afirmar importe reconocido.

El ground truth está en `fixtures/robustness-v2/ground-truth.json` y declara explícitamente
`authored_before_model_execution: true`. Todos sus fragmentos de evidencia se verificaron contra
la página y los offsets del PDF antes de cualquier llamada al modelo.

## Diferencias respecto al dataset dorado

No se reutilizaron literalmente persona, identificadores de asunto, textos ni importes del
dataset dorado. La segunda colección introduce:

1. redacción narrativa menos regular y documentos con nombres no semánticos;
2. formatos heterogéneos de fecha y dinero;
3. una contradicción real de estado que no admite desempate seguro;
4. referencias a documentos ausentes;
5. un duplicado renombrado;
6. una página con extracción legible solo de forma residual;
7. incertidumbre que debe modificar estado y acción sin inventar una resolución.

## Ground truth y resultado esperado

| Asunto | Evidencia principal | Estado esperado | Acción esperada |
|---|---|---|---|
| `PZA-731/2025` | contrato, reclamación, estados OPEN/CLOSED incompatibles, plazo a contraparte | `UNCERTAIN` | `MONITOR_NEW_NOTICE` |
| `RVB-204/2024` | alegaciones, resolución con 2.300,00 EUR reconocidos y cierre | `CLOSED` | `NO_ACTION` |

La reclamación de 1.490,70 EUR y la de 2.720,00 EUR, incluidos 420,00 EUR de intereses
pretendidos, permanecen como `PARTY_ALLEGATION`. El único importe reconocido evaluado es
2.300,00 EUR y procede de `resuelto.pdf`, página 2.

## Tres ejecuciones definitivas

Servicio privado `expediente-vivo-private`, región `europe-west1`, revisión
`expediente-vivo-private-00003-7cl`, 100 % del tráfico, mínimo 0/máximo 1 instancia,
concurrencia 1, 1 vCPU y 1 GiB.

| # | Run ID | Latencia cliente | Duración en log | Controles | Críticos | Provenance |
|---|---|---:|---:|---:|---:|---:|
| 1 | `a21f3780-6c1d-4c21-a197-48b2afa86c04` | 33,903 s | 33,614 s | 15/15 | 0 | 100 % |
| 2 | `81d805cd-c983-4c3c-9de9-0f8fe28df1fb` | 34,221 s | 33,946 s | 15/15 | 0 | 100 % |
| 3 | `c218f12a-9313-482e-a959-8e42696875a0` | 35,817 s | 35,474 s | 15/15 | 0 | 100 % |

Promedio de cliente: 34,647 s. Cada ejecución consumió 3.653 tokens de entrada y 6.201 de
salida, aceptó 23 afirmaciones, produjo 2 asuntos y guardó 13 objetos privados. La firma
contractual fue idéntica: `01b2d05d2d2254289539dfe1af4db0f63f767e2170582d887a7b13a9c18a2056`.

## Métricas y puertas

| Dimensión | Resultado en las tres ejecuciones |
|---|---:|
| Exactitud de hechos | 100 % |
| Precisión de hechos | 100 % |
| Separación de asuntos | PASS |
| Hecho / alegación / inferencia / incertidumbre / acción | PASS |
| Cronología | 100 % |
| Cantidades | 100 % |
| Estado | PASS |
| Siguiente acción | PASS |
| Destinatarios de plazos | PASS |
| Duplicados | PASS |
| Contradicciones | PASS, `UNRESOLVED` |
| Evidencia insuficiente | PASS, revisión sin invención |
| Página degradada | PASS, 0 afirmaciones desde la página |
| Provenance documento+página+fragmento+offsets+hashes | 100 %, 21/21 referencias por recorrido |

Los 15 controles `R00`–`R14` verifican además stack congelado, composición del dataset,
persistencia GCS y hashes inmutables. El evaluador no confía en la autoevaluación del backend:
recalcula localmente existencia de documento/página, SHA-256 del documento, texto, offsets,
fragmento exacto, hash de página y hash de fragmento.

## Comportamiento con texto degradado

`folio_borroso.pdf` es visualmente una página deliberadamente desvanecida. El extractor obtuvo
19 caracteres (`RVB ? 204 importe ?`) y la marcó `LOW`. Resultado repetido 3/3:

- se generó una necesidad de revisión humana;
- no se emitió ninguna afirmación soportada desde esa página;
- no se intentó reconstruir el importe ausente;
- no se añadió OCR ni dependencia externa.

OCR no es imprescindible para la demo actual. Solo tendría sentido como hito separado si futuros
documentos representativos no alcanzan texto fiable; no debe entrar antes de la demo.

## Errores encontrados y correcciones mínimas

Antes de las ejecuciones finales, el segundo dataset reveló cuatro generalizaciones necesarias,
resueltas sin cambiar contrato ni arquitectura:

1. el prompt dejó de depender de etiquetas exactas del dataset dorado y pasó a extracción
   semántica conservadora;
2. el normalizador monetario admite formas europeas, internacionales y cantidades en texto;
3. dos estados documentales incompatibles generan un conflicto `UNRESOLVED`, estado
   `UNCERTAIN` y acción segura;
4. el sujeto del expediente se parametrizó para no confundir a la persona evaluada con otra
   parte.

No apareció ningún error crítico de modelo en cloud. Sí hubo incidencias operativas:

- `npm ci` local encontró un bloqueo de DLL de una dependencia opcional de Canvas en Windows;
  se reparó el árbol de forma incremental sin cambiar dependencias del producto;
- la revisión inicial mostraba máximo 20 instancias aunque el objetivo era 1. Se detectó al leer
  el campo efectivo de Cloud Run, se corrigió a mínimo 0/máximo 1 y se repitieron las tres
  ejecuciones desde cero sobre la nueva revisión;
- un intento local usó nombres incorrectos de variables de entorno y terminó antes de invocar el
  servicio; no consumió Gemini ni cuenta como ejecución.

## Cloud, privacidad y evidencia real

- acceso anónimo: HTTP 403;
- IAM de invocación: una sola identidad de prueba nominativa (redactada) con `roles/run.invoker`;
- `allUsers`: ausente;
- `allAuthenticatedUsers`: ausente;
- identidad de runtime: `expediente-vivo-runtime@[redacted-project-id].iam.gserviceaccount.com`;
- permisos: `roles/aiplatform.user` en proyecto y `roles/storage.objectCreator` solo en el bucket;
- bucket temporal en `EU`, acceso uniforme, prevención pública `enforced`, borrado a un día;
- Cloud Logging conserva un evento `vertical_slice_completed` por run, con
  `extractor_mode=vertex-adk`, `artifact_store=gcs-private-temporary`, estado `COMPLETED`, 0
  críticos y 0 afirmaciones sin cita;
- la revisión definitiva no registró entradas de severidad ERROR.

Las tres ejecuciones finales escribieron 39 objetos y 211.823 bytes. No se creó ningún servicio,
bucket, cuenta de servicio o repositorio adicional. Se reutilizaron los recursos privados
existentes. La URL gestionada se omite deliberadamente del informe y del repo.

Recursos consumidos en este bloque:

- APIs ya habilitadas y reutilizadas: Vertex AI, Cloud Storage, Cloud Run, Artifact Registry,
  Cloud Build y Logging; no se habilitó ninguna API nueva;
- build `ecdc2eac-39cb-4c61-99cb-30f8c5f349b1`, `SUCCESS`, 46,13 s;
- imagen `robustness-final-20260826-1`, digest
  `sha256:f0e8adca17a1bd4c320d765575f71a58cbc1f3c957ac890c9ae4480823ee9bf9`;
- revisión de código `expediente-vivo-private-00002-xk9` y revisión solo de configuración
  `expediente-vivo-private-00003-7cl`;
- mismo bucket temporal privado (nombre redactado) y mismo
  repositorio Docker `expediente-vivo`.

## Dependencias y advisory alto

`npm audit --omit=dev` final:

- 237 dependencias de producción;
- 21 vulnerabilidades moderadas (recuento actualizado del árbol transitivo; mismos dos advisories
  moderados revisados en el gate público);
- 0 altas;
- 0 críticas;
- no se ejecutó `npm audit fix --force`.

`@google/adk` se mantiene en 2.0.0, la versión estable disponible. ADK declaraba
`adm-zip ^0.5.17`, por lo que se fijó exclusivamente esa transitiva a `adm-zip 0.6.0`, versión
estable que corrige `GHSA-xcpc-8h2w-3j85`. No hubo migración de ADK ni versión mayor del stack.

Ruta vulnerable anterior y alcance:

- paquete: `adm-zip <0.6.0`;
- advisory: `GHSA-xcpc-8h2w-3j85`;
- efecto: un ZIP manipulado podía provocar una asignación de memoria extrema;
- ruta en ADK: `loadSkillFromZipBuffer(zipBuffer)`;
- alcanzabilidad previa: no alcanzable desde Expediente Vivo, que no usa ese cargador ni expone
  ZIP; sus rutas aceptan PDFs y el servicio exige IAM;
- resolución: `adm-zip 0.6.0` mediante `overrides` y lockfile actualizado;
- compatibilidad: prueba real creando un ZIP de skill, cargándolo con el loader de ADK y leyendo
  `SKILL.md`: PASS;
- resultado de audit: el aviso y sus dos nodos altos desaparecieron.

Riesgo residual: las 16 moderadas están en rutas transitivas de OpenTelemetry y del cliente
HTTP/Storage de Google. No bloquean este backend privado, pero requieren triaje final antes de
autorizar exposición anónima. No se forzó una actualización mayor de Storage o ADK por el riesgo
de romper la API cerca del deadline.

## Pruebas locales finales

`npm test`: 19/19 PASS, 0 fallos. Incluye las 13 puertas originales y seis pruebas nuevas para:
forma independiente del dataset, duplicado/degradación, fragmentos de ground truth, dinero
heterogéneo, conflicto determinista y compatibilidad real del ZIP loader de ADK.

## Consumo y coste adicional

Uso de este bloque, incluida la ejecución diagnóstica, una primera terna funcional descartada por
la desviación de escalado y la terna final válida:

- Gemini: 7 llamadas 200, 25.571 tokens de entrada y 43.407 de salida;
- coste Gemini estimado a tarifa no global: **0,20015 USD**;
- Cloud Run: unos 269 s de procesamiento remoto; techo antes de free tier: **<0,006 USD**;
- Cloud Build: una build de 46,13 s; tarifa teórica **0,00461 USD**, normalmente absorbida por
  los 2.500 minutos gratuitos mensuales si siguen disponibles;
- Artifact Registry: una imagen nueva; el total de las dos imágenes sigue por debajo de 0,5
  GiB-mes antes de deduplicación;
- GCS: 91 objetos temporales de este dataset, menos de 0,001 GiB y lifecycle de un día.

Techo estimado antes de free tiers y operaciones mínimas de Storage: **aprox. 0,211 USD**.
El gasto atribuible esperado es aproximadamente el de Gemini; Billing puede tardar en consolidar.

## Desviaciones y riesgos residuales

- Arquitectura, modelo, contrato y criterios: sin desviaciones.
- Infraestructura: hubo una desviación temporal de máximo 20, corregida a 1 antes de las tres
  corridas definitivas.
- OCR: no implementado; la degradación segura está demostrada, pero PDFs escaneados sin capa de
  texto exigirán revisión humana.
- Latencia: promedio 34,647 s para 11 PDFs; adecuada para demo, sin optimización prematura.
- Seguridad: 16 advisories moderados pendientes de triaje antes de publicación anónima.
- Generalización: validada sobre dos datasets sintéticos, no sobre documentos reales; no debe
  presentarse como validación jurídica o productiva.

## Veredicto y parada

**BACKEND MVP CONGELADO.** Se cumplen simultáneamente 3/3 ejecuciones estables, 0 errores
críticos, 100 % de provenance y degradación segura ante evidencia insuficiente y texto pobre.

No deben crearse más datasets ni ampliar el backend salvo que aparezca un fallo real.

## Siguiente hito recomendado

Trabajar exclusivamente en:

1. UX mínima competitiva sobre el servicio actual;
2. guion de demo de cuatro minutos;
3. documentación de arquitectura, seguridad y evidencia;
4. preparación de assets y submission, manteniendo todo privado hasta autorización expresa.
