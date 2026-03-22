# 🚀 Guía de Configuración Inicial (Para Novatos)

Esta guía explica paso a paso cómo dejar funcionando el sistema HHR desde cero en un nuevo entorno.

---

## 1. Copiar el Proyecto (GitHub)

Primero necesitas tener el código en tu computador.

1. Abre tu terminal.
2. Clona el repositorio:
   ```bash
   git clone https://github.com/DanielOpazoD/HHR-ServicioHospitalizados.git
   ```
3. Entra a la carpeta e instala las dependencias:
   ```bash
   cd HHR-ServicioHospitalizados
   ```

---

## 2. Configurar Firebase (El "Cerebro")

Entra a [Firebase Console](https://console.firebase.google.com/) y crea un proyecto.

### Pasos dentro de Firebase:

1. **Autenticación**:
   - Ve a "Authentication" -> "Sign-in method".
   - Habilita **Google** y añade tu dominio (localhost y el futuro link de Netlify).
2. **Firestore (Base de datos)**:
   - Ve a "Firestore Database".
   - Haz clic en **Crear base de datos**.
   - **IMPORTANTE**: Selecciona "Modo Nativo" y una ubicación cercana (ej: `us-central1`).
   - Aplica las reglas desde tu computador luego (ver sección Despliegue).
3. **Storage (Archivos)**:
   - Ve a "Storage" y dale a "Comenzar". Esto creará el "bucket" para fotos y documentos.

---

## 3. Configurar Google Cloud (Permisos Especiales)

Firebase vive dentro de Google Cloud, así que necesitamos configurar un par de cosas ahí.

1. **Habilitar APIs**: Ve a la consola de GCP y habilita estas APIs:
   - **Google Drive API**: Necesaria para que el sistema guarde PDFs en Drive.
   - **Cloud Functions API**: Para que los scripts de servidor funcionen.
2. **Crear Cuenta de Servicio**:
   - Ve a "IAM y administración" -> "Cuentas de servicio".
   - Crea una cuenta llamada `documentos-hhr`.
   - Dale el rol de **Editor**.
   - **Drive**: Ve a tu carpeta de Google Drive, dale a "Compartir" y añade el correo de esta cuenta de servicio con permiso de Editor.
3. **Permisos Públicos (CORS)**:
   - Si usas el sistema desde localhost, ve a Cloud Functions.
   - Selecciona la función `renderClinicalDocumentPdfFromHtml`.
   - En la pestaña "Permisos", agrega `allUsers` con el rol **Cloud Functions Invoker**.

---

## 4. Configurar Netlify (La "Web")

1. Sube tu código a GitHub.
2. En Netlify, elige "New site from Git".
3. **Configuración de Build**:
   - Build Command: `npm run build`
   - Publish directory: `dist`
4. **Variables de Entorno**: Ve a `Site Configuration` -> `Environment Variables` y añade:
   - `VITE_FIREBASE_API_KEY`: Tu API Key de Firebase.
   - `VITE_FIREBASE_PROJECT_ID`: Tu ID de proyecto.
   - `CLINICAL_DRIVE_ROOT_FOLDER_ID`: El ID de la carpeta de Drive donde se guardará todo.
   - `HOSPITAL_ID`: Un identificador (ej: `salvador`).
   - `HOSPITAL_CAPACITY`: Capacidad total del hospital.

---

## 5. Configurar Inteligencia Artificial (Gemini API)

El sistema utiliza IA para ayudar a los médicos a encontrar diagnósticos **CIE-10** de forma inteligente (entiende abreviaciones como "IAM", "NAC" o descripciones clínicas complejas).

1. **Obtener la Llave**: Ve a [Google AI Studio](https://aistudio.google.com/) y crea una **API Key** gratuita.
2. **Configuración**:
   - **Local**: Añade `VITE_LOCAL_GEMINI_API_KEY=tu_llave_aqui` en tu archivo `.env.local`.
   - **Producción (Netlify)**: Añade una variable de entorno llamada `GEMINI_API_KEY` en el panel de Netlify.
3. **Uso**: Una vez configurada, en el buscador de diagnósticos aparecerá una opción de "Búsqueda IA" que permite encontrar códigos rápidamente incluso con lenguaje informal.

---

## 6. Despliegue Final

Desde tu terminal, con el CLI de Firebase instalado:

```bash
# Iniciar sesión
npx firebase login

# Desplegar reglas y funciones
npx firebase deploy --project tu-proyecto-id
```

---

## 7. Desarrollo Local

Para trabajar en tu computador:

1. Crea un archivo llamado `.env.local` en la raíz.
2. Copia el contenido de `.env.example` y rellénalo con tus credenciales de Firebase.
3. Ejecuta:
   ```bash
   npm install
   npm run dev
   ```
   La aplicación abrirá en `http://localhost:3005`.

¡Listo! Con esto el sistema estará 100% operativo. 🥂
