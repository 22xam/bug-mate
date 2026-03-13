 
 
 
 
 
SISTEMA MEDILAB
Manual de Usuario
 
 
Versión actualizada – Marzo 2026
 
 
 
 
 
 
 
 
Última actualización: 9 de marzo de 2026

Índice
1. ¿Qué es el Sistema Medilab?
2. Funcionalidades Principales
   2.1 Gestión de Correos
   2.2 Gestión de Asignaciones
   2.3 Órdenes de Trabajo
   2.4 Gestión de Empresas
   2.5 Notificaciones
   2.6 Configuraciones
   2.7 Reportes
   2.8 Calendario
   2.9 Prestadores
3. Guía de Uso de la Interfaz
4. Flujo Completo del Sistema
5. Información Importante
 
1. ¿Qué es el Sistema Medilab?
El Sistema Medilab es una plataforma diseñada para automatizar y gestionar todo el proceso de coordinación de exámenes médicos laborales.
El sistema recibe emails de las ARTs, los procesa automáticamente, crea asignaciones de trabajo y envía las coordinaciones correspondientes a las empresas, permitiendo un seguimiento claro y ordenado de todo el proceso.
 
¿Qué hace el sistema automáticamente?
• Recibe emails de las ARTs con solicitudes de exámenes médicos
• Lee archivos adjuntos con datos de los beneficiarios
• Crea asignaciones de trabajo por empresa
• Envía emails a las empresas con la información necesaria
• Vincula emails, asignaciones y órdenes
• Organiza todo para facilitar el seguimiento y la gestión
 
2. Funcionalidades Principales
2.1 Gestión de Correos
Correos ART (Recibidos)
¿Qué puede hacer?
• Ver todos los emails recibidos de las ARTs (solo registra emails considerados primer contacto de asignación de la ART)
• Marcar emails como leídos / no leídos
• Visualizar archivos adjuntos (con beneficiarios)
• En el caso de emails con asunto revaluación o reconfirmatorio, se registra todo el proceso automáticamente al usuario revaluaciones@medilabsrl.com.ar
• Ver qué emails ya fueron procesados y cuáles están pendientes
• El sistema evita crear duplicados en el caso de que un mismo email haya llegado a varios gestores
• El sistema gestiona y envía en función a la zona geográfica asignada de cada gestor según la información proporcionada por el equipo de gestores. Si la ciudad procesada no está vinculada a ningún gestor, el sistema registra en el primer gestor que haya recibido el email
• Filtrado de correos
• Botón de acceso rápido a email enviado/fallido y a la asignación creada a partir del email recibido
• El sistema procesa casos donde en un Excel se encuentren todos los datos de la empresa en la primera solapa
 
El sistema guarda el archivo principal enviado por la ART para poder descargar en caso que sea necesario.
 
El sistema interpreta un email como primer contacto si en el asunto incluye texto como:
• Derivación de prestadores
• Exámenes periódicos
• Revaluación
• Reconfirmatorio
• No incluye “re”, “fwd” o formato de respuesta de emails
El sistema revisa con IA de ChatGPT los primeros contactos para mejor exactitud.
Los usuarios administradores pueden ver todos los usuarios, permitiendo filtrar por usuario.
 
¿Cómo funciona?
• El sistema revisa automáticamente la casilla de correo de cada usuario vinculado con su correspondiente proveedor (Hostinger, Gmail u Outlook) cada 10 minutos
• Detecta nuevos emails provenientes de ARTs
• Procesa automáticamente los archivos adjuntos
• Crea las asignaciones correspondientes
• Envía los emails de coordinación a las empresas y registra los emails enviados dentro del sistema
 
Correos Enviados
¿Qué puede hacer?
• Ver todos los emails enviados a las empresas
• Ver si el envío fue exitoso o falló
• Ver qué asignaciones se crearon desde cada email
• Agregar notas internas
• Editar y reenviar emails (edición completa como un editor de email)
• El sistema guarda el archivo enviado a la empresa en caso de que sea necesario descargar
• Navegar directamente a las asignaciones asociadas
• Si un email enviado falló, se revisa en la próxima iteración del sistema y se notificará al usuario mediante notificación, actualizando el estado tanto en el sistema como en la casilla de enviados de Hostinger
• El sistema envía los emails a los gestores también como copia
 
Información visible en cada email enviado:
• Empresa destinataria
• Asunto
• Fecha y hora de envío
• Estado (exitoso / fallido)
• Archivos adjuntos enviados
• Asignaciones creadas: ID de asignación, empresa y botón para ver el detalle
 
2.2 Gestión de Asignaciones
¿Qué puede hacer?
• Ver todas las asignaciones en una tabla organizada
• Filtrar por: empresa, provincia, ciudad, estado, ART, número de contrato, tipo (Periódico / Revaluación), usuario asignado (solo administradores), mes y año
• Ver el detalle completo de cada asignación: datos de la empresa, lista de beneficiarios, exámenes requeridos por beneficiario, totales de exámenes por tipo, fechas límite y email que originó la asignación
• Crear órdenes de trabajo desde asignaciones
• Editar asignaciones manualmente
• Crear asignaciones manuales
• Marcar asignaciones como leídas / no leídas
• Los gestores pueden ver sus asignaciones entre sí
• Si una asignación tiene exámenes duplicados en un mismo beneficiario, el sistema filtra y solo registra una vez
• Eliminar asignaciones
• Cargar archivos en la carga manual de asignaciones, extrayendo todos sus totales de exámenes, beneficiarios, etc., utilizando IA como auxiliar
 
Edición de estado de beneficiarios:
• Vacaciones
• Baja (al dejarlo en estado “baja” los totales se actualizan)
• Licencia
• Activo
• Eliminar beneficiarios y actualizar totales automáticamente
 
Categorías de exámenes:
• Exámenes clínicos
• Prácticas clínicas
• Oftalmología
• Espirometría
• Laboratorios
• Rayos
 
Historial de asignaciones  [NUEVO]
Se implementó toda la lógica de historial de asignaciones. Esto permite que cuando una asignación se cierre con beneficiarios incompletos, quede registrada como “realizada incompleta” y además se genere un historial para su seguimiento dentro de la asignación.
 
• Detalle de estudios pendientes dentro de una asignación  [NUEVO]
• Posibilidad de imprimir un reporte de una asignación en PDF como resumen de presentación  [NUEVO]
 
Estados de las asignaciones:
• Pendiente: recién creada, esperando acción
• Asignado a Orden: ya forma parte de una orden de trabajo
• Completado: todos los exámenes fueron realizados
• Realizada incompleta: cerrada con beneficiarios pendientes, genera historial de seguimiento  [NUEVO]
 
Correcciones en asignaciones  [NUEVO]
• Se corrigió el problema de paginación: al cambiar los filtros ahora vuelve automáticamente a la página 1  [NUEVO]
• Se corrigió el error al asignar una asignación a una orden  [NUEVO]
 
2.3 Órdenes de Trabajo
¿Qué puede hacer?
• Crear órdenes seleccionando asignaciones
• Ver todas las órdenes creadas
• Filtrar por estado, fecha o empresa
• Imprimir órdenes
• Marcar órdenes como completadas
• Editar orden
• Vincular o desvincular asignaciones
• Abrir/cerrar órdenes
• Discriminar detalles de laboratorios, exámenes clínicos y cuestionarios
• Seleccionar prestadores predefinidos a una orden para cargarle prácticas específicas (estas prácticas calculan automáticamente totales finales)
• Seleccionar múltiples beneficiarios para marcarlos como pendientes o realizados
• Marcar todos los exámenes de un beneficiario como finalizados con un botón
• Marcar como completada toda una asignación con un botón
 
Carga financiera en órdenes:
• Cobros ART
• Pagos profesionales
• Gastos varios
• Gastos de viaje
 
Nuevas mejoras en órdenes  [NUEVO]
• Las órdenes ahora incluyen: Total original, Total real y Total realizado  [NUEVO]
• Al marcar beneficiarios ausentes, se actualizan automáticamente los totales reales  [NUEVO]
• Se mejoró la interfaz de edición de órdenes para facilitar su uso  [NUEVO]
• Ahora es posible vincular órdenes con asignaciones en estado “Realizada pero incompleta”  [NUEVO]
• Al cambiar el estado de asignaciones dentro de una orden, se muestra una pantalla de carga para evitar confusiones  [NUEVO]
 
2.4 Gestión de Empresas
¿Qué puede hacer?
• Ver el listado completo de empresas
• Buscar empresas por nombre
• Ver el historial de asignaciones de cada empresa
• Agregar nuevas empresas manualmente
• Editar información existente
• Carga masiva de empresas a través de archivo Excel
• Filtrado completo de empresas
 
2.5 Notificaciones
Tipos de notificaciones:
• Nuevos emails recibidos de ARTs
• Emails enviados exitosamente
• Errores en el envío de emails
• Asignaciones próximas a vencer
• Órdenes de trabajo creadas
 
Acciones disponibles:
• Ver todas las notificaciones
• Marcar como leídas
• Filtrar por tipo
• Ver contador de notificaciones sin leer
 
2.6 Configuraciones
¿Qué puedes configurar?
• Datos de tu cuenta
• Preferencias de notificaciones
• Configuración de correo electrónico
• Gestión de usuarios (administradores)
 
2.7 Reportes
En la sección Dashboard cada usuario gestor verá sus métricas principales de cierre de asignaciones.
En la sección Reportes, los administradores verán métricas de desempeño de los gestores como también métricas de gastos e ingresos según órdenes.
 
Pestaña Desempeño  [NUEVO]
• Detalles de las asignaciones al aplicar filtros  [NUEVO]
• Opción para descargar el reporte en Excel  [NUEVO]
• Métrica de cumplimiento de plazos en días promedio  [NUEVO]
• Porcentaje de cumplimiento de plazos  [NUEVO]
• Porcentaje de cierre de beneficiarios  [NUEVO]
• Métricas por empresa  [NUEVO]
• Tabla de desempeño por gestor con sus métricas correspondientes  [NUEVO]
• Tabla de asignaciones con semáforo de estado según plazo  [NUEVO]
 
Pestaña Gastos  [NUEVO]
• Métrica de costo promedio  [NUEVO]
• Métrica de gasto diario  [NUEVO]
• Categoría con mayor gasto  [NUEVO]
• Día con mayor gasto  [NUEVO]
• Empresa con mayor gasto  [NUEVO]
• Ciudad con mayor gasto  [NUEVO]
• Opción para exportar los gastos a Excel  [NUEVO]
 
Pestaña Órdenes
En la pestaña “Órdenes” se encuentran todas las métricas referidas a órdenes y sus datos correspondientes.
• Se puede descargar Excel con los datos que se requieran de la pestaña órdenes
 
Correcciones en pestaña Órdenes:
• Se corrigió el error donde los exámenes realizados aparecían en 0 en el Excel  [NUEVO]
• Se centralizaron los gastos en una sola columna dentro del Excel  [NUEVO]
• Corrección de la columna “Margen”  [NUEVO]
• Nueva columna “Diferencia (gastos - ingresos)”  [NUEVO]
 
2.8 Calendario
¿Qué puede hacer?
• Representación visual de las órdenes de trabajo realizadas, en proceso y a realizar
• Se pueden visualizar con distintos colores las distintas órdenes
• Se puede ver el detalle de una orden al presionar en la misma
• Se ve de manera gráfica los días que ocupa una orden
 
2.9 Prestadores
¿Qué puede hacer?
• Se pueden guardar prestadores como hoteles, consultorios o profesionales
• Los profesionales pueden tener múltiples listas de precios que se pueden utilizar para generar los pagos de profesionales
 
3. Guía de Uso de la Interfaz
Navegación Principal
Menú lateral disponible al iniciar sesión:
• Dashboard – Vista general
• Correos ART – Emails recibidos
• Correos enviados – Emails enviados
• Asignaciones – Tareas de trabajo
• Revaluaciones – Asignaciones de revaluación
• Órdenes de trabajo – Órdenes creadas
• Empresas – Empresas registradas
• Notificaciones – Alertas
• Configuraciones – Ajustes
 
Cómo ver un Email Recibido
• Ir a Correos ART
• Seleccionar un email
• Ver detalles: remitente, asunto, contenido, adjuntos, emails generados y estado de procesamiento
 
Cómo ver Asignaciones creadas desde un Email
• Abrir un email enviado
• Ir a Asignaciones creadas
• Ver: ID, empresa, botón “Ver” para acceder al detalle completo
 
Cómo filtrar Asignaciones
• Ir a Asignaciones
• Usar filtros superiores: empresa, provincia, ciudad, estado, ART, contrato, usuario (admin)
• Click en Buscar
• Los filtros activos se muestran como etiquetas
• Quitar filtros con la X
 
Cómo crear una Orden de Trabajo
• Seleccionar asignaciones
• Click en Crear Orden
• Revisar datos
• Confirmar
• Las asignaciones pasan a “Asignado a Orden”
 
4. Flujo Completo del Sistema
Proceso Automático
El flujo del sistema sigue estos pasos:
• 1. La ART envía email con archivo
• 2. El sistema detecta el email
• 3. Lee el archivo adjunto
• 4. Valida primer contacto de manera manual; si el sistema da el permiso, luego valida ChatGPT
• 5. Crea asignaciones
• 6. Envía emails a empresas
• 7. Vincula emails y asignaciones
• 8. Notifica al usuario
 
Nota: El botón de envío automático se encuentra temporalmente deshabilitado hasta finalizar las pruebas.
 
5. Información Importante
Distribución Automática
Las asignaciones se distribuyen automáticamente según la ciudad:
• Sebastián: art@medilabsrl.com.ar
• Karen: examenesmedicosperiodicos.art@medilabsrl.com.ar
Si la ciudad no está definida, se asigna al gestor del email original.
 
Fechas Clave
• Primer contacto: 5 días hábiles desde la recepción
• Finalización: 90 días desde la recepción
 
Tipos de exámenes que procesa el sistema
• Examen Clínico
• Laboratorio
• Radiografía de Tórax
• Audiometría
• Espirometría
• Electrocardiograma
• Psicofísico
• Altura
• Aparato Respiratorio
 
Permisos de usuarios
El sistema cuenta con distintos niveles de permisos. Se revisó el funcionamiento del usuario médico: este solo puede ver asignaciones, según los permisos actuales configurados.
 
Registro de Cambios – 9 Marzo 2026
A continuación se resumen los cambios implementados en esta actualización:
 
Nuevas funcionalidades
• Reportes – Pestaña Desempeño: detalles al filtrar, descarga Excel, métricas de plazos, cierre de beneficiarios, métricas por empresa, tabla de desempeño por gestor, semáforo de estado
• Reportes – Pestaña Gastos: costo promedio, gasto diario, categoría/día/empresa/ciudad con mayor gasto, exportar a Excel
• Historial de asignaciones con seguimiento de cierres incompletos
• Totales en órdenes: Total original, Total real, Total realizado
• Actualización automática de totales reales al marcar beneficiarios ausentes
• Impresión de reporte de asignación en PDF
• Detalle de estudios pendientes en asignaciones
• Vinculación de órdenes con asignaciones en estado “Realizada pero incompleta”
 
Correcciones
• Paginación en asignaciones: ahora vuelve a página 1 al cambiar filtros
• Exámenes realizados ya no aparecen en 0 en el Excel de órdenes
• Gastos centralizados en una sola columna en el Excel
• Corrección de columna “Margen” y nueva columna “Diferencia”
• Mejora en interfaz de edición de órdenes
• Pantalla de carga al cambiar estado de asignaciones dentro de una orden
• Corrección al asignar asignación a una orden
• Botón de envío automático deshabilitado temporalmente durante pruebas


