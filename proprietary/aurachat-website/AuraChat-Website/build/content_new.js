'use strict';
/* Erweiterung des Bauplans: AuraCall (neues Produkt) und alles Neue bei AuraChat, in allen fünf Sprachen.
 * Nur Aussagen, die der Code der Produkte hergibt. */
const base = require('./content.js');
const { products, shared, DOWNLOADS, LANGS } = base;

// ---------------------------------------------------------------- 1) AuraCall
const T = {
  de: {
    nav: 'AuraCall',
    hero: { title: 'Aura geht ans Telefon.', lead: 'AuraCall verbindet eure Telefonnummer mit AuraChat: Aura nimmt Anrufe entgegen, versteht, was gesagt wird, und antwortet mit Stimme — auf euren eigenen Servern. Auf Wunsch ruft Aura auch selbst an, zum Beispiel um eine Nachricht auszurichten.' },
    features: { heading: 'Ein Telefonassistent, der sich an die Regeln hält.',
      f1: { title: 'Anrufe entgegennehmen', desc: 'Aura begrüsst die Anrufenden, macht von Anfang an klar, dass sie eine KI ist, hört zu, beantwortet Fragen und verabschiedet sich. Auch Unterbrechen mitten im Satz ist möglich.' },
      f2: { title: 'Das Wissen eures Betriebs', desc: 'Öffnungszeiten, Preise, Anreise: ihr legt fest, was Aura am Telefon weiss. Weiss sie etwas nicht, sagt sie das ehrlich und bietet einen Rückruf an.' },
      f3: { title: 'Ausgehende Anrufe', desc: 'Aura ruft Nummern an und richtet Nachrichten aus — sofort oder zu einer geplanten Zeit. Grenzen für Länder, Uhrzeiten, Anzahl und Sondernummern verhindern Missbrauch und unerwartete Kosten.' },
      f4: { title: 'Anrufe aus AuraChat', desc: '„Ruf 079 … an und sag ihr, dass das Zimmer bereit ist“ — per Chat oder Mikrofon. AuraChat fragt vorher nach, erst nach „ja“ wird gewählt. Nur für Administrator:innen.' },
      f5: { title: 'Datenschutz &amp; Sicherheit', desc: 'Keine Tonaufnahmen. Gesprächstexte nur auf Wunsch und mit automatischer Löschung. Zwei-Faktor-Anmeldung, Anmeldung über AuraDirect und eine Vorlage für die Datenschutzerklärung.' },
      f6: { title: 'Betrieb &amp; Sprachen', desc: 'Eigener Asterisk im Docker-Container, beliebiger SIP-Anbieter, Verwaltung im Browser mit Anrufliste, Einstellungen und Lizenz. Spracherkennung, Antworten und Stimme kommen aus eurem eigenen AuraChat. Sprache am Telefon: Deutsch, Englisch, Französisch, Italienisch oder Spanisch.' } },
    pricing: { heading: 'Erst testen, dann lizenzieren.',
      a: { title: 'Testphase', price: 'kostenlos', sub: '14 Tage, alle Funktionen', li1: '· Eingehende und ausgehende Anrufe', li2: '· Alle Sicherheitsfunktionen', li3: '· Danach mit Lizenz weiter' },
      b: { title: 'Lizenz', price: 'auf Anfrage', sub: 'pro Installation', li1: '· Alle Funktionen', li2: '· Voraussetzung: AuraChat mit Telefonie-Lizenz' },
      note: 'Nach der Testphase nimmt Aura ohne gültige Lizenz keine Anrufe mehr an. Telefonkosten des SIP-Anbieters kommen hinzu. Preise auf Anfrage — wir erstellen gern ein Angebot.' }
  },
  en: {
    nav: 'AuraCall',
    hero: { title: 'Aura picks up the phone.', lead: 'AuraCall connects your phone number to AuraChat: Aura answers calls, understands what is said and replies by voice — on your own servers. On request, Aura also calls out, for example to pass on a message.' },
    features: { heading: 'A phone assistant that follows the rules.',
      f1: { title: 'Answering calls', desc: 'Aura greets callers, makes clear from the start that this is an AI, listens, answers questions and says goodbye. Interrupting mid-sentence works too.' },
      f2: { title: 'Your business knowledge', desc: 'Opening hours, prices, directions: you decide what Aura knows on the phone. If Aura does not know something, it says so honestly and offers a callback.' },
      f3: { title: 'Outgoing calls', desc: 'Aura calls numbers and passes on messages — immediately or at a scheduled time. Limits on countries, hours, call volume and premium-rate numbers prevent misuse and unexpected costs.' },
      f4: { title: 'Calls from AuraChat', desc: '“Call 079 … and tell her the room is ready” — by chat or microphone. AuraChat asks for confirmation first; only after “yes” is the call placed. Administrators only.' },
      f5: { title: 'Privacy &amp; security', desc: 'No audio recordings. Call transcripts only if you want them, deleted automatically. Two-factor sign-in, sign-in via AuraDirect and a privacy policy template.' },
      f6: { title: 'Operation &amp; languages', desc: 'Its own Asterisk in a Docker container, any SIP provider, management in the browser with call list, settings and licence. Speech recognition, answers and voice come from your own AuraChat. Phone language: German, English, French, Italian or Spanish.' } },
    pricing: { heading: 'Try first, then license.',
      a: { title: 'Trial', price: 'free', sub: '14 days, all features', li1: '· Incoming and outgoing calls', li2: '· All security features', li3: '· Continue afterwards with a licence' },
      b: { title: 'Licence', price: 'on request', sub: 'per installation', li1: '· All features', li2: '· Requires AuraChat with the telephony licence' },
      note: 'After the trial, Aura no longer answers calls without a valid licence. Phone charges from the SIP provider are extra. Prices on request — we are happy to prepare a quote.' }
  },
  fr: {
    nav: 'AuraCall',
    hero: { title: 'Aura décroche le téléphone.', lead: "AuraCall relie votre numéro de téléphone à AuraChat : Aura répond aux appels, comprend ce qui est dit et répond à voix haute — sur vos propres serveurs. Sur demande, Aura appelle aussi elle-même, par exemple pour transmettre un message." },
    features: { heading: 'Un assistant téléphonique qui respecte les règles.',
      f1: { title: 'Répondre aux appels', desc: "Aura accueille les appelants, précise dès le début qu'il s'agit d'une IA, écoute, répond aux questions et prend congé. Il est aussi possible de l'interrompre en pleine phrase." },
      f2: { title: 'Le savoir de votre entreprise', desc: "Horaires, tarifs, accès : vous décidez de ce qu'Aura sait au téléphone. Si Aura ne sait pas, elle le dit honnêtement et propose un rappel." },
      f3: { title: 'Appels sortants', desc: "Aura appelle des numéros et transmet des messages — tout de suite ou à une heure programmée. Des limites sur les pays, les horaires, le nombre d'appels et les numéros surtaxés évitent les abus et les coûts imprévus." },
      f4: { title: 'Appels depuis AuraChat', desc: "« Appelle le 079 … et dis-lui que la chambre est prête » — par chat ou au micro. AuraChat demande d'abord confirmation ; l'appel n'est passé qu'après « oui ». Réservé aux administrateurs." },
      f5: { title: 'Confidentialité &amp; sécurité', desc: "Aucun enregistrement audio. Transcriptions des appels uniquement si vous le souhaitez, supprimées automatiquement. Authentification à deux facteurs, connexion via AuraDirect et modèle de politique de confidentialité." },
      f6: { title: 'Exploitation &amp; langues', desc: "Son propre Asterisk dans un conteneur Docker, n'importe quel opérateur SIP, administration dans le navigateur avec liste d'appels, réglages et licence. Reconnaissance vocale, réponses et voix viennent de votre propre AuraChat. Langue au téléphone : allemand, anglais, français, italien ou espagnol." } },
    pricing: { heading: "D'abord tester, ensuite licencier.",
      a: { title: 'Essai', price: 'gratuit', sub: '14 jours, toutes les fonctions', li1: '· Appels entrants et sortants', li2: '· Toutes les fonctions de sécurité', li3: '· Ensuite, poursuite avec une licence' },
      b: { title: 'Licence', price: 'sur demande', sub: 'par installation', li1: '· Toutes les fonctions', li2: '· Prérequis : AuraChat avec la licence Téléphonie' },
      note: "Après la période d'essai, Aura ne répond plus aux appels sans licence valide. Les frais téléphoniques de l'opérateur SIP s'y ajoutent. Prix sur demande — nous établissons volontiers une offre." }
  },
  it: {
    nav: 'AuraCall',
    hero: { title: 'Aura risponde al telefono.', lead: "AuraCall collega il vostro numero di telefono ad AuraChat: Aura risponde alle chiamate, capisce ciò che viene detto e risponde a voce — sui vostri server. Su richiesta Aura chiama anche lei stessa, ad esempio per riferire un messaggio." },
    features: { heading: 'Un assistente telefonico che rispetta le regole.',
      f1: { title: 'Rispondere alle chiamate', desc: "Aura saluta chi chiama, chiarisce fin dall'inizio di essere un'IA, ascolta, risponde alle domande e saluta. Si può anche interromperla a metà frase." },
      f2: { title: 'Le conoscenze della vostra attività', desc: "Orari, prezzi, indicazioni stradali: decidete voi cosa sa Aura al telefono. Se Aura non sa qualcosa, lo dice onestamente e offre un richiamo." },
      f3: { title: 'Chiamate in uscita', desc: 'Aura chiama numeri e riferisce messaggi — subito o a un orario programmato. Limiti per paesi, orari, numero di chiamate e numeri a tariffa speciale evitano abusi e costi imprevisti.' },
      f4: { title: 'Chiamate da AuraChat', desc: '«Chiama lo 079 … e dille che la camera è pronta» — in chat o con il microfono. AuraChat chiede prima conferma; solo dopo il «sì» si chiama. Solo per amministratori.' },
      f5: { title: 'Privacy &amp; sicurezza', desc: "Nessuna registrazione audio. Trascrizioni delle chiamate solo se lo desiderate, eliminate automaticamente. Autenticazione a due fattori, accesso tramite AuraDirect e modello di informativa sulla privacy." },
      f6: { title: 'Esercizio &amp; lingue', desc: 'Asterisk proprio in un container Docker, qualsiasi provider SIP, gestione nel browser con elenco chiamate, impostazioni e licenza. Riconoscimento vocale, risposte e voce provengono dal vostro AuraChat. Lingua al telefono: tedesco, inglese, francese, italiano o spagnolo.' } },
    pricing: { heading: 'Prima provare, poi acquistare la licenza.',
      a: { title: 'Prova', price: 'gratuita', sub: '14 giorni, tutte le funzioni', li1: '· Chiamate in entrata e in uscita', li2: '· Tutte le funzioni di sicurezza', li3: '· Poi si prosegue con una licenza' },
      b: { title: 'Licenza', price: 'su richiesta', sub: 'per installazione', li1: '· Tutte le funzioni', li2: '· Requisito: AuraChat con la licenza Telefonia' },
      note: "Terminata la prova, senza licenza valida Aura non risponde più alle chiamate. I costi telefonici del provider SIP sono a parte. Prezzi su richiesta — prepariamo volentieri un'offerta." }
  },
  es: {
    nav: 'AuraCall',
    hero: { title: 'Aura contesta el teléfono.', lead: 'AuraCall conecta tu número de teléfono con AuraChat: Aura atiende las llamadas, entiende lo que se dice y responde con voz — en tus propios servidores. Si lo pides, Aura también llama ella misma, por ejemplo para dar un recado.' },
    features: { heading: 'Un asistente telefónico que cumple las reglas.',
      f1: { title: 'Atender llamadas', desc: 'Aura saluda a quien llama, aclara desde el principio que es una IA, escucha, responde preguntas y se despide. También se la puede interrumpir a mitad de frase.' },
      f2: { title: 'El conocimiento de tu negocio', desc: 'Horarios, precios, cómo llegar: tú decides lo que Aura sabe por teléfono. Si Aura no sabe algo, lo dice con honestidad y ofrece una llamada de vuelta.' },
      f3: { title: 'Llamadas salientes', desc: 'Aura llama a números y transmite mensajes — de inmediato o a una hora programada. Límites por países, horarios, número de llamadas y números de tarificación especial evitan abusos y costes inesperados.' },
      f4: { title: 'Llamadas desde AuraChat', desc: '«Llama al 079 … y dile que la habitación está lista» — por chat o con el micrófono. AuraChat pide confirmación antes; solo tras el «sí» se llama. Solo para administradores.' },
      f5: { title: 'Privacidad &amp; seguridad', desc: 'Sin grabaciones de audio. Transcripciones de las llamadas solo si lo deseas, con borrado automático. Autenticación en dos pasos, inicio de sesión mediante AuraDirect y una plantilla de política de privacidad.' },
      f6: { title: 'Funcionamiento &amp; idiomas', desc: 'Asterisk propio en un contenedor Docker, cualquier proveedor SIP, administración en el navegador con lista de llamadas, ajustes y licencia. Reconocimiento de voz, respuestas y voz vienen de tu propio AuraChat. Idioma por teléfono: alemán, inglés, francés, italiano o español.' } },
    pricing: { heading: 'Primero probar, después licenciar.',
      a: { title: 'Prueba', price: 'gratis', sub: '14 días, todas las funciones', li1: '· Llamadas entrantes y salientes', li2: '· Todas las funciones de seguridad', li3: '· Después se continúa con una licencia' },
      b: { title: 'Licencia', price: 'bajo consulta', sub: 'por instalación', li1: '· Todas las funciones', li2: '· Requisito: AuraChat con la licencia de telefonía' },
      note: 'Terminada la prueba, sin licencia válida Aura ya no atiende llamadas. Los costes telefónicos del proveedor SIP se suman. Precios bajo consulta — con gusto preparamos una oferta.' }
  }
};
products.auracall = { icon: '☎️', file: 'AuraCall', port: 8110, zip: null, noQuickstart: true, cardIcons: ['📞', '🧠', '📤', '💬', '🔒', '🛠️'],
  loginVal: { de: 'admin, Anfangspasswort steht im Programmprotokoll', en: 'admin, initial password is in the program log', fr: "admin, mot de passe initial dans le journal du programme", it: 'admin, la password iniziale è nel registro del programma', es: 'admin, la contraseña inicial está en el registro del programa' },
  ...Object.fromEntries(LANGS.map(l => [l, T[l]])) };
const TRIAL = {
  de: { title: 'Testversion &amp; Beratung', desc: 'AuraCall erhaltet ihr auf Anfrage für die 14-tägige Testphase.', button: 'Anfrage senden' },
  en: { title: 'Trial &amp; consultation', desc: 'AuraCall is provided on request for the 14-day trial.', button: 'Send a request' },
  fr: { title: 'Essai &amp; conseil', desc: "AuraCall est fourni sur demande pour la période d'essai de 14 jours.", button: 'Envoyer une demande' },
  it: { title: 'Prova &amp; consulenza', desc: 'AuraCall viene fornito su richiesta per il periodo di prova di 14 giorni.', button: 'Invia una richiesta' },
  es: { title: 'Prueba &amp; asesoramiento', desc: 'AuraCall se facilita bajo petición para el periodo de prueba de 14 días.', button: 'Enviar una solicitud' }
};
for (const l of LANGS) DOWNLOADS[l].trial = TRIAL[l];

// ---------------------------------------------------------------- 2) Gemeinsame Texte
const NEWCARDS = {
  de: { hotel: { title: 'Hotel &amp; Gäste', desc: 'Anbindung an Apaleo: Mitarbeitende fragen Anreisen, Abreisen, Gäste im Haus und Zimmerzustand per Chat ab. Gäste sehen im Gastmodus nur ihre eigene Reservierung. Check-in, Check-out und Zimmerzuweisung gibt es optional, immer mit Bestätigung. Housekeeping-Meldungen werden zu Tickets in AuraTicket.' },
        phone: { title: 'Aura am Telefon', desc: 'Mit AuraCall nimmt Aura Anrufe entgegen und ruft auf Wunsch selbst an. Auslösen lässt sich ein Anruf auch per Chat oder Sprachbefehl: „Ruf … an und sag ihr …“, mit Rückfrage vor jedem Anruf.' },
        screen: { title: 'Kiosk &amp; Bildschirmformat', desc: 'Quer- oder Hochformat, in 90°-Schritten drehbar, mit gängigen Seitenverhältnissen und Auflösungen — für Wandbildschirm, Rezeption oder Empfang.' } },
  en: { hotel: { title: 'Hotels &amp; guests', desc: 'Connection to Apaleo: staff ask about arrivals, departures, in-house guests and room status by chat. Guests see only their own reservation in guest mode. Check-in, check-out and room assignment are optional and always need confirmation. Housekeeping reports become tickets in AuraTicket.' },
        phone: { title: 'Aura on the phone', desc: 'With AuraCall, Aura answers calls and calls out on request. A call can also be started by chat or voice command: “Call … and tell her …”, with a confirmation before every call.' },
        screen: { title: 'Kiosk &amp; screen format', desc: 'Landscape or portrait, rotatable in 90° steps, with common aspect ratios and resolutions — for wall displays, reception desks or lobbies.' } },
  fr: { hotel: { title: 'Hôtel &amp; clients', desc: "Liaison avec Apaleo : le personnel interroge par chat les arrivées, départs, clients présents et l'état des chambres. Les clients ne voient, en mode invité, que leur propre réservation. Check-in, check-out et attribution de chambre sont facultatifs et toujours soumis à confirmation. Les signalements de housekeeping deviennent des tickets dans AuraTicket." },
        phone: { title: 'Aura au téléphone', desc: "Avec AuraCall, Aura répond aux appels et appelle elle-même sur demande. Un appel peut aussi être déclenché par chat ou commande vocale : « Appelle … et dis-lui … », avec confirmation avant chaque appel." },
        screen: { title: "Kiosque &amp; format d'écran", desc: "Paysage ou portrait, rotation par pas de 90°, avec les formats et résolutions courants — pour écran mural, réception ou accueil." } },
  it: { hotel: { title: 'Hotel &amp; ospiti', desc: 'Collegamento con Apaleo: il personale chiede in chat arrivi, partenze, ospiti presenti e stato delle camere. Gli ospiti vedono, in modalità ospite, solo la propria prenotazione. Check-in, check-out e assegnazione delle camere sono opzionali e richiedono sempre una conferma. Le segnalazioni di housekeeping diventano ticket in AuraTicket.' },
        phone: { title: 'Aura al telefono', desc: 'Con AuraCall Aura risponde alle chiamate e, su richiesta, chiama a sua volta. Una chiamata si può avviare anche in chat o con un comando vocale: «Chiama … e dille …», con una conferma prima di ogni chiamata.' },
        screen: { title: 'Chiosco &amp; formato schermo', desc: "Orizzontale o verticale, ruotabile a passi di 90°, con i rapporti d'aspetto e le risoluzioni più comuni — per schermi a parete, reception o ingresso." } },
  es: { hotel: { title: 'Hotel &amp; huéspedes', desc: 'Conexión con Apaleo: el personal consulta por chat llegadas, salidas, huéspedes en el hotel y estado de las habitaciones. Los huéspedes ven en modo invitado solo su propia reserva. Check-in, check-out y asignación de habitación son opcionales y siempre requieren confirmación. Los avisos de housekeeping se convierten en tickets de AuraTicket.' },
        phone: { title: 'Aura por teléfono', desc: 'Con AuraCall, Aura atiende llamadas y, si lo pides, llama ella misma. Una llamada también se puede iniciar por chat o comando de voz: «Llama a … y dile …», con confirmación antes de cada llamada.' },
        screen: { title: 'Quiosco &amp; formato de pantalla', desc: 'Horizontal o vertical, girable en pasos de 90°, con las proporciones y resoluciones habituales — para pantallas de pared, recepción o entrada.' } }
};
const MEMORY = {
  de: 'Merkt sich relevante Fakten automatisch und erinnert sich im selben Chat an hochgeladene Bilder und Dokumente. Jede Person kann Auras Charakter für ihr eigenes Konto frei gestalten. Täglicher Rückblick auf Wunsch.',
  en: "Automatically remembers relevant facts, and recalls uploaded images and documents later in the same chat. Each person can freely shape Aura's character for their own account. Daily recap on request.",
  fr: "Retient automatiquement les faits pertinents et se souvient, dans le même chat, des images et documents envoyés. Chaque personne peut personnaliser librement le caractère d'Aura pour son propre compte. Résumé quotidien sur demande.",
  it: 'Ricorda automaticamente i fatti rilevanti e, nella stessa chat, anche immagini e documenti caricati. Ogni persona può personalizzare liberamente il carattere di Aura per il proprio account. Riepilogo giornaliero su richiesta.',
  es: 'Recuerda automáticamente datos relevantes y, en el mismo chat, también las imágenes y documentos subidos. Cada persona puede personalizar libremente el carácter de Aura para su propia cuenta. Resumen diario bajo petición.'
};
const OPSADD = {
  de: ' Das Cockpit zeigt Prozessor, Speicher, Speicherplatz und Docker-Container als Ampel, optional mit täglichem Schwachstellen-Scan.',
  en: ' The Cockpit shows processor, memory, disk space and Docker containers as a traffic light, optionally with a daily vulnerability scan.',
  fr: " Le Cockpit affiche processeur, mémoire, espace disque et conteneurs Docker sous forme de feu tricolore, avec en option une analyse quotidienne des vulnérabilités.",
  it: ' Il Cockpit mostra processore, memoria, spazio su disco e container Docker con un semaforo, opzionalmente con scansione giornaliera delle vulnerabilità.',
  es: ' El Cockpit muestra procesador, memoria, espacio en disco y contenedores Docker como un semáforo, opcionalmente con un análisis diario de vulnerabilidades.'
};
const CMDADD = { de: ' — und mit AuraCall Telefonate auslösen.', en: ' — and start phone calls with AuraCall.', fr: ' — et déclencher des appels téléphoniques avec AuraCall.', it: ' — e avviare telefonate con AuraCall.', es: ' — y iniciar llamadas telefónicas con AuraCall.' };
const PHONEOLD = {
  de: 'Telefonanlage (FreePBX, 3CX) schon im Haus? Verbindungsskripte zum Selbst-Einrichten, mit Aura am Telefon sprechen. Ohne eigene Anlage bringt AuraCall alles mit (siehe Produkte). Premium-Feature.',
  en: 'Already have a phone system (FreePBX, 3CX)? Connector scripts to set up yourself — talk to Aura on the phone. Without a system of your own, AuraCall brings everything (see Products). Premium feature.',
  fr: "Déjà un autocommutateur (FreePBX, 3CX) ? Scripts de connexion à installer soi-même — parlez à Aura au téléphone. Sans installation propre, AuraCall apporte tout (voir Produits). Fonction Premium.",
  it: 'Avete già un centralino (FreePBX, 3CX)? Script di connessione da configurare in autonomia — parla con Aura al telefono. Senza centralino proprio, AuraCall include tutto (vedi Prodotti). Funzione Premium.',
  es: '¿Ya tienes una centralita (FreePBX, 3CX)? Scripts de conexión para configurar tú mismo — habla con Aura por teléfono. Sin centralita propia, AuraCall lo incluye todo (ver Productos). Función Premium.'
};
const ECO = {
  de: { lead: 'AuraChat ist der Mittelpunkt — dazu kommen eigenständige Produkte für Zeiterfassung, Tickets, Mail, Telefon, Benutzerverwaltung und den sicheren Zugang von aussen. Einzeln nutzbar, gemeinsam am stärksten.', apps: 'AuraChat, AuraPlan, AuraTicket, AuraCall — mit Testphase; die ersten drei zusätzlich mit kostenloser Basisstufe.', card: 'Aura am Telefon: Anrufe annehmen und selbst anrufen.' },
  en: { lead: 'AuraChat is the centre — alongside it come standalone products for time tracking, tickets, mail, telephone, user management and secure access from outside. Usable on their own, strongest together.', apps: 'AuraChat, AuraPlan, AuraTicket, AuraCall — with a trial period; the first three also with a free basic tier.', card: 'Aura on the phone: answers incoming calls and calls out.' },
  fr: { lead: "AuraChat est le centre — viennent s'y ajouter des produits autonomes pour la saisie du temps, les tickets, la messagerie, le téléphone, la gestion des utilisateurs et l'accès sécurisé depuis l'extérieur. Utilisables seuls, plus forts ensemble.", apps: "AuraChat, AuraPlan, AuraTicket, AuraCall — avec une période d'essai ; les trois premiers aussi avec un niveau de base gratuit.", card: 'Aura au téléphone : répond aux appels et appelle elle-même.' },
  it: { lead: "AuraChat è il centro — a esso si aggiungono prodotti autonomi per la rilevazione delle ore, i ticket, la posta, il telefono, la gestione utenti e l'accesso sicuro dall'esterno. Utilizzabili da soli, più forti insieme.", apps: 'AuraChat, AuraPlan, AuraTicket, AuraCall — con un periodo di prova; i primi tre anche con un livello base gratuito.', card: 'Aura al telefono: risponde alle chiamate e chiama a sua volta.' },
  es: { lead: 'AuraChat es el centro — a su lado hay productos independientes para el control horario, tickets, correo, teléfono, gestión de usuarios y acceso seguro desde fuera. Utilizables por separado, más fuertes juntos.', apps: 'AuraChat, AuraPlan, AuraTicket, AuraCall — con un periodo de prueba; los tres primeros también con un nivel básico gratuito.', card: 'Aura por teléfono: atiende llamadas y también llama.' }
};
const AND = { de: [' und AuraProxy', ', AuraProxy und AuraCall'], en: [' and AuraProxy', ', AuraProxy and AuraCall'], fr: [' et AuraProxy', ', AuraProxy et AuraCall'], it: [' e AuraProxy', ', AuraProxy e AuraCall'], es: [' y AuraProxy', ', AuraProxy y AuraCall'] };
const INTEG = { de: ['Smart-Home-Steuerung (IKEA, Nuki, Sonos, eigene Geräte), Anbindung', 'Smart-Home-Steuerung (IKEA, Nuki, Sonos, eigene Geräte), Hotel-Software Apaleo, Anbindung'], en: ['Smart-home control (IKEA, Nuki, Sonos, custom devices), connection', 'Smart-home control (IKEA, Nuki, Sonos, custom devices), hotel software Apaleo, connection'], fr: ['Domotique (IKEA, Nuki, Sonos, appareils personnalisés), liaison', 'Domotique (IKEA, Nuki, Sonos, appareils personnalisés), logiciel hôtelier Apaleo, liaison'], it: ['Controllo smart home (IKEA, Nuki, Sonos, dispositivi personalizzati), collegamento', 'Controllo smart home (IKEA, Nuki, Sonos, dispositivi personalizzati), software alberghiero Apaleo, collegamento'], es: ['Control del hogar inteligente (IKEA, Nuki, Sonos, dispositivos propios), conexión', 'Control del hogar inteligente (IKEA, Nuki, Sonos, dispositivos propios), software hotelero Apaleo, conexión'] };
const INTEG_AND = { de: [' AuraTicket und AuraMail', ' AuraTicket, AuraMail und AuraCall'], en: [' AuraTicket and AuraMail', ' AuraTicket, AuraMail and AuraCall'], fr: [' AuraTicket et AuraMail', ' AuraTicket, AuraMail et AuraCall'], it: [' AuraTicket e AuraMail', ' AuraTicket, AuraMail e AuraCall'], es: [' AuraTicket y AuraMail', ' AuraTicket, AuraMail y AuraCall'] };
const rep1 = (s, [a, b], what) => { if (!s.includes(a)) throw new Error('Textstelle nicht gefunden (' + what + '): ' + a); return s.replace(a, b); };
const SEO = {
  de: 'Selbst gehosteter KI-Assistent mit Avatar, Stimme, Gedächtnis. Ollama, Websuche, Microsoft 365, Telefon, Apaleo. Kostenlos starten, Daten bleiben bei euch.'
};
for (const l of LANGS) {
  const s = shared[l];
  s.ecosystem.lead = ECO[l].lead; s.ecosystem.apps.sub = ECO[l].apps; s.ecosystem.auracall = ECO[l].card;
  s.newCards = NEWCARDS[l]; s.memoryDesc = MEMORY[l]; s.opsAdd = OPSADD[l]; s.phoneOld = PHONEOLD[l];
  s.commands.desc = s.commands.desc.replace(/\.$/, '') + CMDADD[l];
  s.auradirect.heroLead = rep1(s.auradirect.heroLead, AND[l], 'AuraDirect');
  s.integrationsDesc = rep1(rep1(s.integrationsDesc, INTEG[l], 'Integrationen'), INTEG_AND[l], 'Integrationen-Produkte');
}
shared.seo = SEO;
module.exports = { products, shared, DOWNLOADS, LANGS };
