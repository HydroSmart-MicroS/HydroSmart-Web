# HydroSmart Web · Next.js

App en /app, con acceso REST solo mediante el Gateway. Propietarios e inquilinos, cada uno con plan propio.
Pantallas: resumen, historial/reportes CSV, unidades/asignación, medidores, tarifas editables, alertas/meta,
notificaciones/preferencias, mensualidad/pagos de agua y perfil.

Sin plan vigente se muestra Plan y pagos; el Gateway aplica también el bloqueo 402.
Checkout externo sin claves Stripe en la web. Bandeja con contador y refresco de 10 segundos.
Layout adaptable, etiquetas accesibles y datos generados desde las APIs; no hay un modo de pago ficticio en la app principal.

[Funcionalidad completa](../README.md) · [Pruebas](../docs/verification.md).
