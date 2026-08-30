# Validación privada en Cloud Run

**Fecha:** 25 de agosto de 2026  
**Resultado:** PASS  
**Publicación anónima:** no realizada  
**Submission/vídeo final:** no iniciados

## Resultado ejecutivo

El contenedor actual de Expediente Vivo quedó desplegado como un único servicio Cloud Run
privado y autenticado. El recorrido remoto Cloud Run → ExpedienteAgent/ADK → Gemini 3.7 Flash
en Vertex AI → bucket privado → `dossier.json` pasó las trece puertas adversariales y tres
ejecuciones completas consecutivas conservaron la misma firma contractual.

- 13/13 pruebas remotas PASS.
- 3/3 recorridos finales PASS.
- 0 errores críticos.
- 0 afirmaciones soportadas sin provenance válida.
- 0 alegaciones convertidas en hechos o deuda reconocida.
- 0 plazos asignados al destinatario incorrecto.
- 0 mezclas entre asuntos.
- Duplicado exacto detectado, enlazado y excluido.
- Evidencia insuficiente degradada a revisión, sin invención.
- Acceso anónimo rechazado con HTTP 403 antes de llegar al contenedor.

La URL asignada por Cloud Run se omite deliberadamente de este informe y del repositorio.

## Servicio y configuración

| Campo | Valor |
|---|---|
| Proyecto | `[redacted-project-id]` |
| Servicio | `expediente-vivo-private` |
| Región | `europe-west1` (Bélgica) |
| Revisión | `expediente-vivo-private-00001-lbr` |
| Tráfico | 100 % a una única revisión |
| Facturación | por petición |
| Instancias | mínimo 0 (valor por defecto), máximo 1 |
| Concurrencia | 1 |
| Límite por petición | 300 s |
| Recursos | 1 vCPU, 1 GiB |
| CPU de arranque adicional | desactivada |
| Ingress | `all`, siempre sujeto a IAM |
| Runtime | Node.js 24, proceso no root |

El ingress permite realizar la validación autenticada desde el equipo local sin crear VPC,
proxy persistente ni balanceador. No convierte el servicio en público: Cloud Run aplica IAM
antes de entregar la petición al contenedor.

## Acceso e identidades

La política IAM del servicio contiene una sola vinculación:

- `roles/run.invoker` → one named tester identity (redacted from the repository).

No aparecen `allUsers` ni `allAuthenticatedUsers`.

Identidad de runtime:

- `expediente-vivo-runtime@[redacted-project-id].iam.gserviceaccount.com`;
- `roles/aiplatform.user` en el proyecto;
- `roles/storage.objectCreator` exclusivamente en el bucket temporal.

La persistencia se ajustó para escribir el informe final una sola vez. Así la identidad de
runtime no necesita leer, borrar ni sobrescribir objetos.

Identidad de build:

- `expediente-vivo-build@[redacted-project-id].iam.gserviceaccount.com`;
- `roles/logging.logWriter` en el proyecto;
- `roles/artifactregistry.writer` únicamente en el repositorio Docker;
- `roles/storage.objectViewer` únicamente en el bucket de staging del build.

No se crearon ni copiaron claves. Cloud Run usa identidad de servicio y la validación local usa
la sesión interactiva/ADC fuera del repositorio.

## Prueba de privacidad

| Petición | Resultado | Evidencia |
|---|---:|---|
| Sin cabecera de identidad | HTTP 403 | 436 ms; no llegó a los logs HTTP del contenedor |
| Con identidad válida, `/api/health` | HTTP 200 | stack esperado y almacenamiento privado confirmados |
| IAM del servicio | PASS | un único usuario invocador; ningún principal público |

## Imagen y build reproducible

- Base fijada por digest: `node:24-bookworm-slim@sha256:a9f5f7c...`.
- Dependencias restauradas con `npm ci --omit=dev --ignore-scripts` desde `package-lock.json`.
- Usuario de contenedor: `node`.
- Build de Cloud Build: `3edfc7b3-9511-4750-85f0-ad80b4374f21`, `SUCCESS`.
- Duración: 54,95 s.
- Logs: `CLOUD_LOGGING_ONLY`.
- Imagen: tag `cloud-run-private-20260825-1`.
- Digest: `sha256:383d51ea19d3ed359a3e804d1ac6084628e7c30328269ee7fcf4a19118ae9aa5`.
- Tamaño observado: 168.721.546 bytes.

## APIs y recursos adicionales

Ya estaban activos para el hito anterior: Vertex AI, Cloud Storage y Logging. Monitoring estaba
disponible y se usó solo para comprobar el escalado. Para este hito se habilitaron únicamente:

- `run.googleapis.com`;
- `artifactregistry.googleapis.com`;
- `cloudbuild.googleapis.com`;
- `iam.googleapis.com`.

Recursos creados:

1. un servicio Cloud Run;
2. dos service accounts de mínimo privilegio (runtime y build);
3. un repositorio Docker `expediente-vivo` en `europe-west1` y una imagen;
4. un bucket de staging de build (nombre redactado) en `EU`;
5. una ejecución Cloud Build.

El bucket de datos anterior se reutilizó. Ambos buckets tienen acceso uniforme, prevención de
acceso público `enforced`, soft delete desactivado y lifecycle de borrado a un día. Al cierre:

- datos de runtime: 144 objetos, 781.611 bytes;
- staging de build: 2 objetos, 118.080 bytes.

Los roles legacy de Storage vinculados a Owner/Editor/Viewer del proyecto son concesiones
automáticas preexistentes del proyecto; no se ampliaron y no incluyen identidades públicas. La
identidad de runtime sigue limitada a crear objetos.

## Trece pruebas remotas

| ID | Puerta | Resultado |
|---|---|---|
| T00 | ADK, ExpedienteAgent, Gemini 3.7 Flash, Vertex y GCS congelados | PASS |
| T01/T02 | dos procedimientos separados, un ancla de procedimiento por asunto | PASS |
| T03 | importes contradictorios conservan su rol semántico | PASS |
| T04 | alegaciones nunca promovidas a hechos reconocidos | PASS |
| T05 | plazo de la contraparte no asignado al usuario | PASS |
| T06 | duplicado exacto enlazado y excluido | PASS |
| T07 | documento sin fecha permanece sin fecha | PASS |
| T08 | importe reconocido cita página y fragmento exactos | PASS |
| T09 | provenance manipulada falla; evidencia ausente exige revisión | PASS |
| T10 | acciones seguras reconstruidas para ambos asuntos | PASS |
| T12 | página sin texto no genera afirmaciones | PASS |
| T13 | 100 % de afirmaciones soportadas con provenance completa e inmutable | PASS |
| E2E | Cloud Run persiste dossier e informe completos en GCS privado | PASS |

La validación recalculó localmente existencia del documento y página, SHA-256 del documento,
SHA-256 del texto de página, offsets, fragmento exacto y SHA-256 del fragmento. No se limitó a
aceptar la autoevaluación devuelta por el servicio.

## Tres recorridos finales

| # | Run ID | Latencia cliente | Latencia Cloud Run | Pruebas | Errores críticos | Firma |
|---|---|---:|---:|---:|---:|---|
| 1 | `477b564f-08ab-4f6c-af6a-5dcb14479bdb` | 27,277 s | 26,987 s | 13/13 | 0 | `296635064f0d...` |
| 2 | `8f9691b8-2baa-41d1-af56-bbc750de2f4c` | 29,039 s | 28,883 s | 13/13 | 0 | `296635064f0d...` |
| 3 | `e0981499-c443-41ce-95b6-20ccde2670fb` | 28,510 s | 28,198 s | 13/13 | 0 | `296635064f0d...` |

Promedio: 28,275 s desde el cliente y 28,023 s en Cloud Run. Cada recorrido produjo 31
afirmaciones aceptadas, 0 rechazadas, 2 asuntos y una firma completa idéntica. Cada llamada
registró 2.741 tokens de entrada y 4.905 de salida.

Además hubo una ejecución diagnóstica remota 13/13 y una primera petición cuyo cliente cerró la
conexión, pero que el servicio terminó correctamente. Los logs muestran cinco POST con HTTP 200,
cinco eventos `vertical_slice_completed`, cinco llamadas ADK y ningún retry ni error de servicio.

## Logs y escalado a cero

Evidencia de los tres recorridos finales:

| Run ID | Evento en Cloud Logging | Duración interna |
|---|---|---:|
| `477b564f-...` | `vertical_slice_completed`, `COMPLETED` | 26.981 ms |
| `8f9691b8-...` | `vertical_slice_completed`, `COMPLETED` | 28.879 ms |
| `e0981499-...` | `vertical_slice_completed`, `COMPLETED` | 28.194 ms |

Cloud Monitoring confirmó `active=0` e `idle=0` a las `21:47:48Z`. Después:

- `21:48:15.344Z`: GET autenticado recibido;
- `21:48:15.363Z`: `Starting new instance. Reason: AUTOSCALING`;
- `21:48:17.904Z`: startup probe PASS;
- `21:48:17.905Z`: `server_started`;
- respuesta HTTP 200 en 2,583 s según Cloud Run y 2,972 s extremo a extremo.

La petición de vuelta desde cero fue solo `/api/health`: no produjo una llamada adicional a
Gemini ni escribió objetos.

## Errores encontrados y correcciones

No hubo errores de aplicación ni reintentos del modelo. Sí aparecieron tres incidencias de
herramienta local:

1. El primer cliente basado en `fetch` recibió `ECONNRESET` después de que Cloud Run ya hubiera
   completado y persistido el recorrido con HTTP 200. El evaluador remoto se cambió a la API
   nativa `https`, conexión no reutilizada y cierre explícito; no cambió el producto.
2. El componente local de proxy de Cloud Run no pudo instalarse por una ruta interna incompleta
   del Python incluido en el SDK. Se evitó el proxy y se usó un identity token directo; no se
   añadió infraestructura.
3. Un primer intento de submit usó el nombre abreviado de la service account. No creó build,
   aunque dejó un segundo archivo de staging. Se corrigió usando el nombre de recurso completo.

## Consumo y coste

Uso medido en este hito:

- Gemini: 5 recorridos completados, 13.705 tokens de entrada y 24.525 de salida;
- coste Gemini estimado a tarifa estándar no global: **0,11247 USD**;
- Cloud Run: 159,4412 s de tiempo facturable medido; cálculo sin free tier: **0,00423 USD**;
- Cloud Build: 54,95 s; cálculo sin free tier: **0,00550 USD**;
- Artifact Registry: 168,7 MB, por debajo de los primeros 0,5 GiB-mes gratuitos;
- Storage temporal: menos de 0,001 GB en cada bucket, lifecycle de un día.

Techo calculado del bloque, antes de free tiers y sin redondear operaciones mínimas de Storage:
**aprox. 0,1223 USD**. Cloud Run y Cloud Build caben holgadamente en sus free tiers mensuales si
no estaban consumidos por otras cargas; el gasto esperable atribuible al bloque es por tanto
aproximadamente el de Gemini. Billing aún no muestra un cargo consolidado específico por el
retraso normal de atribución y no se creó un export de facturación.

Referencias usadas: precios vigentes de Gemini 3.7 Flash, Cloud Run, Cloud Build y Artifact
Registry en la documentación oficial de Google Cloud.

## `npm audit` y alcanzabilidad

Audit de producción y audit completo coinciden porque no hay dependencias de desarrollo:

- 237 dependencias de producción;
- 22 nodos vulnerables: 20 moderados, 2 altos, 0 críticos;
- no se ejecutó `npm audit fix --force`;
- no se cambió ADK ni ninguna versión mayor.

Los dos nodos altos no son dos fallos independientes: `@google/adk` hereda el único aviso alto de
`adm-zip`, `GHSA-xcpc-8h2w-3j85`, que puede provocar una asignación de memoria extrema al abrir un
ZIP manipulado.

Análisis de ruta:

- ADK importa `adm-zip` en su cargador de skills;
- la operación vulnerable solo se invoca desde `loadSkillFromZipBuffer(zipBuffer)`;
- Expediente Vivo no usa el cargador de skills ni el registro GCP de skills;
- las únicas rutas de proceso aceptan PDFs, verifican extensión y magic bytes `%PDF-`, y limitan
  el lote a 12 archivos, 20 MiB y 80 páginas;
- el servicio exige IAM antes de llegar al contenedor.

Conclusión para este despliegue privado: la vulnerabilidad alta está presente en la imagen, pero
no es alcanzable con entrada controlada por el cliente a través de las rutas expuestas. Sigue
siendo un gate obligatorio antes de cualquier publicación pública, junto con el triaje de las
20 moderadas.

## Desviaciones y riesgos nuevos

- Desviaciones de arquitectura: ninguna.
- No se cambió producto, contrato, modelo ni criterios.
- La URL existe como endpoint gestionado de Cloud Run, pero no es utilizable sin IAM y no se
  publica aquí.
- La latencia estable ronda 28 s; no se optimizó porque no hay fallo funcional.
- El dataset dorado sigue siendo regular. Antes de una exposición más amplia conviene añadir
  PDFs sintéticos con OCR degradado, redacción natural y formatos variables.
- El árbol vulnerable permanece como gate de publicación.
- La imagen y el repositorio de Artifact Registry deben conservarse mientras el servicio exista;
  los objetos temporales sí se eliminan automáticamente.

## Evidencia local conservada

- `artifacts/cloud-run-validation-3-runs.json`: resultados completos de las tres ejecuciones.
- `artifacts/cloud-run-validation-1-runs.json`: diagnóstico remoto 13/13.
- `artifacts/cloud-run-private-evidence.json`: IAM, logs, escala a cero, consumo y recursos.
- `artifacts/npm-audit-production-summary.json`: snapshot del audit y análisis de alcanzabilidad.

## Siguiente hito recomendado

Mantener el servicio privado y realizar un gate de preparación de demo con un segundo dataset
sintético más natural/degradado, mientras se resuelve o acepta formalmente el riesgo transitivo
de ADK. Solo después conviene autorizar explícitamente publicación, vídeo y submission.
