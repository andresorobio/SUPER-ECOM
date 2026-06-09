# SUPER AGENT — Capacidades y hoja de ruta

Este documento resume lo que convierte a este módulo en un agente de inteligencia
de e-commerce de nivel superior, separando lo **ya implementado** de lo
**propuesto**. Principio rector: capacidades reales y verificables, **nunca datos
inventados**. Cuando una fuente externa no está configurada, la herramienta lo
declara (`unavailable`) en vez de fabricar.

---

## ✅ Implementado

### Núcleo de análisis
- **Framework de 10 criterios** con scoring binario, veredicto y recálculo en
  servidor (`schemas/product.schema.ts`).
- **Sourcing ODM** automático para ganadores (>7): keywords, filtros, hack de
  3 estrellas, mensajes a proveedor EN/ES, estrategia paso a paso.
- **Anti-alucinación**: el System Prompt prohíbe inventar datos; las tools
  externas degradan con transparencia.

### Herramientas de function-calling (el LLM las llama solo)
| Tool | Qué hace | Requiere |
|------|----------|----------|
| `google_trends_check` | Tendencia de búsqueda real | `SERPAPI_KEY` |
| `alibaba_product_search` | Fabricantes ODM en Alibaba | `ALIBABA_APP_KEY` |
| `amazon_reviews_analyzer` | Quejas de reseñas 3★ | `RAINFOREST_API_KEY` |
| `competitor_ad_spy` | Anuncios activos de la competencia | `META_AD_LIBRARY_TOKEN` |
| `profit_calculator` | Economía unitaria, ROAS/CPA de equilibrio | — (offline) |
| `compliance_risk_check` | Riesgo legal/envío/ads | — (offline) |

### Endpoints
- `POST /api/analyze-product` — análisis JSON (auth, rate limit, caché, validación).
- `POST /api/analyze-stream` — **streaming SSE**: cada tarjeta aparece al instante.
- `POST /api/analyze-image` — **visión**: identifica y puntúa un producto desde una foto/captura.
- `POST /api/generate-marketing` — **kit de marketing**: ángulos, hooks, copy y outline de landing.
- `GET /api/history` — historial de análisis del usuario (requiere DB).
- `GET/POST/DELETE /api/watchlist` — lista de seguimiento (requiere DB).

### Motores offline (sin API key, siempre disponibles)
- **`lib/profit.ts`** — costo landed, margen de contribución, ROAS/CPA de
  equilibrio, precio recomendado, veredicto económico.
- **`compliance_risk_check`** — detecta baterías, IP/marca, claims médicos,
  vape, líquidos, eléctricos: lo que tumba anuncios o complica aduanas.

### MCP (multi-agente)
`evaluate_product`, `generate_supplier_message`, `search_alibaba_keywords`,
`calculate_profit`, `compliance_risk_check`, `generate_marketing_kit` — usables
por un orquestador padre como subagente.

### Frontend
- UI con estados (vacío/loading/error/éxito), historial en localStorage,
  export **PDF / CSV / JSON**, sección de sourcing expandible con copiar.

---

## 🧭 Propuesto (siguiente nivel)

1. **Monitor de tendencias + alertas**: re-escanear la watchlist por cron y
   avisar (email/webhook) cuando un producto entra en fase de despegue.
2. **Comparador de proveedores**: scoring de fábricas (MOQ, rating, respuesta,
   Trade Assurance) y ranking automático.
3. **Generador de creativos visuales**: bridge a un modelo de imagen para mockups
   de anuncio y packaging ODM.
4. **Calculadora de envío real**: integración con couriers (peso volumétrico,
   destino, aranceles) para landed cost exacto.
5. **Embeddings + deduplicación semántica**: detectar productos equivalentes y
   reusar análisis; búsqueda semántica del historial.
6. **Panel de analítica**: tasa de ganadores, distribución de scores, categorías
   más rentables por usuario.
7. **Webhooks/Zapier + API keys** para integraciones externas y planes.
8. **Multi-idioma de salida** y multi-mercado (US/MX/CO/ES) por defecto.
9. **A/B testing de ángulos** con seguimiento de resultados reales de campañas.
10. **Modo equipo**: roles, comentarios y aprobación de productos antes de invertir.

> Cada propuesta sigue la misma regla: si necesita datos externos, se integra una
> API real; si no hay clave, se degrada con transparencia. Cero mock data.
