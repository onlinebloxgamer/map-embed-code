import type { Locale } from "./config";

export type GuideKey = "multipleLocations" | "wordpress" | "shopify";
export type TranslatedLocale = Exclude<Locale, "en">;

export const guidePaths: Record<GuideKey, string> = {
    multipleLocations: "/guides/embed-google-map-multiple-locations/",
    wordpress: "/guides/embed-google-maps-wordpress/",
    shopify: "/guides/embed-google-maps-shopify/",
};

export interface GuideSection {
    id: string;
    title: string;
    kicker?: string;
    paragraphs?: string[];
    ordered?: string[];
    bullets?: string[];
    callout?: string;
    image?: string;
    imageAlt?: string;
    caption?: string;
    video?: {
        src: string;
        title: string;
        link: string;
        label: string;
    };
}

export interface LocalizedGuide {
    seoTitle: string;
    description: string;
    platform: string;
    title: string;
    lead: string;
    intro: string;
    updated: string;
    readTime: string;
    breadcrumb: string;
    contents: string;
    quickAnswerTitle: string;
    quickAnswer: string;
    sections: GuideSection[];
    faqTitle: string;
    faqs: Array<[string, string]>;
    sourcesTitle?: string;
    sources?: Array<[string, string]>;
    ctaTitle: string;
    ctaText: string;
    ctaButton: string;
}

export const guidesIndexContent: Record<TranslatedLocale, {
    seoTitle: string;
    description: string;
    eyebrow: string;
    title: string;
    intro: string;
    aria: string;
    read: string;
    cards: Array<{ key: GuideKey; platform: string; title: string; description: string }>;
}> = {
    es: {
        seoTitle: "Guías para insertar Google Maps – Map Embed Code",
        description: "Guías paso a paso para insertar Google Maps en WordPress, Shopify y cualquier web. Crea mapas responsive y mapas con varias ubicaciones sin clave API.",
        eyebrow: "Guías",
        title: "Guías para insertar Google Maps",
        intro: "Instrucciones prácticas para añadir Google Maps a tu sitio web gratis, con diseño responsive y sin configurar una clave API.",
        aria: "Guías para insertar Google Maps",
        read: "Leer guía →",
        cards: [
            { key: "multipleLocations", platform: "Varias ubicaciones", title: "Cómo insertar un mapa de Google con varias ubicaciones", description: "Crea un mapa personalizado en Google My Maps con varios marcadores y añádelo a tu web mediante un iframe responsive." },
            { key: "wordpress", platform: "WordPress", title: "Cómo insertar Google Maps en WordPress", description: "Añade un mapa a una página, entrada, barra lateral o pie de WordPress con Gutenberg o el editor clásico." },
            { key: "shopify", platform: "Shopify", title: "Cómo insertar Google Maps en Shopify", description: "Muestra la ubicación de tu tienda en una página, producto o sección del tema de Shopify, sin usar una aplicación." },
        ],
    },
    de: {
        seoTitle: "Anleitungen zum Einbetten von Google Maps – Map Embed Code",
        description: "Schritt-für-Schritt-Anleitungen zum Einbetten von Google Maps in WordPress, Shopify und Websites. Responsive Karten und mehrere Standorte ohne API-Schlüssel.",
        eyebrow: "Anleitungen",
        title: "Google Maps in Websites einbetten",
        intro: "Praktische Anleitungen, mit denen du Google Maps kostenlos, responsiv und ohne eigenen API-Schlüssel in deine Website einfügst.",
        aria: "Anleitungen zum Einbetten von Google Maps",
        read: "Anleitung lesen →",
        cards: [
            { key: "multipleLocations", platform: "Mehrere Standorte", title: "Google Maps mit mehreren Standorten einbetten", description: "Erstelle in Google My Maps eine Karte mit mehreren Markierungen und bette sie responsiv in deine Website ein." },
            { key: "wordpress", platform: "WordPress", title: "Google Maps in WordPress einbetten", description: "Füge eine Karte mit Gutenberg oder dem klassischen Editor in eine WordPress-Seite, einen Beitrag oder Widget-Bereich ein." },
            { key: "shopify", platform: "Shopify", title: "Google Maps in Shopify einbetten", description: "Zeige deinen Laden auf einer Seite, Produktseite oder in einem Theme-Abschnitt von Shopify – ganz ohne App." },
        ],
    },
};

export const localizedGuides: Record<TranslatedLocale, Record<GuideKey, LocalizedGuide>> = {
    es: {
        wordpress: {
            seoTitle: "Cómo insertar Google Maps en WordPress – Guía gratis",
            description: "Aprende a insertar Google Maps en WordPress sin plugin ni clave API. Instrucciones para Gutenberg, el editor clásico, widgets y mapas responsive.",
            platform: "WordPress",
            title: "Cómo insertar Google Maps en WordPress",
            lead: "Añade un mapa interactivo de Google a cualquier página, entrada, barra lateral o pie de WordPress sin instalar un plugin ni crear una clave API.",
            intro: "La forma más sencilla de mostrar una ubicación en WordPress es pegar un iframe de Google Maps en un bloque HTML personalizado. El mapa conserva el zoom y el tipo de vista elegidos y, con un contenedor responsive, se adapta tanto a móviles como a pantallas grandes.",
            updated: "Actualizado el 20 de octubre de 2026",
            readTime: "6 min de lectura",
            breadcrumb: "Guías",
            contents: "Contenido",
            quickAnswerTitle: "Respuesta rápida",
            quickAnswer: "Genera el mapa en <a href=\"/es/#generator\">nuestra herramienta</a>, elige ancho completo y conserva el modo responsive. En WordPress añade un bloque <strong>HTML personalizado</strong>, pega el código iframe, revisa la vista previa y publica la página.",
            sections: [
                {
                    id: "generar-codigo",
                    kicker: "Paso 1",
                    title: "Genera el código para insertar Google Maps",
                    paragraphs: ["Primero crea el iframe con la ubicación y el aspecto que quieres mostrar. No necesitas un plugin de WordPress para esta parte."],
                    ordered: [
                        "Abre el <a href=\"/es/#generator\">generador de código de Google Maps</a>.",
                        "Escribe la dirección completa, el nombre del negocio o las coordenadas exactas.",
                        "Ajusta el zoom y elige entre mapa de carreteras o vista por satélite.",
                        "Selecciona <strong>Ancho completo (100 %)</strong> y deja activada la opción responsive.",
                        "Pulsa <strong>Generar código</strong> y copia el HTML del iframe.",
                    ],
                    callout: "Usa un título de iframe descriptivo, como «Mapa de nuestra tienda en Barcelona», para que el contenido sea comprensible para lectores de pantalla.",
                },
                {
                    id: "editor-bloques",
                    kicker: "Paso 2",
                    title: "Inserta el mapa con el editor de bloques de WordPress",
                    paragraphs: ["Gutenberg es el editor predeterminado de WordPress. El bloque HTML personalizado permite pegar el iframe sin que el editor lo convierta en texto."],
                    ordered: [
                        "Abre la página o entrada donde quieras mostrar el mapa.",
                        "Pulsa el botón <strong>+</strong> para añadir un bloque.",
                        "Busca <strong>HTML personalizado</strong> y selecciona el bloque.",
                        "Pega el código generado dentro del bloque.",
                        "Selecciona <strong>Vista previa</strong> para comprobar el mapa.",
                        "Pulsa <strong>Publicar</strong> o <strong>Actualizar</strong>.",
                    ],
                    callout: "Si el tema limita el ancho del mapa, coloca el bloque HTML fuera de columnas estrechas o grupos con una anchura fija.",
                },
                {
                    id: "editor-clasico",
                    kicker: "Paso 3",
                    title: "Inserta Google Maps con el editor clásico",
                    paragraphs: ["Si utilizas el plugin Classic Editor o una instalación antigua, debes pegar el iframe en la vista de código."],
                    ordered: [
                        "Abre la página o entrada correspondiente.",
                        "Selecciona la pestaña <strong>Texto</strong>, no la pestaña Visual.",
                        "Pega el iframe en el lugar donde debe aparecer el mapa.",
                        "Vuelve a la pestaña Visual para revisar la posición.",
                        "Guarda los cambios con <strong>Actualizar</strong>.",
                    ],
                    callout: "No pegues el iframe en modo Visual: WordPress puede codificar o eliminar parte del HTML.",
                },
                {
                    id: "widgets",
                    title: "Añade un mapa a una barra lateral o al pie de página",
                    paragraphs: ["Los temas que permiten editar widgets también pueden mostrar un mapa en la barra lateral o el footer. Comprueba primero que haya suficiente espacio, especialmente en móvil."],
                    ordered: [
                        "Ve a <strong>Apariencia → Widgets</strong> en el escritorio de WordPress.",
                        "Abre la zona de widgets de la barra lateral o del pie.",
                        "Añade un widget o bloque <strong>HTML personalizado</strong>.",
                        "Pega el iframe, guarda y revisa la página publicada.",
                    ],
                },
                {
                    id: "solucion-problemas",
                    title: "Consejos y solución de problemas",
                    bullets: [
                        "<strong>El mapa no aparece:</strong> comprueba si un plugin de seguridad está eliminando etiquetas iframe. Autoriza únicamente el dominio de Google Maps si el plugin ofrece esa opción.",
                        "<strong>El mapa se sale de la pantalla:</strong> vuelve a generar el código con ancho del 100 % y modo responsive.",
                        "<strong>La ubicación es incorrecta:</strong> escribe una dirección más completa o utiliza latitud y longitud.",
                        "<strong>La página carga lentamente:</strong> conserva <code>loading=\"lazy\"</code> para que el mapa se cargue al acercarse a la zona visible.",
                        "<strong>El bloque desaparece:</strong> verifica que tu cuenta tenga permiso para publicar HTML sin filtrar; WordPress Multisite puede limitarlo.",
                    ],
                },
            ],
            faqTitle: "Preguntas frecuentes sobre Google Maps y WordPress",
            faqs: [
                ["¿Necesito un plugin para insertar Google Maps?", "No. Un bloque HTML personalizado puede mostrar directamente el iframe generado."],
                ["¿Hace falta una clave API de Google Maps?", "No para este método de iframe. Una integración personalizada con la API de JavaScript sí puede necesitar una clave y facturación."],
                ["¿El mapa funciona en móviles?", "Sí. Usa ancho completo y mantén activado el contenedor responsive."],
                ["¿Puedo mostrar varias sucursales?", "Sí. Crea los marcadores en Google My Maps y utiliza nuestra guía de mapas con varias ubicaciones."],
            ],
            ctaTitle: "Crea tu mapa para WordPress",
            ctaText: "Configura la ubicación, el tamaño y el zoom, y copia un iframe responsive en segundos.",
            ctaButton: "Abrir el generador",
        },
        shopify: {
            seoTitle: "Cómo insertar Google Maps en Shopify – Guía gratis",
            description: "Aprende a insertar Google Maps en Shopify sin aplicación ni clave API. Añade un mapa responsive a páginas, productos y secciones del tema.",
            platform: "Shopify",
            title: "Cómo insertar Google Maps en Shopify",
            lead: "Añade un mapa interactivo a la página de contacto, productos o secciones de tu tienda Shopify sin instalar una aplicación ni configurar una clave API.",
            intro: "Shopify permite pegar un iframe en campos y secciones que aceptan HTML o Liquid personalizado. El método adecuado depende del tema, pero el mismo código responsive puede utilizarse en una página, una plantilla o una descripción de producto.",
            updated: "Actualizado el 20 de octubre de 2026",
            readTime: "6 min de lectura",
            breadcrumb: "Guías",
            contents: "Contenido",
            quickAnswerTitle: "Respuesta rápida",
            quickAnswer: "Crea el iframe en <a href=\"/es/#generator\">nuestro generador</a>. En el administrador de Shopify abre la página deseada, cambia a la vista HTML con el botón <strong>&lt;&gt;</strong>, pega el código y guarda. Para secciones del tema, usa HTML o Liquid personalizado.",
            sections: [
                {
                    id: "generar-codigo",
                    kicker: "Paso 1",
                    title: "Genera el código de Google Maps para Shopify",
                    ordered: [
                        "Abre el <a href=\"/es/#generator\">generador de mapas</a>.",
                        "Busca la dirección de la tienda o introduce sus coordenadas.",
                        "Elige el zoom y el tipo de mapa.",
                        "Selecciona <strong>Ancho completo (100 %)</strong> y mantén el modo responsive.",
                        "Pulsa <strong>Generar código</strong> y copia el iframe.",
                    ],
                },
                {
                    id: "pagina-shopify",
                    kicker: "Paso 2",
                    title: "Añade el mapa a una página de Shopify",
                    paragraphs: ["Este método resulta adecuado para una página de contacto, información de la tienda, recogida local o cómo llegar."],
                    ordered: [
                        "En Shopify Admin ve a <strong>Tienda online → Páginas</strong>.",
                        "Abre o crea la página donde aparecerá el mapa.",
                        "En el editor selecciona el botón <strong>&lt;&gt;</strong> para mostrar el HTML.",
                        "Pega el iframe en la posición deseada.",
                        "Guarda y visita la página pública para comprobar el resultado.",
                    ],
                    callout: "Cambia a la vista HTML antes de pegar el código. Si lo insertas como texto enriquecido, Shopify puede mostrarlo como texto o eliminar la etiqueta iframe.",
                },
                {
                    id: "editor-tema",
                    kicker: "Paso 3",
                    title: "Inserta el mapa desde el editor del tema",
                    paragraphs: ["Los nombres de las secciones cambian según el tema. Muchos temas modernos incluyen una sección de Liquid personalizado que admite el iframe completo."],
                    ordered: [
                        "Ve a <strong>Tienda online → Temas</strong> y pulsa <strong>Personalizar</strong>.",
                        "Abre la plantilla de inicio, contacto o la página correspondiente.",
                        "Selecciona <strong>Añadir sección</strong> y busca <strong>Liquid personalizado</strong>, HTML, código o contenido personalizado.",
                        "Pega el iframe y revisa la vista previa para ordenador y móvil.",
                        "Pulsa <strong>Guardar</strong>.",
                    ],
                    callout: "Si tu tema no ofrece una sección compatible, utiliza el método de página HTML o pide al desarrollador del tema una sección Liquid específica.",
                },
                {
                    id: "pagina-producto",
                    title: "Muestra un mapa en una página de producto",
                    paragraphs: ["Un mapa en la ficha de producto puede ser útil para recogidas físicas, entradas de eventos, alojamientos o servicios que se prestan en un lugar concreto."],
                    ordered: [
                        "Abre <strong>Productos</strong> en Shopify Admin.",
                        "Selecciona el producto que quieres modificar.",
                        "Abre la vista HTML de la descripción con <strong>&lt;&gt;</strong>.",
                        "Pega el iframe, guarda y comprueba la ficha publicada.",
                    ],
                },
                {
                    id: "solucion-problemas",
                    title: "Consejos y solución de problemas",
                    bullets: [
                        "<strong>El mapa no aparece:</strong> revisa la página pública; algunos editores no renderizan iframes dentro de su vista previa.",
                        "<strong>El tema elimina el iframe:</strong> utiliza una sección de Liquid personalizado en lugar de texto enriquecido.",
                        "<strong>El mapa es demasiado ancho:</strong> activa el modo responsive y evita valores fijos mayores que el contenedor del tema.",
                        "<strong>Zoom recomendado:</strong> para una sola tienda suele funcionar bien un nivel entre 14 y 16.",
                        "<strong>Dirección ambigua:</strong> utiliza coordenadas exactas para colocar el marcador correctamente.",
                    ],
                },
            ],
            faqTitle: "Preguntas frecuentes sobre Google Maps y Shopify",
            faqs: [
                ["¿Necesito una aplicación de Shopify?", "No. Puedes insertar el iframe en una página o sección que acepte HTML o Liquid personalizado."],
                ["¿Necesito una clave API?", "No para el iframe generado con este método."],
                ["¿El mapa afecta al rendimiento?", "El mapa carga recursos externos, pero la carga diferida reduce su impacto inicial."],
                ["¿Puedo mostrar varias tiendas?", "Sí. Crea un mapa público con marcadores en Google My Maps y pega su enlace en el generador."],
            ],
            ctaTitle: "Crea el mapa de tu tienda",
            ctaText: "Genera un iframe responsive para Shopify sin aplicaciones ni clave API.",
            ctaButton: "Abrir el generador",
        },
        multipleLocations: {
            seoTitle: "Cómo insertar Google Maps con varias ubicaciones",
            description: "Aprende a insertar un mapa de Google con varias ubicaciones mediante Google My Maps. Añade marcadores y genera un iframe responsive sin clave API.",
            platform: "Google My Maps",
            title: "Cómo insertar un mapa de Google con varias ubicaciones",
            lead: "Crea un único mapa interactivo con varios marcadores y añádelo a tu sitio web mediante código responsive, sin utilizar una clave de Google Maps API.",
            intro: "Un iframe estándar suele centrarse en una dirección. Para mostrar sucursales, puntos de recogida, propiedades, zonas de servicio o sedes de un evento, Google My Maps permite colocar varios marcadores, organizarlos por capas y personalizar sus colores antes de publicar el mapa.",
            updated: "Actualizado el 20 de octubre de 2026",
            readTime: "10 min de lectura",
            breadcrumb: "Guías",
            contents: "En esta guía",
            quickAnswerTitle: "Respuesta rápida",
            quickAnswer: "Abre Google My Maps desde la pestaña <a href=\"/es/#generator\">My Maps del generador</a>, crea un mapa, añade todas las ubicaciones y permite que cualquier persona con el enlace pueda verlo. Copia el enlace compartido, pégalo en el generador y crea el iframe responsive.",
            sections: [
                {
                    id: "video",
                    title: "Vídeo: crea un mapa con varias ubicaciones",
                    paragraphs: ["El vídeo muestra el flujo completo en Google My Maps. Después puedes seguir los pasos ilustrados para configurar correctamente el enlace y la inserción."],
                    video: { src: "https://www.youtube-nocookie.com/embed/yIkfpkLjEEs", title: "Cómo crear un mapa de Google con varias ubicaciones", link: "https://www.youtube.com/watch?v=yIkfpkLjEEs", label: "Tutorial completo para crear un mapa con varias ubicaciones" },
                },
                {
                    id: "crear-mapa",
                    kicker: "Paso 1",
                    title: "Abre Google My Maps y crea un mapa nuevo",
                    paragraphs: [
                        "En el generador selecciona <strong>My Maps</strong> y utiliza el enlace para abrir Google My Maps. Inicia sesión en la cuenta que será propietaria del mapa y pulsa <strong>Crear un mapa nuevo</strong>.",
                        "Comprueba la cuenta activa antes de continuar. Esa cuenta controlará las ubicaciones, el diseño y los permisos para compartir.",
                    ],
                    image: "/guides/step-1-create-multiple-marker-google-map.webp",
                    imageAlt: "Panel de Google My Maps con el botón para crear un mapa nuevo",
                    caption: "Selecciona «Crear un mapa nuevo» para comenzar el mapa con varios marcadores.",
                },
                {
                    id: "nombrar-mapa",
                    kicker: "Paso 2",
                    title: "Pon nombre y guarda el mapa personalizado",
                    paragraphs: [
                        "Pulsa <strong>Mapa sin nombre</strong> y escribe un título descriptivo como «Nuestras tiendas», «Puntos de recogida» o «Sedes del evento». Puedes añadir una descripción para explicar qué representan los marcadores.",
                        "Un nombre claro ayuda a identificar el proyecto cuando administras varios mapas y también puede aparecer al abrir el mapa insertado.",
                    ],
                    image: "/guides/step-2-name-google-my-map.webp",
                    imageAlt: "Cuadro de Google My Maps para escribir el título del mapa",
                    caption: "Sustituye el título genérico por un nombre que describa las ubicaciones.",
                },
                {
                    id: "primera-ubicacion",
                    kicker: "Paso 3",
                    title: "Busca y añade la primera ubicación",
                    paragraphs: [
                        "Escribe el nombre del negocio, lugar o dirección completa en el buscador. Confirma que la ficha corresponde al sitio correcto y pulsa <strong>Añadir al mapa</strong>.",
                        "Si existen resultados parecidos, incluye ciudad, región y código postal. Para lugares que no aparecen en la búsqueda, coloca manualmente un marcador y asígnale un nombre claro.",
                    ],
                    image: "/guides/step-3-add-first-location-google-my-maps.webp",
                    imageAlt: "Resultado de búsqueda en Google My Maps con la opción Añadir al mapa",
                    caption: "Comprueba la dirección y añade el resultado correcto al mapa.",
                },
                {
                    id: "mas-ubicaciones",
                    kicker: "Paso 4",
                    title: "Añade más ubicaciones y personaliza los marcadores",
                    paragraphs: [
                        "Repite la búsqueda para cada ubicación. Utiliza el icono de estilo para cambiar colores y símbolos; por ejemplo, tiendas en un color, oficinas en otro y puntos de recogida en un tercero.",
                        "Añade información útil como horarios, teléfono, aparcamiento o enlace de reserva. Si tienes categorías diferentes, crea capas separadas para que el visitante pueda mostrarlas u ocultarlas.",
                    ],
                    image: "/guides/step-4-add-multiple-locations-style-markers.webp",
                    imageAlt: "Google My Maps con varios marcadores y controles de estilo",
                    caption: "Añade los lugares restantes, personaliza sus iconos y selecciona Compartir.",
                    callout: "Utiliza el nombre real de cada negocio o lugar. Etiquetas como «Ubicación 1» aportan poca información al visitante.",
                },
                {
                    id: "compartir",
                    kicker: "Paso 5",
                    title: "Permite el acceso mediante enlace y copia la URL",
                    paragraphs: [
                        "En el cuadro de compartir, activa <strong>Cualquier persona con el enlace puede ver</strong>. Los visitantes solo necesitan permiso de lectura; no deben poder editar el mapa.",
                        "Copia la URL y pruébala en una ventana privada. Si el mapa se abre sin solicitar acceso, los permisos son correctos.",
                    ],
                    image: "/guides/step-5-share-google-my-map-copy-link.webp",
                    imageAlt: "Ventana para compartir Google My Maps con acceso por enlace",
                    caption: "Activa el acceso por enlace y copia la URL completa de My Maps.",
                },
                {
                    id: "codigo-responsive",
                    kicker: "Paso 6",
                    title: "Genera el código responsive para varias ubicaciones",
                    paragraphs: ["Vuelve al <a href=\"/es/#generator\">generador</a>, abre la pestaña My Maps y pega la URL compartida. La herramienta la convierte en una vista previa insertable."],
                    ordered: [
                        "Comprueba que todos los marcadores aparecen en la vista previa.",
                        "Elige un tamaño o introduce anchura y altura personalizadas.",
                        "Mantén el modo responsive para adaptar el mapa a móviles.",
                        "Pulsa <strong>Generar código</strong> y copia el HTML.",
                    ],
                    image: "/guides/step-6-generate-multiple-location-map-embed-code.webp",
                    imageAlt: "Generador mostrando una vista previa de Google My Maps con varios marcadores",
                    caption: "Pega la URL, revisa el mapa y genera el código final.",
                },
                {
                    id: "publicar",
                    title: "Inserta el mapa con varias ubicaciones en tu web",
                    paragraphs: ["Pega el código en un bloque HTML o de inserción y revisa el resultado antes de publicar. Comprueba el mapa en móvil y ordenador."],
                    bullets: [
                        "<strong>WordPress:</strong> utiliza un bloque HTML personalizado y consulta la <a href=\"/es/guides/embed-google-maps-wordpress/\">guía para WordPress</a>.",
                        "<strong>Shopify:</strong> usa una sección Liquid o HTML y consulta la <a href=\"/es/guides/embed-google-maps-shopify/\">guía para Shopify</a>.",
                        "<strong>Wix, Squarespace o Webflow:</strong> utiliza el elemento de código o HTML Embed.",
                        "<strong>HTML:</strong> pega el iframe dentro de <code>&lt;body&gt;</code> donde debe mostrarse.",
                    ],
                },
                {
                    id: "importar-muchas",
                    title: "Importa muchas ubicaciones desde CSV o Google Sheets",
                    paragraphs: ["Para decenas o cientos de puntos, prepara una hoja con encabezados y una columna que contenga direcciones, nombres de lugares o coordenadas."],
                    ordered: [
                        "Crea o selecciona una capa en My Maps.",
                        "Pulsa <strong>Importar</strong> bajo el nombre de la capa.",
                        "Sube un archivo CSV, XLSX, KML, KMZ, GPX o TSV, o elige una hoja de Google.",
                        "Selecciona las columnas que permiten ubicar los marcadores.",
                        "Elige la columna que se usará como título.",
                        "Corrige las filas que no se hayan podido localizar.",
                    ],
                    callout: "Google indica un máximo de 2.000 elementos importados por capa. Separar listas grandes en categorías también facilita el uso del mapa.",
                },
                {
                    id: "marcadores-rutas",
                    title: "Diferencia entre varios marcadores y una ruta con paradas",
                    paragraphs: ["Este método muestra ubicaciones independientes; no las conecta automáticamente. Usa marcadores para sucursales, inmuebles, zonas de servicio y puntos de recogida. Utiliza indicaciones con varias paradas cuando necesites un recorrido ordenado desde un origen hasta un destino."],
                },
                {
                    id: "solucion-problemas",
                    title: "Solución de problemas",
                    bullets: [
                        "<strong>El mapa pide iniciar sesión:</strong> revisa los permisos y permite la visualización mediante enlace.",
                        "<strong>Un marcador está mal colocado:</strong> utiliza la dirección completa o coordenadas exactas.",
                        "<strong>El mapa se corta en móvil:</strong> vuelve a generar el iframe con el modo responsive.",
                        "<strong>Los nuevos marcadores no aparecen:</strong> confirma que editaste el mismo mapa y actualiza la página sin caché.",
                        "<strong>La URL es rechazada:</strong> copia el enlace completo desde el cuadro Compartir de Google My Maps.",
                    ],
                },
            ],
            faqTitle: "Preguntas frecuentes sobre mapas con varias ubicaciones",
            faqs: [
                ["¿Puedo insertar varias ubicaciones sin clave API?", "Sí. Necesitas una cuenta de Google para crear el mapa, pero el método de My Maps e iframe no requiere una clave de Maps API."],
                ["¿Cuántas ubicaciones admite un mapa?", "Google indica hasta 10.000 lugares, líneas o formas por mapa y hasta 2.000 elementos por capa."],
                ["¿Los visitantes pueden filtrar ubicaciones?", "Pueden mostrar u ocultar capas. Organiza tiendas, almacenes o puntos de recogida en capas diferentes."],
                ["¿Las modificaciones actualizan el iframe?", "Sí. El iframe carga el mapa guardado, por lo que los cambios suelen aparecer sin sustituir el código."],
                ["¿Esto crea rutas entre todos los puntos?", "No. Muestra varios marcadores independientes; las indicaciones con paradas son una función distinta."],
            ],
            sourcesTitle: "Referencias oficiales de Google",
            sources: [
                ["Crear o abrir un mapa", "https://support.google.com/mymaps/answer/3024454?hl=es"],
                ["Añadir lugares al mapa", "https://support.google.com/mymaps/answer/3024925?hl=es"],
                ["Compartir o insertar un mapa", "https://support.google.com/mymaps/answer/3109452?hl=es"],
                ["Importar elementos desde un archivo", "https://support.google.com/mymaps/answer/3024836?hl=es"],
            ],
            ctaTitle: "Crea un mapa responsive con varios marcadores",
            ctaText: "Pega la URL pública de Google My Maps y genera código limpio para tu web.",
            ctaButton: "Abrir el generador",
        },
    },
    de: {
        wordpress: {
            seoTitle: "Google Maps in WordPress einbetten – Kostenlose Anleitung",
            description: "Google Maps ohne Plugin und API-Schlüssel in WordPress einbetten. Anleitung für Gutenberg, klassischen Editor, Widgets und responsive Karten.",
            platform: "WordPress",
            title: "Google Maps in WordPress einbetten",
            lead: "Füge eine interaktive Google-Karte ohne Plugin und eigenen API-Schlüssel in eine WordPress-Seite, einen Beitrag, die Seitenleiste oder den Footer ein.",
            intro: "Am einfachsten bindest du einen Standort über einen Google-Maps-Iframe in einen individuellen HTML-Block ein. Die Karte übernimmt Zoom und Ansicht aus dem Generator und passt sich mit einem responsiven Container an Smartphones und große Bildschirme an.",
            updated: "Aktualisiert am 20. Oktober 2026",
            readTime: "6 Min. Lesezeit",
            breadcrumb: "Anleitungen",
            contents: "Inhalt",
            quickAnswerTitle: "Kurz erklärt",
            quickAnswer: "Erstelle die Karte mit <a href=\"/de/#generator\">unserem Generator</a>, wähle volle Breite und aktiviere die responsive Darstellung. Füge in WordPress einen Block <strong>Individuelles HTML</strong> hinzu, setze den Iframe-Code ein und veröffentliche die Seite.",
            sections: [
                {
                    id: "code-erstellen",
                    kicker: "Schritt 1",
                    title: "Google-Maps-Einbettungscode erstellen",
                    paragraphs: ["Erstelle zuerst den Iframe mit dem Standort und der gewünschten Kartenansicht. Dafür brauchst du kein WordPress-Plugin."],
                    ordered: [
                        "Öffne den <a href=\"/de/#generator\">Google-Maps-Einbettungscode-Generator</a>.",
                        "Gib die vollständige Adresse, den Unternehmensnamen oder genaue Koordinaten ein.",
                        "Passe den Zoom an und wähle Straßenkarte oder Satellitenansicht.",
                        "Wähle <strong>Volle Breite (100 %)</strong> und lasse die responsive Option aktiv.",
                        "Klicke auf <strong>Code erstellen</strong> und kopiere das HTML.",
                    ],
                    callout: "Ein aussagekräftiger Iframe-Titel wie „Karte unserer Filiale in Berlin“ verbessert die Barrierefreiheit.",
                },
                {
                    id: "block-editor",
                    kicker: "Schritt 2",
                    title: "Karte im WordPress-Block-Editor einfügen",
                    paragraphs: ["Gutenberg ist der Standardeditor von WordPress. Im Block „Individuelles HTML“ bleibt der Iframe als Code erhalten."],
                    ordered: [
                        "Öffne die Seite oder den Beitrag für die Karte.",
                        "Klicke auf <strong>+</strong>, um einen Block hinzuzufügen.",
                        "Suche nach <strong>Individuelles HTML</strong> und wähle den Block.",
                        "Füge den kopierten Iframe-Code ein.",
                        "Prüfe die Karte über die Vorschau.",
                        "Klicke auf <strong>Veröffentlichen</strong> oder <strong>Aktualisieren</strong>.",
                    ],
                    callout: "Wenn das Theme die Breite begrenzt, verschiebe den HTML-Block aus schmalen Spalten oder Gruppen mit fester Breite.",
                },
                {
                    id: "klassischer-editor",
                    kicker: "Schritt 3",
                    title: "Google Maps im klassischen Editor einbetten",
                    paragraphs: ["Mit dem Classic Editor oder einer älteren WordPress-Installation fügst du den Iframe in der Codeansicht ein."],
                    ordered: [
                        "Öffne die gewünschte Seite oder den Beitrag.",
                        "Wähle im Editor den Tab <strong>Text</strong> statt Visuell.",
                        "Füge den Iframe an der gewünschten Position ein.",
                        "Wechsle zurück zur visuellen Ansicht und kontrolliere die Position.",
                        "Speichere mit <strong>Aktualisieren</strong>.",
                    ],
                    callout: "Füge den Code nicht in der visuellen Ansicht ein. WordPress kann das HTML sonst kodieren oder entfernen.",
                },
                {
                    id: "widgets",
                    title: "Karte in Seitenleiste oder Footer anzeigen",
                    paragraphs: ["In Themes mit Widget-Bereichen kannst du die Karte auch in einer Seitenleiste oder im Footer platzieren. Prüfe besonders auf Mobilgeräten, ob genug Platz vorhanden ist."],
                    ordered: [
                        "Öffne <strong>Design → Widgets</strong> im WordPress-Dashboard.",
                        "Wähle die gewünschte Seitenleiste oder den Footer-Bereich.",
                        "Füge einen Block oder ein Widget <strong>Individuelles HTML</strong> hinzu.",
                        "Setze den Iframe ein, speichere und kontrolliere die veröffentlichte Seite.",
                    ],
                },
                {
                    id: "fehlerbehebung",
                    title: "Tipps und Fehlerbehebung",
                    bullets: [
                        "<strong>Karte wird nicht angezeigt:</strong> Prüfe, ob ein Sicherheits-Plugin Iframes entfernt. Erlaube nur die benötigte Google-Maps-Domain.",
                        "<strong>Karte ist zu breit:</strong> Erzeuge den Code erneut mit 100 % Breite und responsivem Modus.",
                        "<strong>Falscher Standort:</strong> Verwende eine vollständigere Adresse oder exakte Koordinaten.",
                        "<strong>Langsamer Seitenaufbau:</strong> Behalte <code>loading=\"lazy\"</code> bei, damit die Karte erst in der Nähe des sichtbaren Bereichs lädt.",
                        "<strong>Block verschwindet:</strong> Prüfe die Berechtigung für ungefiltertes HTML; WordPress Multisite kann Iframes einschränken.",
                    ],
                },
            ],
            faqTitle: "Häufige Fragen zu Google Maps und WordPress",
            faqs: [
                ["Brauche ich ein Plugin?", "Nein. Der erzeugte Iframe funktioniert direkt in einem Block für individuelles HTML."],
                ["Ist ein Google-Maps-API-Schlüssel erforderlich?", "Nicht für diesen Iframe. Eine individuell programmierte JavaScript-Integration kann dagegen einen Schlüssel benötigen."],
                ["Funktioniert die Karte auf Smartphones?", "Ja. Verwende volle Breite und lasse den responsiven Container aktiviert."],
                ["Kann ich mehrere Filialen zeigen?", "Ja. Erstelle die Marker in Google My Maps und folge der Anleitung für mehrere Standorte."],
            ],
            ctaTitle: "Karte für WordPress erstellen",
            ctaText: "Standort, Größe und Zoom festlegen und in wenigen Sekunden einen responsiven Iframe kopieren.",
            ctaButton: "Generator öffnen",
        },
        shopify: {
            seoTitle: "Google Maps in Shopify einbetten – Kostenlose Anleitung",
            description: "Google Maps ohne App und API-Schlüssel in Shopify einbetten. Responsive Karte zu Seiten, Produkten und Theme-Abschnitten hinzufügen.",
            platform: "Shopify",
            title: "Google Maps in Shopify einbetten",
            lead: "Füge der Kontaktseite, Produktseiten oder Theme-Abschnitten deines Shopify-Shops eine interaktive Karte hinzu – ohne App und API-Schlüssel.",
            intro: "Shopify kann Iframes in Feldern und Abschnitten ausgeben, die HTML oder benutzerdefiniertes Liquid unterstützen. Welcher Weg passt, hängt vom Theme ab; derselbe responsive Code funktioniert auf Seiten, in Vorlagen und Produktbeschreibungen.",
            updated: "Aktualisiert am 20. Oktober 2026",
            readTime: "6 Min. Lesezeit",
            breadcrumb: "Anleitungen",
            contents: "Inhalt",
            quickAnswerTitle: "Kurz erklärt",
            quickAnswer: "Erstelle den Iframe mit <a href=\"/de/#generator\">unserem Generator</a>. Öffne in Shopify die gewünschte Seite, wechsle über <strong>&lt;&gt;</strong> zur HTML-Ansicht, füge den Code ein und speichere. Im Theme-Editor nutzt du benutzerdefiniertes Liquid oder HTML.",
            sections: [
                {
                    id: "code-erstellen",
                    kicker: "Schritt 1",
                    title: "Google-Maps-Code für Shopify erstellen",
                    ordered: [
                        "Öffne den <a href=\"/de/#generator\">Kartengenerator</a>.",
                        "Suche die Geschäftsadresse oder gib Koordinaten ein.",
                        "Wähle Zoomstufe und Kartentyp.",
                        "Stelle <strong>Volle Breite (100 %)</strong> ein und behalte die responsive Option bei.",
                        "Klicke auf <strong>Code erstellen</strong> und kopiere den Iframe.",
                    ],
                },
                {
                    id: "shopify-seite",
                    kicker: "Schritt 2",
                    title: "Karte in eine Shopify-Seite einfügen",
                    paragraphs: ["Diese Methode eignet sich für Kontaktseiten, Ladeninformationen, Abholung vor Ort und Anfahrtsbeschreibungen."],
                    ordered: [
                        "Öffne in Shopify Admin <strong>Onlineshop → Seiten</strong>.",
                        "Öffne oder erstelle die gewünschte Seite.",
                        "Klicke im Editor auf <strong>&lt;&gt;</strong>, um den HTML-Quelltext anzuzeigen.",
                        "Füge den Iframe an der gewünschten Stelle ein.",
                        "Speichere und kontrolliere die öffentliche Seite.",
                    ],
                    callout: "Wechsle vor dem Einfügen in die HTML-Ansicht. Im Rich-Text-Modus kann Shopify den Iframe als Text darstellen oder entfernen.",
                },
                {
                    id: "theme-editor",
                    kicker: "Schritt 3",
                    title: "Karte über den Shopify-Theme-Editor einfügen",
                    paragraphs: ["Die verfügbaren Abschnitte unterscheiden sich je nach Theme. Viele moderne Themes enthalten einen Abschnitt für benutzerdefiniertes Liquid."],
                    ordered: [
                        "Gehe zu <strong>Onlineshop → Themes</strong> und klicke auf <strong>Anpassen</strong>.",
                        "Öffne die gewünschte Start-, Kontakt- oder Seitenvorlage.",
                        "Wähle <strong>Abschnitt hinzufügen</strong> und suche nach benutzerdefiniertem Liquid, HTML, Code oder Einbettung.",
                        "Füge den Iframe ein und prüfe Desktop- sowie Mobilvorschau.",
                        "Klicke auf <strong>Speichern</strong>.",
                    ],
                    callout: "Bietet dein Theme keinen geeigneten Abschnitt, verwende die HTML-Methode für Seiten oder lass einen passenden Liquid-Abschnitt ergänzen.",
                },
                {
                    id: "produktseite",
                    title: "Google Map auf einer Shopify-Produktseite anzeigen",
                    paragraphs: ["Eine Karte in der Produktbeschreibung ist hilfreich für Abholorte, Veranstaltungen, Unterkünfte oder Dienstleistungen an einem festen Standort."],
                    ordered: [
                        "Öffne <strong>Produkte</strong> in Shopify Admin.",
                        "Wähle das gewünschte Produkt.",
                        "Öffne mit <strong>&lt;&gt;</strong> die HTML-Ansicht der Beschreibung.",
                        "Füge den Iframe ein, speichere und kontrolliere die Produktseite.",
                    ],
                },
                {
                    id: "fehlerbehebung",
                    title: "Tipps und Fehlerbehebung",
                    bullets: [
                        "<strong>Karte fehlt:</strong> Kontrolliere die öffentliche Seite; manche Editor-Vorschauen zeigen Iframes nicht an.",
                        "<strong>Theme entfernt den Code:</strong> Verwende einen Abschnitt für benutzerdefiniertes Liquid statt Rich Text.",
                        "<strong>Karte ist zu breit:</strong> Aktiviere den responsiven Modus und vermeide feste Werte außerhalb des Theme-Containers.",
                        "<strong>Passende Zoomstufe:</strong> Für ein einzelnes Geschäft funktionieren Stufen von 14 bis 16 meist gut.",
                        "<strong>Adresse nicht eindeutig:</strong> Verwende genaue Koordinaten für die korrekte Markerposition.",
                    ],
                },
            ],
            faqTitle: "Häufige Fragen zu Google Maps und Shopify",
            faqs: [
                ["Brauche ich eine Shopify-App?", "Nein. Du kannst den Iframe in eine Seite oder einen Abschnitt mit HTML beziehungsweise benutzerdefiniertem Liquid einfügen."],
                ["Ist ein API-Schlüssel nötig?", "Nein, nicht für den mit dieser Methode erzeugten Iframe."],
                ["Beeinflusst die Karte die Ladezeit?", "Sie lädt externe Ressourcen. Lazy Loading verringert jedoch die anfängliche Belastung."],
                ["Kann ich mehrere Geschäfte anzeigen?", "Ja. Erstelle in Google My Maps eine öffentliche Karte mit mehreren Markern und füge den Link in den Generator ein."],
            ],
            ctaTitle: "Karte für deinen Shop erstellen",
            ctaText: "Erzeuge einen responsiven Shopify-Iframe ohne App und API-Schlüssel.",
            ctaButton: "Generator öffnen",
        },
        multipleLocations: {
            seoTitle: "Google Maps mit mehreren Standorten einbetten",
            description: "Google Map mit mehreren Standorten über Google My Maps einbetten. Marker hinzufügen und responsiven Iframe ohne API-Schlüssel erstellen.",
            platform: "Google My Maps",
            title: "Google Maps mit mehreren Standorten einbetten",
            lead: "Erstelle eine interaktive Karte mit mehreren Markierungen und binde sie responsiv in deine Website ein – ohne eigenen Google-Maps-API-Schlüssel.",
            intro: "Ein normaler Google-Maps-Iframe konzentriert sich meist auf eine Adresse. Für Filialen, Abholpunkte, Immobilien, Servicegebiete oder Veranstaltungsorte kannst du in Google My Maps mehrere Marker setzen, in Ebenen ordnen und farblich gestalten.",
            updated: "Aktualisiert am 20. Oktober 2026",
            readTime: "10 Min. Lesezeit",
            breadcrumb: "Anleitungen",
            contents: "In dieser Anleitung",
            quickAnswerTitle: "Kurz erklärt",
            quickAnswer: "Öffne Google My Maps über den Tab <a href=\"/de/#generator\">My Maps im Generator</a>, erstelle eine Karte und füge alle Standorte hinzu. Erlaube die Ansicht über den Link, kopiere die freigegebene URL und erzeuge daraus einen responsiven Iframe.",
            sections: [
                {
                    id: "video",
                    title: "Video: Karte mit mehreren Standorten erstellen",
                    paragraphs: ["Das Video zeigt den gesamten Ablauf in Google My Maps. Anschließend kannst du die bebilderten Schritte für Freigabe und Einbettung durchgehen."],
                    video: { src: "https://www.youtube-nocookie.com/embed/yIkfpkLjEEs", title: "Google Map mit mehreren Standorten erstellen", link: "https://www.youtube.com/watch?v=yIkfpkLjEEs", label: "Vollständiges Tutorial für eine Karte mit mehreren Standorten" },
                },
                {
                    id: "karte-erstellen",
                    kicker: "Schritt 1",
                    title: "Google My Maps öffnen und neue Karte erstellen",
                    paragraphs: [
                        "Wähle im Generator <strong>My Maps</strong> und öffne Google My Maps über den Link. Melde dich mit dem Google-Konto an, dem die Karte gehören soll, und klicke auf <strong>Neue Karte erstellen</strong>.",
                        "Prüfe das aktive Konto. Es kontrolliert später Standorte, Darstellung und Freigaberechte.",
                    ],
                    image: "/guides/step-1-create-multiple-marker-google-map.webp",
                    imageAlt: "Google-My-Maps-Übersicht mit Schaltfläche zum Erstellen einer neuen Karte",
                    caption: "Wähle „Neue Karte erstellen“, um mit der Karte zu beginnen.",
                },
                {
                    id: "karte-benennen",
                    kicker: "Schritt 2",
                    title: "Eigene Karte benennen und speichern",
                    paragraphs: [
                        "Klicke auf <strong>Unbenannte Karte</strong> und verwende einen verständlichen Titel wie „Unsere Filialen“, „Abholpunkte“ oder „Veranstaltungsorte“. Eine Beschreibung kann den Zweck der Marker erklären.",
                        "Ein eindeutiger Name hilft bei mehreren My-Maps-Projekten und kann auch beim Öffnen der eingebetteten Karte erscheinen.",
                    ],
                    image: "/guides/step-2-name-google-my-map.webp",
                    imageAlt: "Dialog in Google My Maps zum Benennen einer Karte",
                    caption: "Ersetze den allgemeinen Titel durch einen Namen, der die Standorte beschreibt.",
                },
                {
                    id: "erster-standort",
                    kicker: "Schritt 3",
                    title: "Ersten Standort suchen und hinzufügen",
                    paragraphs: [
                        "Gib den Unternehmensnamen, Ort oder die vollständige Adresse in das Suchfeld ein. Kontrolliere den Treffer und wähle <strong>Zur Karte hinzufügen</strong>.",
                        "Bei ähnlichen Treffern ergänze Stadt, Region und Postleitzahl. Nicht auffindbare Orte kannst du mit dem Marker-Werkzeug manuell setzen und benennen.",
                    ],
                    image: "/guides/step-3-add-first-location-google-my-maps.webp",
                    imageAlt: "Suchergebnis in Google My Maps mit der Option Zur Karte hinzufügen",
                    caption: "Prüfe die Adresse und speichere den richtigen Treffer in der Karte.",
                },
                {
                    id: "weitere-standorte",
                    kicker: "Schritt 4",
                    title: "Weitere Standorte hinzufügen und Marker gestalten",
                    paragraphs: [
                        "Wiederhole die Suche für jeden Standort. Über das Stilsymbol änderst du Farben und Symbole, etwa eine Farbe für Geschäfte und eine andere für Abholpunkte.",
                        "Ergänze Öffnungszeiten, Telefonnummern, Parkhinweise oder Buchungslinks. Verschiedene Ebenen sind sinnvoll, wenn Besucher Kategorien ein- und ausblenden sollen.",
                    ],
                    image: "/guides/step-4-add-multiple-locations-style-markers.webp",
                    imageAlt: "Google My Maps mit mehreren Markern und Stiloptionen",
                    caption: "Füge alle Orte hinzu, gestalte die Marker und wähle anschließend Teilen.",
                    callout: "Verwende den echten Namen jedes Ortes. Bezeichnungen wie „Standort 1“ helfen Besuchern kaum.",
                },
                {
                    id: "freigeben",
                    kicker: "Schritt 5",
                    title: "Linkzugriff erlauben und URL kopieren",
                    paragraphs: [
                        "Aktiviere im Freigabedialog <strong>Jeder mit diesem Link kann die Karte ansehen</strong>. Besucher benötigen nur Leserechte und dürfen die Karte nicht bearbeiten.",
                        "Kopiere die URL und teste sie in einem privaten Browserfenster. Öffnet sich die Karte ohne Zugriffsanfrage, stimmen die Einstellungen.",
                    ],
                    image: "/guides/step-5-share-google-my-map-copy-link.webp",
                    imageAlt: "Freigabedialog von Google My Maps mit Linkzugriff",
                    caption: "Erlaube die Ansicht per Link und kopiere die vollständige My-Maps-URL.",
                },
                {
                    id: "responsiver-code",
                    kicker: "Schritt 6",
                    title: "Responsiven Code für mehrere Standorte erzeugen",
                    paragraphs: ["Kehre zum <a href=\"/de/#generator\">Generator</a> zurück, öffne My Maps und füge die freigegebene URL ein. Die Karte erscheint als Einbettungsvorschau."],
                    ordered: [
                        "Kontrolliere, ob alle gespeicherten Marker sichtbar sind.",
                        "Wähle eine Größe oder gib eigene Abmessungen ein.",
                        "Lasse den responsiven Modus für Smartphones aktiviert.",
                        "Klicke auf <strong>Code erstellen</strong> und kopiere das HTML.",
                    ],
                    image: "/guides/step-6-generate-multiple-location-map-embed-code.webp",
                    imageAlt: "Generator mit Vorschau einer Google-My-Maps-Karte mit mehreren Markern",
                    caption: "URL einfügen, Vorschau prüfen und fertigen Code erzeugen.",
                },
                {
                    id: "veroeffentlichen",
                    title: "Karte mit mehreren Standorten in die Website einfügen",
                    paragraphs: ["Füge den Code in einen HTML- oder Einbettungsblock ein. Prüfe die Seite vor dem Veröffentlichen auf Desktop und Smartphone."],
                    bullets: [
                        "<strong>WordPress:</strong> Nutze einen Block für individuelles HTML und die <a href=\"/de/guides/embed-google-maps-wordpress/\">WordPress-Anleitung</a>.",
                        "<strong>Shopify:</strong> Nutze einen Liquid- oder HTML-Abschnitt und die <a href=\"/de/guides/embed-google-maps-shopify/\">Shopify-Anleitung</a>.",
                        "<strong>Wix, Squarespace oder Webflow:</strong> Verwende das Code- oder HTML-Embed-Element.",
                        "<strong>HTML:</strong> Setze den Iframe an der gewünschten Stelle in <code>&lt;body&gt;</code> ein.",
                    ],
                },
                {
                    id: "massenimport",
                    title: "Viele Standorte aus CSV oder Google Sheets importieren",
                    paragraphs: ["Für Dutzende oder Hunderte Orte bereitest du eine Tabelle mit Überschriften und einer Spalte für Adressen, Ortsnamen oder Koordinaten vor."],
                    ordered: [
                        "Erstelle oder wähle eine Ebene in My Maps.",
                        "Klicke unter dem Ebenennamen auf <strong>Importieren</strong>.",
                        "Lade CSV, XLSX, KML, KMZ, GPX oder TSV hoch oder wähle ein Google Sheet.",
                        "Bestimme die Spalten für die Position der Marker.",
                        "Wähle die Spalte für den Markertitel.",
                        "Korrigiere Zeilen, die nicht zugeordnet wurden.",
                    ],
                    callout: "Google nennt ein Limit von 2.000 importierten Elementen pro Ebene. Kategorien in getrennten Ebenen machen große Karten übersichtlicher.",
                },
                {
                    id: "marker-routen",
                    title: "Mehrere Marker oder Route mit Zwischenstopps?",
                    paragraphs: ["Diese Methode zeigt unabhängige Standorte und verbindet sie nicht automatisch. Marker passen zu Filialen, Immobilien, Servicegebieten und Abholpunkten. Eine Route mit Zwischenstopps ist richtig, wenn Besucher eine festgelegte Reihenfolge von Start bis Ziel benötigen."],
                },
                {
                    id: "fehlerbehebung",
                    title: "Fehlerbehebung",
                    bullets: [
                        "<strong>Karte verlangt eine Anmeldung:</strong> Erlaube in den Freigabeeinstellungen die Ansicht über den Link.",
                        "<strong>Marker liegt falsch:</strong> Verwende die vollständige Adresse oder genaue Koordinaten.",
                        "<strong>Karte wird mobil abgeschnitten:</strong> Erzeuge den Iframe erneut im responsiven Modus.",
                        "<strong>Neue Marker fehlen:</strong> Prüfe, ob du dieselbe My-Maps-Karte bearbeitet hast, und lade ohne Browsercache neu.",
                        "<strong>URL wird abgelehnt:</strong> Kopiere den vollständigen Link aus dem Teilen-Dialog von Google My Maps.",
                    ],
                },
            ],
            faqTitle: "Häufige Fragen zu Karten mit mehreren Standorten",
            faqs: [
                ["Kann ich mehrere Standorte ohne API-Schlüssel einbetten?", "Ja. Zum Erstellen der Karte brauchst du ein Google-Konto, für die Einbettung über My Maps aber keinen Maps-API-Schlüssel."],
                ["Wie viele Standorte passen in eine Karte?", "Google nennt bis zu 10.000 Orte, Linien oder Formen pro Karte und bis zu 2.000 Elemente pro Ebene."],
                ["Können Besucher Standorte filtern?", "Sie können Ebenen ein- und ausblenden. Ordne Geschäfte, Lager oder Abholpunkte unterschiedlichen Ebenen zu."],
                ["Werden Änderungen im Iframe aktualisiert?", "Ja. Der Iframe lädt die gespeicherte Karte; Änderungen erscheinen normalerweise ohne neuen Einbettungscode."],
                ["Erstellt die Karte Routen zwischen allen Punkten?", "Nein. Sie zeigt unabhängige Marker. Routen mit Zwischenstopps sind eine andere Funktion."],
            ],
            sourcesTitle: "Offizielle Google-Quellen",
            sources: [
                ["Karte erstellen oder öffnen", "https://support.google.com/mymaps/answer/3024454?hl=de"],
                ["Orte zur Karte hinzufügen", "https://support.google.com/mymaps/answer/3024925?hl=de"],
                ["Karte teilen oder einbetten", "https://support.google.com/mymaps/answer/3109452?hl=de"],
                ["Kartenelemente aus einer Datei importieren", "https://support.google.com/mymaps/answer/3024836?hl=de"],
            ],
            ctaTitle: "Responsive Karte mit mehreren Markern erstellen",
            ctaText: "Öffentliche My-Maps-URL einfügen und sauberen Einbettungscode erzeugen.",
            ctaButton: "Generator öffnen",
        },
    },
};
