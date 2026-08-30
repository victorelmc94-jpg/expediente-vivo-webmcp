# Informe del primer vertical slice

**Fecha:** 25 de agosto de 2026  
**Estado local:** PASS  
**Estado cloud:** PASS — validación detallada en `cloud-validation-report.md`  

## Recorrido probado

```text
10 PDFs sintéticos
  -> 9 canónicos + 1 duplicado
  -> 12 páginas conservadas
  -> 31 afirmaciones estructuradas
  -> 31 aceptadas + 0 rechazadas
  -> 2 asuntos separados
  -> asunto A OPEN + MONITOR_NEW_NOTICE
  -> asunto B CLOSED + NO_ACTION
  -> dossier.json + run_report.json
  -> vista web legible
```

## Evidencia textual de ejecución

- Ejecución de terminal: `c6b73490-5d4a-4ee8-b746-404d99abaf7c`.
- Ejecución desde interfaz: `a87980b5-25d9-4b73-8860-fb1c71701cd5`.
- Etapas de pipeline: 7/7 PASS.
- Asuntos: 2.
- Errores críticos: 0.
- Citas inválidas: 0.
- Afirmación de 233,00 EUR: documento de sentencia, página 2, fragmento y offsets validados.
- Reclamación de 565,20 EUR: `PARTY_ALLEGATION`, nunca deuda reconocida.
- Plazo de cinco días: destinatario `ADELANTO NORTE SL`; no asignado a `ALICIA DEMO`.

## Pruebas

| Caso | Resultado |
|---|---|
| ADK root agent fijado a Gemini 3.7 Flash | PASS |
| T01/T02 separación de asuntos/referencias | PASS |
| T03 cantidades contradictorias por rol | PASS |
| T04 alegación no promovida a hecho | PASS |
| T05 plazo de contraparte | PASS |
| T06 duplicado exacto | PASS |
| T07 documento sin fecha | PASS |
| T08 página y fragmento exactos | PASS |
| T09 fragmento falsificado/evidencia insuficiente | PASS |
| T10 siguiente acción | PASS |
| T12 página sin texto | PASS |
| T13 cobertura total de provenance | PASS |
| Persistencia y etapas end-to-end | PASS |

**Total:** 13/13 PASS.

## Errores encontrados y correcciones

1. `pdfjs-dist` 6 no expone `destroy()` en el proxy de documento usado. Se corrigió conservando y cerrando el `loadingTask`, que sí es la interfaz soportada.
2. npm intentó escribir su caché fuera del proyecto y el sandbox lo bloqueó. Se redirigió a `.npm-cache/`, ignorada por Git.
3. El audit más reciente informa 22 vulnerabilidades en el árbol transitivo (20 moderadas, 2 altas). No se forzó una corrección incompatible; se documentó el riesgo y las rutas afectadas no se exponen.

## Recursos y gasto

- Proyecto: `[redacted-project-id]`.
- APIs: Vertex AI y Cloud Storage; Cloud Run continúa deshabilitada.
- Recurso: un bucket privado temporal en `EU`, con acceso uniforme, prevención pública y lifecycle de un día.
- Validación final: cinco llamadas Vertex AI, todas 13/13 PASS y con firma contractual idéntica.
- Evidencia y cálculo de coste: `cloud-validation-report.md`.

## Desviación

- Lenguaje: JavaScript/Node 24, autorizado.
- Ejecución local del modelo: extractor determinista de desarrollo para probar el contrato y las puertas. No sustituye el adaptador final ADK/Vertex.
- Componentes de producción: ADK, Gemini 3.7 Flash, Cloud Run y Cloud Storage se mantienen.

## Siguiente bloque exacto

Preparar el despliegue autenticado y no público del mismo contenedor en Cloud Run, añadir una
prueba de humo privada y repetir las puertas críticas contra el servicio. No se ha iniciado ese
bloque.
