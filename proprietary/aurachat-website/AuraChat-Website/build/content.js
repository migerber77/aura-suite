// Gemeinsame Textquelle: daraus entstehen Website-Übersetzungen UND die Datenblätter.
// Hinweis: In Texten steht &amp; für "&" (die Website setzt sie per innerHTML ein).
// Die Datenblatt-Erzeugung wandelt das wieder in ein normales "&" um.

const NOTE = {
  de: 'Alle Preise sind Richtwerte exkl. MwSt.',
  en: 'All prices are indicative, excl. VAT.',
  fr: 'Tous les prix sont indicatifs, hors TVA.',
  it: 'Tutti i prezzi sono indicativi, IVA esclusa.',
  es: 'Todos los precios son orientativos, sin IVA.'
};

const DOWNLOADS = {
  de: { heading: 'Anleitung herunterladen', sheet: { title: 'Datenblatt &amp; Anleitung', desc: 'Funktionsübersicht, Einrichtung und Preise auf einen Blick.' }, quickstart: { title: 'Quickstart-Paket', desc: 'Fertige Docker-Images von Docker Hub — ein Befehl, läuft.', button: '⬇ Quickstart-Paket herunterladen' } },
  en: { heading: 'Download the guide', sheet: { title: 'Datasheet &amp; Guide', desc: 'Feature overview, setup and pricing at a glance.' }, quickstart: { title: 'Quickstart Package', desc: 'Ready-made Docker images from Docker Hub — one command, running.', button: '⬇ Download Quickstart Package' } },
  fr: { heading: 'Télécharger le guide', sheet: { title: 'Fiche produit &amp; Guide', desc: "Aperçu des fonctionnalités, configuration et tarifs en un coup d'œil." }, quickstart: { title: 'Paquet de démarrage rapide', desc: "Images Docker prêtes à l'emploi depuis Docker Hub — une commande, ça tourne.", button: '⬇ Télécharger le paquet' } },
  it: { heading: 'Scarica la guida', sheet: { title: 'Scheda prodotto e Guida', desc: "Panoramica delle funzionalità, configurazione e prezzi a colpo d'occhio." }, quickstart: { title: 'Pacchetto Quickstart', desc: 'Immagini Docker già pronte da Docker Hub — un comando, è attivo.', button: '⬇ Scarica il pacchetto' } },
  es: { heading: 'Descargar la guía', sheet: { title: 'Ficha de producto y Guía', desc: 'Resumen de funciones, configuración y precios de un vistazo.' }, quickstart: { title: 'Paquete de inicio rápido', desc: 'Imágenes Docker listas desde Docker Hub — un comando, en marcha.', button: '⬇ Descargar paquete' } }
};

// ---------- Preisblock "Dienst" (AuraMail, AuraProxy): kostenlos bis 4 Konten oder ab 2 verbundenen Anwendungen ----------
const SERVICE_PRICING = {
  de: { heading: 'Kostenlos in Kombination.', a: { title: 'Inklusive', price: 'kostenlos', sub: 'bis 4 Benutzer, oder sobald mindestens zwei Aura-Anwendungen verbunden sind', li1: '· Alle Funktionen', li2: 'LI2', li3: '· Zentrale Anmeldung &amp; 2FA' }, b: { title: 'Eigenständig', price: 'CHF 15.–', sub: 'pro Installation / Mt.', li1: '· Alle Funktionen', li2: '· Ohne weitere Aura-Anwendung' } },
  en: { heading: 'Free when combined.', a: { title: 'Included', price: 'free', sub: 'up to 4 users, or as soon as at least two Aura applications are connected', li1: '· All features', li2: 'LI2', li3: '· Central login &amp; 2FA' }, b: { title: 'Standalone', price: 'CHF 15.–', sub: 'per installation / mo.', li1: '· All features', li2: '· Without another Aura application' } },
  fr: { heading: 'Gratuit en combinaison.', a: { title: 'Inclus', price: 'gratuit', sub: "jusqu'à 4 utilisateurs, ou dès que deux applications Aura au moins sont connectées", li1: '· Toutes les fonctionnalités', li2: 'LI2', li3: '· Connexion centrale et 2FA' }, b: { title: 'Autonome', price: 'CHF 15.–', sub: 'par installation / mois', li1: '· Toutes les fonctionnalités', li2: '· Sans autre application Aura' } },
  it: { heading: 'Gratuito in combinazione.', a: { title: 'Incluso', price: 'gratuito', sub: 'fino a 4 utenti, oppure non appena sono collegate almeno due applicazioni Aura', li1: '· Tutte le funzionalità', li2: 'LI2', li3: '· Accesso centrale e 2FA' }, b: { title: 'Indipendente', price: 'CHF 15.–', sub: 'per installazione / mese', li1: '· Tutte le funzionalità', li2: '· Senza altra applicazione Aura' } },
  es: { heading: 'Gratis en combinación.', a: { title: 'Incluido', price: 'gratis', sub: 'hasta 4 usuarios, o en cuanto haya al menos dos aplicaciones Aura conectadas', li1: '· Todas las funciones', li2: 'LI2', li3: '· Acceso central y 2FA' }, b: { title: 'Independiente', price: 'CHF 15.–', sub: 'por instalación / mes', li1: '· Todas las funciones', li2: '· Sin otra aplicación Aura' } }
};
function servicePricing(lang, li2) {
  const p = JSON.parse(JSON.stringify(SERVICE_PRICING[lang]));
  p.a.li2 = p.a.li2.replace('LI2', li2);
  p.note = NOTE[lang];
  return p;
}

const products = {
  // =====================================================================================
  auramail: {
    icon: '📬', file: 'AuraMail', port: 3300, zip: 'auramail-quickstart.zip',
    cardIcons: ['✉️', '☁️', '👥', '🔑', '🗣️', '🎫'],
    de: {
      nav: 'AuraMail',
      hero: { title: 'Euer eigener Mailserver — verbunden mit allem, was ihr schon nutzt.', lead: 'AuraMail verwaltet persönliche und geteilte Postfächer auf eurer Infrastruktur — wahlweise mit eigenem Mailserver, Microsoft 365 oder bestehenden IMAP/SMTP-Konten. Nahtlos verbunden mit AuraChat, AuraTicket und AuraDirect.' },
      features: { heading: 'Eine Oberfläche für alle Postfächer.',
        f1: { title: 'Drei Anbindungen', desc: 'Eigener Mailserver, Microsoft 365 (Graph) oder externe IMAP/SMTP-Konten — pro Installation wählbar.' },
        f2: { title: 'Microsoft-365-Konten übernehmen', desc: 'Konten und geteilte Postfächer direkt aus eurem Microsoft-365-Verzeichnis anzeigen, ankreuzen und als Postfächer übernehmen — ohne Abtippen.' },
        f3: { title: 'Persönlich &amp; geteilt', desc: 'Persönliche Postfächer pro Person, geteilte Postfächer (z.B. info@) mit frei wählbarem Zugriff für ganze Teams.' },
        f4: { title: 'Zentrale Anmeldung', desc: 'Anmeldung mit dem AuraDirect-Konto, inklusive zentraler Zwei-Faktor-Authentifizierung. Personen werden automatisch aus AuraDirect übernommen — ohne dass sie sich vorher anmelden müssen.' },
        f5: { title: 'Mails per Sprache', desc: 'In AuraChat diktieren: „Aura, verfasse mir bitte ein Mail an …“ — AuraChat schreibt den Entwurf und sendet erst nach eurem „ja“.' },
        f6: { title: 'Ticket-Anbindung', desc: 'Über die offene Schnittstelle macht AuraTicket aus eingehenden Mails Tickets und sendet Antworten über das richtige Postfach.' } },
      pricing: servicePricing('de', '· Eigener Server, Microsoft 365 oder IMAP/SMTP')
    },
    en: {
      nav: 'AuraMail',
      hero: { title: 'Your own mail server — connected to everything you already use.', lead: 'AuraMail manages personal and shared mailboxes on your own infrastructure — with its own mail server, Microsoft 365 or existing IMAP/SMTP accounts. Seamlessly connected to AuraChat, AuraTicket and AuraDirect.' },
      features: { heading: 'One interface for all mailboxes.',
        f1: { title: 'Three connection modes', desc: 'Own mail server, Microsoft 365 (Graph) or external IMAP/SMTP accounts — selectable per installation.' },
        f2: { title: 'Import Microsoft 365 accounts', desc: 'Show accounts and shared mailboxes straight from your Microsoft 365 directory, tick them and add them as mailboxes — no retyping.' },
        f3: { title: 'Personal &amp; shared', desc: 'Personal mailboxes per person, shared mailboxes (e.g. info@) with freely selectable access for whole teams.' },
        f4: { title: 'Central login', desc: 'Sign in with your AuraDirect account, including central two-factor authentication. People are imported from AuraDirect automatically — without having to log in first.' },
        f5: { title: 'Mail by voice', desc: 'Dictate in AuraChat: “Aura, write me an email to …” — AuraChat drafts it and only sends after your “yes”.' },
        f6: { title: 'Ticket integration', desc: 'Through the open interface, AuraTicket turns incoming mail into tickets and sends replies via the right mailbox.' } },
      pricing: servicePricing('en', '· Own server, Microsoft 365 or IMAP/SMTP')
    },
    fr: {
      nav: 'AuraMail',
      hero: { title: 'Votre propre serveur de messagerie — relié à tout ce que vous utilisez déjà.', lead: "AuraMail gère des boîtes aux lettres personnelles et partagées sur votre propre infrastructure — avec son propre serveur de messagerie, Microsoft 365 ou des comptes IMAP/SMTP existants. Connecté de façon transparente à AuraChat, AuraTicket et AuraDirect." },
      features: { heading: 'Une seule interface pour toutes les boîtes aux lettres.',
        f1: { title: 'Trois modes de connexion', desc: 'Serveur de messagerie propre, Microsoft 365 (Graph) ou comptes IMAP/SMTP externes — au choix par installation.' },
        f2: { title: 'Reprendre les comptes Microsoft 365', desc: 'Afficher les comptes et boîtes partagées directement depuis votre annuaire Microsoft 365, les cocher et les ajouter comme boîtes aux lettres — sans ressaisie.' },
        f3: { title: 'Personnelles et partagées', desc: 'Boîtes personnelles par personne, boîtes partagées (p. ex. info@) avec accès librement défini pour des équipes entières.' },
        f4: { title: 'Connexion centrale', desc: "Connexion avec le compte AuraDirect, y compris l'authentification à deux facteurs centralisée. Les personnes sont reprises automatiquement depuis AuraDirect — sans devoir se connecter au préalable." },
        f5: { title: 'E-mails par la voix', desc: "Dictez dans AuraChat : « Aura, écris-moi un e-mail à … » — AuraChat rédige le brouillon et n'envoie qu'après votre « oui »." },
        f6: { title: 'Liaison avec les tickets', desc: "Via l'interface ouverte, AuraTicket transforme les e-mails entrants en tickets et envoie les réponses depuis la bonne boîte." } },
      pricing: servicePricing('fr', '· Serveur propre, Microsoft 365 ou IMAP/SMTP')
    },
    it: {
      nav: 'AuraMail',
      hero: { title: 'Il vostro server di posta — collegato a tutto ciò che già usate.', lead: 'AuraMail gestisce caselle personali e condivise sulla vostra infrastruttura — con un proprio server di posta, Microsoft 365 o account IMAP/SMTP esistenti. Collegato senza interruzioni ad AuraChat, AuraTicket e AuraDirect.' },
      features: { heading: "Un'unica interfaccia per tutte le caselle.",
        f1: { title: 'Tre modalità di collegamento', desc: 'Server di posta proprio, Microsoft 365 (Graph) o account IMAP/SMTP esterni — a scelta per ogni installazione.' },
        f2: { title: 'Importare gli account Microsoft 365', desc: 'Mostrare account e caselle condivise direttamente dalla vostra directory Microsoft 365, selezionarli e aggiungerli come caselle — senza riscrivere nulla.' },
        f3: { title: 'Personali e condivise', desc: 'Caselle personali per ogni persona, caselle condivise (ad es. info@) con accesso liberamente definibile per interi team.' },
        f4: { title: 'Accesso centrale', desc: "Accesso con l'account AuraDirect, inclusa l'autenticazione a due fattori centralizzata. Le persone vengono importate automaticamente da AuraDirect — senza dover accedere prima." },
        f5: { title: 'E-mail a voce', desc: "Dettate in AuraChat: «Aura, scrivimi un'e-mail a …» — AuraChat prepara la bozza e la invia solo dopo il vostro «sì»." },
        f6: { title: 'Collegamento ai ticket', desc: "Tramite l'interfaccia aperta, AuraTicket trasforma le e-mail in arrivo in ticket e invia le risposte dalla casella giusta." } },
      pricing: servicePricing('it', '· Server proprio, Microsoft 365 o IMAP/SMTP')
    },
    es: {
      nav: 'AuraMail',
      hero: { title: 'Tu propio servidor de correo — conectado con todo lo que ya usas.', lead: 'AuraMail gestiona buzones personales y compartidos en tu propia infraestructura — con servidor de correo propio, Microsoft 365 o cuentas IMAP/SMTP existentes. Conectado sin fisuras con AuraChat, AuraTicket y AuraDirect.' },
      features: { heading: 'Una sola interfaz para todos los buzones.',
        f1: { title: 'Tres modos de conexión', desc: 'Servidor de correo propio, Microsoft 365 (Graph) o cuentas IMAP/SMTP externas — a elegir por instalación.' },
        f2: { title: 'Importar cuentas de Microsoft 365', desc: 'Mostrar cuentas y buzones compartidos directamente desde tu directorio de Microsoft 365, marcarlos y añadirlos como buzones — sin reescribir nada.' },
        f3: { title: 'Personales y compartidos', desc: 'Buzones personales por persona, buzones compartidos (p. ej. info@) con acceso configurable para equipos enteros.' },
        f4: { title: 'Inicio de sesión central', desc: 'Acceso con la cuenta de AuraDirect, incluida la autenticación en dos pasos centralizada. Las personas se importan automáticamente desde AuraDirect — sin tener que iniciar sesión antes.' },
        f5: { title: 'Correo por voz', desc: 'Dicta en AuraChat: «Aura, escríbeme un correo a …» — AuraChat redacta el borrador y solo lo envía tras tu «sí».' },
        f6: { title: 'Conexión con tickets', desc: 'A través de la interfaz abierta, AuraTicket convierte los correos entrantes en tickets y envía las respuestas desde el buzón correcto.' } },
      pricing: servicePricing('es', '· Servidor propio, Microsoft 365 o IMAP/SMTP')
    }
  },

  // =====================================================================================
  auraticket: {
    icon: '🎫', file: 'AuraTicket', port: 3400, zip: 'auraticket-quickstart.zip',
    cardIcons: ['📥', '💬', '📣', '🗣️', '🔑', '🛠️'],
    de: {
      nav: 'AuraTicket',
      hero: { title: 'Support-Tickets aus euren E-Mails — und AuraChat sagt euch Bescheid.', lead: 'AuraTicket macht aus eingehenden E-Mails Tickets, die ihr im Team bearbeitet und beantwortet. Verbunden mit AuraMail für den Versand und mit AuraChat, damit ihr Tickets per Sprache steuern könnt.' },
      features: { heading: 'Vom Posteingang zum gelösten Ticket.',
        f1: { title: 'E-Mail wird Ticket', desc: 'Eingehende Mails an ein Support-Postfach werden automatisch zu Tickets. Antworten auf bestehende Tickets werden über die Ticketnummer im Betreff zugeordnet.' },
        f2: { title: 'Antworten &amp; interne Notizen', desc: 'Der Kundschaft per E-Mail antworten oder intern Notizen festhalten. Status, Priorität und Zuständigkeit pro Ticket.' },
        f3: { title: 'Massenmail-Kampagnen', desc: 'Mails an eine CSV-Liste senden, mit persönlicher Anrede und gedrosseltem Versand im Hintergrund.' },
        f4: { title: 'Steuerung per AuraChat', desc: '„Wie viele Tickets sind offen?“, „Schliess Ticket T-00001“, „Antworte auf Ticket …“ — und neue Tickets werden euch vorgelesen.' },
        f5: { title: 'Zentrale Anmeldung', desc: 'Anmeldung mit dem AuraDirect-Konto, inklusive zentraler Zwei-Faktor-Authentifizierung.' },
        f6: { title: 'Administration', desc: 'Benutzerverwaltung, Backup &amp; Wiederherstellung, Lizenzverwaltung mit Testphase.' } },
      pricing: { heading: 'Klein starten, mit dem Team wachsen.', a: { title: 'Basis', price: 'kostenlos', sub: 'bis 3 Agent:innen / 1 Administrator:in', li1: '· Tickets aus E-Mails', li2: '· Antworten &amp; interne Notizen', li3: '· Steuerung per AuraChat' }, b: { title: 'Erweitert', price: 'auf Anfrage', sub: 'mehr Agent:innen und Administrator:innen', li1: '· Alle Funktionen', li2: '· Obergrenzen pro Lizenzschlüssel' }, note: '14 Tage Testphase. Preise auf Anfrage — wir erstellen gern ein Angebot.' }
    },
    en: {
      nav: 'AuraTicket',
      hero: { title: 'Support tickets from your emails — and AuraChat keeps you posted.', lead: 'AuraTicket turns incoming emails into tickets that your team handles and answers. Connected to AuraMail for sending and to AuraChat so you can control tickets by voice.' },
      features: { heading: 'From inbox to solved ticket.',
        f1: { title: 'Email becomes ticket', desc: 'Incoming mail to a support mailbox automatically becomes a ticket. Replies to existing tickets are matched via the ticket number in the subject.' },
        f2: { title: 'Replies &amp; internal notes', desc: 'Answer customers by email or keep internal notes. Status, priority and assignee per ticket.' },
        f3: { title: 'Bulk mail campaigns', desc: 'Send mail to a CSV list, with a personal greeting and throttled background sending.' },
        f4: { title: 'Control via AuraChat', desc: '“How many tickets are open?”, “Close ticket T-00001”, “Reply to ticket …” — and new tickets are read out to you.' },
        f5: { title: 'Central login', desc: 'Sign in with your AuraDirect account, including central two-factor authentication.' },
        f6: { title: 'Administration', desc: 'User management, backup &amp; restore, license management with trial period.' } },
      pricing: { heading: 'Start small, grow with your team.', a: { title: 'Basic', price: 'free', sub: 'up to 3 agents / 1 administrator', li1: '· Tickets from email', li2: '· Replies &amp; internal notes', li3: '· Control via AuraChat' }, b: { title: 'Extended', price: 'on request', sub: 'more agents and administrators', li1: '· All features', li2: '· Limits set per license key' }, note: '14-day trial. Prices on request — we are happy to prepare a quote.' }
    },
    fr: {
      nav: 'AuraTicket',
      hero: { title: "Des tickets de support à partir de vos e-mails — et AuraChat vous tient au courant.", lead: "AuraTicket transforme les e-mails entrants en tickets que votre équipe traite et auxquels elle répond. Relié à AuraMail pour l'envoi et à AuraChat pour piloter les tickets par la voix." },
      features: { heading: 'De la boîte de réception au ticket résolu.',
        f1: { title: "L'e-mail devient ticket", desc: "Les e-mails reçus sur une boîte de support deviennent automatiquement des tickets. Les réponses aux tickets existants sont rattachées grâce au numéro de ticket dans l'objet." },
        f2: { title: 'Réponses et notes internes', desc: 'Répondre aux clients par e-mail ou consigner des notes internes. Statut, priorité et responsable par ticket.' },
        f3: { title: "Campagnes d'e-mails", desc: "Envoyer des e-mails à une liste CSV, avec une formule d'appel personnalisée et un envoi échelonné en arrière-plan." },
        f4: { title: 'Pilotage via AuraChat', desc: '« Combien de tickets sont ouverts ? », « Ferme le ticket T-00001 », « Réponds au ticket … » — et les nouveaux tickets vous sont lus à voix haute.' },
        f5: { title: 'Connexion centrale', desc: "Connexion avec le compte AuraDirect, y compris l'authentification à deux facteurs centralisée." },
        f6: { title: 'Administration', desc: 'Gestion des utilisateurs, sauvegarde et restauration, gestion des licences avec période d\'essai.' } },
      pricing: { heading: "Démarrer petit, grandir avec l'équipe.", a: { title: 'Base', price: 'gratuit', sub: "jusqu'à 3 agents / 1 administrateur", li1: "· Tickets à partir d'e-mails", li2: '· Réponses et notes internes', li3: '· Pilotage via AuraChat' }, b: { title: 'Étendu', price: 'sur demande', sub: "plus d'agents et d'administrateurs", li1: '· Toutes les fonctionnalités', li2: '· Limites définies par clé de licence' }, note: "14 jours d'essai. Prix sur demande — nous établissons volontiers une offre." }
    },
    it: {
      nav: 'AuraTicket',
      hero: { title: 'Ticket di supporto dalle vostre e-mail — e AuraChat vi tiene aggiornati.', lead: "AuraTicket trasforma le e-mail in arrivo in ticket che il vostro team gestisce e a cui risponde. Collegato ad AuraMail per l'invio e ad AuraChat per controllare i ticket a voce." },
      features: { heading: 'Dalla posta in arrivo al ticket risolto.',
        f1: { title: "L'e-mail diventa ticket", desc: "Le e-mail in arrivo su una casella di supporto diventano automaticamente ticket. Le risposte ai ticket esistenti vengono assegnate tramite il numero di ticket nell'oggetto." },
        f2: { title: 'Risposte e note interne', desc: 'Rispondere ai clienti via e-mail o annotare note interne. Stato, priorità e responsabile per ogni ticket.' },
        f3: { title: 'Campagne e-mail', desc: 'Inviare e-mail a un elenco CSV, con saluto personalizzato e invio scaglionato in background.' },
        f4: { title: 'Controllo tramite AuraChat', desc: '«Quanti ticket sono aperti?», «Chiudi il ticket T-00001», «Rispondi al ticket …» — e i nuovi ticket vi vengono letti ad alta voce.' },
        f5: { title: 'Accesso centrale', desc: "Accesso con l'account AuraDirect, inclusa l'autenticazione a due fattori centralizzata." },
        f6: { title: 'Amministrazione', desc: 'Gestione utenti, backup e ripristino, gestione licenze con periodo di prova.' } },
      pricing: { heading: 'Partire in piccolo, crescere con il team.', a: { title: 'Base', price: 'gratuito', sub: 'fino a 3 agenti / 1 amministratore', li1: '· Ticket dalle e-mail', li2: '· Risposte e note interne', li3: '· Controllo tramite AuraChat' }, b: { title: 'Esteso', price: 'su richiesta', sub: 'più agenti e amministratori', li1: '· Tutte le funzionalità', li2: '· Limiti definiti per chiave di licenza' }, note: "14 giorni di prova. Prezzi su richiesta — prepariamo volentieri un'offerta." }
    },
    es: {
      nav: 'AuraTicket',
      hero: { title: 'Tickets de soporte a partir de tus correos — y AuraChat te mantiene informado.', lead: 'AuraTicket convierte los correos entrantes en tickets que tu equipo gestiona y responde. Conectado con AuraMail para el envío y con AuraChat para controlar los tickets por voz.' },
      features: { heading: 'De la bandeja de entrada al ticket resuelto.',
        f1: { title: 'El correo se convierte en ticket', desc: 'Los correos que llegan a un buzón de soporte se convierten automáticamente en tickets. Las respuestas a tickets existentes se asignan mediante el número de ticket en el asunto.' },
        f2: { title: 'Respuestas y notas internas', desc: 'Responder a los clientes por correo o anotar notas internas. Estado, prioridad y responsable por ticket.' },
        f3: { title: 'Campañas de correo', desc: 'Enviar correos a una lista CSV, con saludo personalizado y envío escalonado en segundo plano.' },
        f4: { title: 'Control mediante AuraChat', desc: '«¿Cuántos tickets hay abiertos?», «Cierra el ticket T-00001», «Responde al ticket …» — y los tickets nuevos se te leen en voz alta.' },
        f5: { title: 'Inicio de sesión central', desc: 'Acceso con la cuenta de AuraDirect, incluida la autenticación en dos pasos centralizada.' },
        f6: { title: 'Administración', desc: 'Gestión de usuarios, copia de seguridad y restauración, gestión de licencias con periodo de prueba.' } },
      pricing: { heading: 'Empezar en pequeño, crecer con el equipo.', a: { title: 'Básico', price: 'gratis', sub: 'hasta 3 agentes / 1 administrador', li1: '· Tickets a partir de correos', li2: '· Respuestas y notas internas', li3: '· Control mediante AuraChat' }, b: { title: 'Ampliado', price: 'bajo consulta', sub: 'más agentes y administradores', li1: '· Todas las funciones', li2: '· Límites definidos por clave de licencia' }, note: '14 días de prueba. Precios bajo consulta — con gusto preparamos una oferta.' }
    }
  },

  // =====================================================================================
  auraproxy: {
    icon: '🔀', file: 'AuraProxy', port: 3500, zip: 'auraproxy-quickstart.zip',
    cardIcons: ['🔀', '🔒', '📜', '🔢', '🔑', '🛠️'],
    de: {
      nav: 'AuraProxy',
      hero: { title: 'Ein Eingang für alle eure Dienste — mit automatischem HTTPS.', lead: 'AuraProxy leitet Anfragen aus dem Internet an die richtigen Dienste in eurem Netz weiter und besorgt für jede Domain automatisch ein Let\'s-Encrypt-Zertifikat. Basierend auf Caddy, verwaltet über eine einfache Oberfläche.' },
      features: { heading: 'Domains, Ports und Zertifikate an einem Ort.',
        f1: { title: 'Domain → interne Adresse', desc: 'Pro Domain festlegen, an welche interne Adresse und welchen Port weitergeleitet wird. Einträge lassen sich bearbeiten, pausieren und löschen.' },
        f2: { title: 'Automatische Zertifikate', desc: 'Let\'s-Encrypt-Zertifikate werden pro Domain automatisch geholt und erneuert.' },
        f3: { title: 'Zertifikate im Überblick', desc: 'Aktive Zertifikate mit Ablaufdatum anzeigen, löschen oder ein eigenes Zertifikat pro Domain hochladen.' },
        f4: { title: 'Mehrere Ports', desc: 'Neben 80 und 443 lassen sich weitere, vorab in der Docker-Konfiguration freigegebene Ports nutzen — z.B. https://domain:8092.' },
        f5: { title: 'Zentrale Anmeldung', desc: 'Anmeldung mit dem AuraDirect-Konto, inklusive zentraler Zwei-Faktor-Authentifizierung.' },
        f6: { title: 'Administration', desc: 'Backup &amp; Wiederherstellung, Lizenzverwaltung mit Testphase.' } },
      pricing: servicePricing('de', '· Domains, Ports und Zertifikate')
    },
    en: {
      nav: 'AuraProxy',
      hero: { title: 'One front door for all your services — with automatic HTTPS.', lead: 'AuraProxy forwards requests from the internet to the right services in your network and automatically obtains a Let\'s Encrypt certificate for every domain. Built on Caddy, managed through a simple interface.' },
      features: { heading: 'Domains, ports and certificates in one place.',
        f1: { title: 'Domain → internal address', desc: 'Define per domain which internal address and port to forward to. Entries can be edited, paused and deleted.' },
        f2: { title: 'Automatic certificates', desc: 'Let\'s Encrypt certificates are obtained and renewed automatically per domain.' },
        f3: { title: 'Certificates at a glance', desc: 'Show active certificates with their expiry date, delete them, or upload your own certificate per domain.' },
        f4: { title: 'Multiple ports', desc: 'Besides 80 and 443 you can use further ports that were opened in advance in the Docker configuration — e.g. https://domain:8092.' },
        f5: { title: 'Central login', desc: 'Sign in with your AuraDirect account, including central two-factor authentication.' },
        f6: { title: 'Administration', desc: 'Backup &amp; restore, license management with trial period.' } },
      pricing: servicePricing('en', '· Domains, ports and certificates')
    },
    fr: {
      nav: 'AuraProxy',
      hero: { title: "Un point d'entrée unique pour tous vos services — avec HTTPS automatique.", lead: "AuraProxy transmet les requêtes d'Internet vers les bons services de votre réseau et obtient automatiquement un certificat Let's Encrypt pour chaque domaine. Basé sur Caddy, géré via une interface simple." },
      features: { heading: 'Domaines, ports et certificats au même endroit.',
        f1: { title: 'Domaine → adresse interne', desc: "Définir pour chaque domaine vers quelle adresse interne et quel port rediriger. Les entrées peuvent être modifiées, mises en pause et supprimées." },
        f2: { title: 'Certificats automatiques', desc: "Les certificats Let's Encrypt sont obtenus et renouvelés automatiquement pour chaque domaine." },
        f3: { title: "Certificats en un coup d'œil", desc: "Afficher les certificats actifs avec leur date d'expiration, les supprimer ou téléverser son propre certificat par domaine." },
        f4: { title: 'Plusieurs ports', desc: "En plus de 80 et 443, d'autres ports ouverts à l'avance dans la configuration Docker sont utilisables — p. ex. https://domaine:8092." },
        f5: { title: 'Connexion centrale', desc: "Connexion avec le compte AuraDirect, y compris l'authentification à deux facteurs centralisée." },
        f6: { title: 'Administration', desc: "Sauvegarde et restauration, gestion des licences avec période d'essai." } },
      pricing: servicePricing('fr', '· Domaines, ports et certificats')
    },
    it: {
      nav: 'AuraProxy',
      hero: { title: 'Un unico ingresso per tutti i vostri servizi — con HTTPS automatico.', lead: "AuraProxy inoltra le richieste da Internet ai servizi giusti nella vostra rete e ottiene automaticamente un certificato Let's Encrypt per ogni dominio. Basato su Caddy, gestito tramite un'interfaccia semplice." },
      features: { heading: 'Domini, porte e certificati in un unico posto.',
        f1: { title: 'Dominio → indirizzo interno', desc: 'Definire per ogni dominio a quale indirizzo interno e porta inoltrare. Le voci si possono modificare, mettere in pausa ed eliminare.' },
        f2: { title: 'Certificati automatici', desc: "I certificati Let's Encrypt vengono ottenuti e rinnovati automaticamente per ogni dominio." },
        f3: { title: "Certificati a colpo d'occhio", desc: 'Mostrare i certificati attivi con la data di scadenza, eliminarli o caricare un certificato proprio per dominio.' },
        f4: { title: 'Più porte', desc: 'Oltre a 80 e 443 si possono usare altre porte aperte in anticipo nella configurazione Docker — ad es. https://dominio:8092.' },
        f5: { title: 'Accesso centrale', desc: "Accesso con l'account AuraDirect, inclusa l'autenticazione a due fattori centralizzata." },
        f6: { title: 'Amministrazione', desc: 'Backup e ripristino, gestione licenze con periodo di prova.' } },
      pricing: servicePricing('it', '· Domini, porte e certificati')
    },
    es: {
      nav: 'AuraProxy',
      hero: { title: 'Una única puerta de entrada para todos tus servicios — con HTTPS automático.', lead: 'AuraProxy reenvía las solicitudes de Internet a los servicios correctos de tu red y obtiene automáticamente un certificado Let\'s Encrypt para cada dominio. Basado en Caddy, gestionado con una interfaz sencilla.' },
      features: { heading: 'Dominios, puertos y certificados en un solo lugar.',
        f1: { title: 'Dominio → dirección interna', desc: 'Define por dominio a qué dirección interna y puerto se reenvía. Las entradas se pueden editar, pausar y eliminar.' },
        f2: { title: 'Certificados automáticos', desc: 'Los certificados Let\'s Encrypt se obtienen y renuevan automáticamente por dominio.' },
        f3: { title: 'Certificados de un vistazo', desc: 'Mostrar los certificados activos con su fecha de caducidad, eliminarlos o subir un certificado propio por dominio.' },
        f4: { title: 'Varios puertos', desc: 'Además de 80 y 443 se pueden usar otros puertos abiertos de antemano en la configuración de Docker — p. ej. https://dominio:8092.' },
        f5: { title: 'Inicio de sesión central', desc: 'Acceso con la cuenta de AuraDirect, incluida la autenticación en dos pasos centralizada.' },
        f6: { title: 'Administración', desc: 'Copia de seguridad y restauración, gestión de licencias con periodo de prueba.' } },
      pricing: servicePricing('es', '· Dominios, puertos y certificados')
    }
  }
};

// ---------- Übersicht "Produkte" + Änderungen an bestehenden Texten ----------
const shared = {
  de: {
    navProdukte: 'Produkte',
    ecosystem: { heading: 'Das Aura-Ökosystem: Produkte, die zusammenarbeiten.', lead: 'AuraChat ist der Mittelpunkt — dazu kommen eigenständige Produkte für Zeiterfassung, Tickets, Mail, Benutzerverwaltung und den sicheren Zugang von aussen. Einzeln nutzbar, gemeinsam am stärksten.',
      apps: { title: 'Anwendungen', sub: 'AuraChat, AuraPlan, AuraTicket — mit kostenloser Basisstufe und Testphase.' },
      services: { title: 'Dienste', sub: 'AuraDirect, AuraMail, AuraProxy — kostenlos bis 4 Konten oder sobald mindestens zwei Anwendungen verbunden sind, sonst CHF 15.– pro Installation / Mt.' },
      more: 'Mehr erfahren →',
      auraplan: 'Zeiterfassung, Schichtplan und Ferien — per Klick oder Zuruf.',
      auradirect: 'Eine Anmeldung für alle Produkte, mit Active Directory und zentraler 2FA.',
      auramail: 'Eigener Mailserver oder Microsoft 365 — persönliche und geteilte Postfächer.',
      auraticket: 'Support-Tickets aus E-Mails, steuerbar per Sprache.',
      auraproxy: 'Ein Eingang für alle Dienste, mit automatischem HTTPS.' },
    quickstart: { lead: 'Ein Befehl installiert alles: Oberfläche, Server, HTTPS, Web-Suche und Sprache. Kostenlos starten mit bis zu 3 Benutzern — jederzeit auf Premium erweiterbar.',
      step1: '// 1. Einmalig: eigene Schlüssel erzeugen (gut aufbewahren)', step2: '// 2. Alles installieren und starten', step3: '// Später aktualisieren',
      note: 'Voraussetzung: Docker Engine 25 oder neuer. Auf älteren Systemen (z.B. manche NAS) stattdessen die Compose-Datei herunterladen und mit „docker compose up -d“ starten.',
      button: '⬇ Compose-Datei für ältere Systeme herunterladen' },
    commands: { title: 'Chat- &amp; Sprachbefehle', desc: 'AuraPlan, AuraTicket, AuraMail, Sonos, Nuki und IKEA per Zuruf steuern: einstempeln, Tickets bearbeiten, E-Mails diktieren, Türen und Lampen schalten.' },
    integrationsDesc: 'Smart-Home-Steuerung (IKEA, Nuki, Sonos, eigene Geräte), Anbindung an AuraPlan, AuraTicket und AuraMail, E-Mail per IMAP oder Microsoft 365 inklusive KI-Antwortentwürfen, offene API für externe Plattformen.',
    auradirect: { heroLead: 'AuraDirect ist die zentrale Benutzerverwaltung für AuraChat, AuraPlan, AuraTicket, AuraMail und AuraProxy — inklusive Active-Directory-Anbindung und zentraler Zwei-Faktor-Authentifizierung.', ssoDesc: 'Ein Benutzerkonto für alle Aura-Produkte — pro Person festlegen, welche Produkte sie nutzen darf und mit welcher Rolle.', includedSub: 'bis 4 Benutzer, oder sobald mindestens zwei Aura-Anwendungen verbunden sind', standaloneLi2: '· Ohne weitere Aura-Anwendung' }
  },
  en: {
    navProdukte: 'Products',
    ecosystem: { heading: 'The Aura ecosystem: products that work together.', lead: 'AuraChat is the centre — alongside it come standalone products for time tracking, tickets, mail, user management and secure access from outside. Usable on their own, strongest together.',
      apps: { title: 'Applications', sub: 'AuraChat, AuraPlan, AuraTicket — with a free basic tier and a trial period.' },
      services: { title: 'Services', sub: 'AuraDirect, AuraMail, AuraProxy — free for up to 4 accounts or as soon as at least two applications are connected, otherwise CHF 15.– per installation / mo.' },
      more: 'Learn more →',
      auraplan: 'Time tracking, shift plan and vacation — by click or voice.',
      auradirect: 'One login for all products, with Active Directory and central 2FA.',
      auramail: 'Own mail server or Microsoft 365 — personal and shared mailboxes.',
      auraticket: 'Support tickets from emails, controllable by voice.',
      auraproxy: 'One front door for all services, with automatic HTTPS.' },
    quickstart: { lead: 'One command installs everything: interface, server, HTTPS, web search and voice. Start free with up to 3 users — upgrade to Premium any time.',
      step1: '// 1. Once: generate your own keys (keep them safe)', step2: '// 2. Install and start everything', step3: '// Later: update',
      note: 'Requires Docker Engine 25 or newer. On older systems (e.g. some NAS devices), download the compose file instead and start it with “docker compose up -d”.',
      button: '⬇ Download compose file for older systems' },
    commands: { title: 'Chat &amp; voice commands', desc: 'Control AuraPlan, AuraTicket, AuraMail, Sonos, Nuki and IKEA by voice: clock in, handle tickets, dictate emails, switch doors and lamps.' },
    integrationsDesc: 'Smart-home control (IKEA, Nuki, Sonos, custom devices), connection to AuraPlan, AuraTicket and AuraMail, email via IMAP or Microsoft 365 including AI reply drafts, open API for external platforms.',
    auradirect: { heroLead: 'AuraDirect is the central identity provider for AuraChat, AuraPlan, AuraTicket, AuraMail and AuraProxy — including Active Directory integration and centralised two-factor authentication. Set up once, use everywhere.', ssoDesc: 'One user account for all Aura products — decide per person which products they may use and with which role.', includedSub: 'up to 4 users, or as soon as at least two Aura applications are connected', standaloneLi2: '· Without another Aura application' }
  },
  fr: {
    navProdukte: 'Produits',
    ecosystem: { heading: "L'écosystème Aura : des produits qui fonctionnent ensemble.", lead: "AuraChat est le centre — viennent s'y ajouter des produits autonomes pour la saisie du temps, les tickets, la messagerie, la gestion des utilisateurs et l'accès sécurisé depuis l'extérieur. Utilisables seuls, plus forts ensemble.",
      apps: { title: 'Applications', sub: "AuraChat, AuraPlan, AuraTicket — avec un niveau de base gratuit et une période d'essai." },
      services: { title: 'Services', sub: "AuraDirect, AuraMail, AuraProxy — gratuits jusqu'à 4 comptes ou dès que deux applications au moins sont connectées, sinon CHF 15.– par installation / mois." },
      more: 'En savoir plus →',
      auraplan: 'Saisie du temps, planning et vacances — par clic ou à la voix.',
      auradirect: 'Une seule connexion pour tous les produits, avec Active Directory et 2FA centralisée.',
      auramail: 'Serveur de messagerie propre ou Microsoft 365 — boîtes personnelles et partagées.',
      auraticket: "Tickets de support à partir d'e-mails, pilotables à la voix.",
      auraproxy: "Un point d'entrée unique pour tous les services, avec HTTPS automatique." },
    quickstart: { lead: "Une seule commande installe tout : interface, serveur, HTTPS, recherche web et voix. Démarrez gratuitement jusqu'à 3 utilisateurs — évolutif vers Premium à tout moment.",
      step1: '// 1. Une seule fois : générer ses propres clés (à conserver)', step2: '// 2. Tout installer et démarrer', step3: '// Plus tard : mettre à jour',
      note: 'Nécessite Docker Engine 25 ou plus récent. Sur des systèmes plus anciens (p. ex. certains NAS), téléchargez plutôt le fichier compose et lancez-le avec « docker compose up -d ».',
      button: '⬇ Télécharger le fichier compose (systèmes plus anciens)' },
    commands: { title: 'Commandes par chat et par la voix', desc: 'Pilotez AuraPlan, AuraTicket, AuraMail, Sonos, Nuki et IKEA à la voix : pointer, traiter des tickets, dicter des e-mails, commander portes et lampes.' },
    integrationsDesc: "Domotique (IKEA, Nuki, Sonos, appareils personnalisés), liaison avec AuraPlan, AuraTicket et AuraMail, e-mail via IMAP ou Microsoft 365 avec brouillons de réponse par IA, API ouverte pour plateformes externes.",
    auradirect: { heroLead: "AuraDirect est le fournisseur d'identité central pour AuraChat, AuraPlan, AuraTicket, AuraMail et AuraProxy — avec intégration Active Directory et authentification à deux facteurs centralisée. Configuré une fois, utilisé partout.", ssoDesc: "Un seul compte utilisateur pour tous les produits Aura — définir pour chaque personne quels produits elle peut utiliser et avec quel rôle.", includedSub: "jusqu'à 4 utilisateurs, ou dès que deux applications Aura au moins sont connectées", standaloneLi2: '· Sans autre application Aura' }
  },
  it: {
    navProdukte: 'Prodotti',
    ecosystem: { heading: "L'ecosistema Aura: prodotti che lavorano insieme.", lead: "AuraChat è il centro — a esso si aggiungono prodotti autonomi per la rilevazione delle ore, i ticket, la posta, la gestione utenti e l'accesso sicuro dall'esterno. Utilizzabili da soli, più forti insieme.",
      apps: { title: 'Applicazioni', sub: 'AuraChat, AuraPlan, AuraTicket — con un livello base gratuito e un periodo di prova.' },
      services: { title: 'Servizi', sub: 'AuraDirect, AuraMail, AuraProxy — gratuiti fino a 4 account o non appena sono collegate almeno due applicazioni, altrimenti CHF 15.– per installazione / mese.' },
      more: 'Scopri di più →',
      auraplan: 'Rilevazione ore, piano turni e ferie — con un clic o a voce.',
      auradirect: 'Un unico accesso per tutti i prodotti, con Active Directory e 2FA centralizzata.',
      auramail: 'Server di posta proprio o Microsoft 365 — caselle personali e condivise.',
      auraticket: 'Ticket di supporto dalle e-mail, controllabili a voce.',
      auraproxy: 'Un unico ingresso per tutti i servizi, con HTTPS automatico.' },
    quickstart: { lead: 'Un solo comando installa tutto: interfaccia, server, HTTPS, ricerca web e voce. Iniziate gratis con fino a 3 utenti — passaggio a Premium in qualsiasi momento.',
      step1: '// 1. Una volta sola: generare le proprie chiavi (da conservare)', step2: '// 2. Installare e avviare tutto', step3: '// In seguito: aggiornare',
      note: 'Richiede Docker Engine 25 o successivo. Su sistemi più vecchi (ad es. alcuni NAS) scaricate invece il file compose e avviatelo con «docker compose up -d».',
      button: '⬇ Scarica il file compose (sistemi più vecchi)' },
    commands: { title: 'Comandi chat e vocali', desc: 'Controllate AuraPlan, AuraTicket, AuraMail, Sonos, Nuki e IKEA a voce: timbrare, gestire ticket, dettare e-mail, comandare porte e lampade.' },
    integrationsDesc: 'Controllo smart home (IKEA, Nuki, Sonos, dispositivi personalizzati), collegamento ad AuraPlan, AuraTicket e AuraMail, e-mail via IMAP o Microsoft 365 con bozze di risposta IA, API aperta per piattaforme esterne.',
    auradirect: { heroLead: "AuraDirect è il provider di identità centrale per AuraChat, AuraPlan, AuraTicket, AuraMail e AuraProxy — con integrazione Active Directory e autenticazione a due fattori centralizzata. Configurato una volta, usato ovunque.", ssoDesc: 'Un unico account utente per tutti i prodotti Aura — si definisce per ogni persona quali prodotti può usare e con quale ruolo.', includedSub: 'fino a 4 utenti, oppure non appena sono collegate almeno due applicazioni Aura', standaloneLi2: '· Senza altra applicazione Aura' }
  },
  es: {
    navProdukte: 'Productos',
    ecosystem: { heading: 'El ecosistema Aura: productos que trabajan juntos.', lead: 'AuraChat es el centro — a su lado hay productos independientes para el control horario, tickets, correo, gestión de usuarios y acceso seguro desde fuera. Utilizables por separado, más fuertes juntos.',
      apps: { title: 'Aplicaciones', sub: 'AuraChat, AuraPlan, AuraTicket — con un nivel básico gratuito y un periodo de prueba.' },
      services: { title: 'Servicios', sub: 'AuraDirect, AuraMail, AuraProxy — gratis hasta 4 cuentas o en cuanto haya al menos dos aplicaciones conectadas; si no, CHF 15.– por instalación / mes.' },
      more: 'Saber más →',
      auraplan: 'Control horario, turnos y vacaciones — con un clic o por voz.',
      auradirect: 'Un solo acceso para todos los productos, con Active Directory y 2FA centralizada.',
      auramail: 'Servidor de correo propio o Microsoft 365 — buzones personales y compartidos.',
      auraticket: 'Tickets de soporte a partir de correos, controlables por voz.',
      auraproxy: 'Una única puerta de entrada para todos los servicios, con HTTPS automático.' },
    quickstart: { lead: 'Un solo comando lo instala todo: interfaz, servidor, HTTPS, búsqueda web y voz. Empieza gratis con hasta 3 usuarios — ampliable a Premium en cualquier momento.',
      step1: '// 1. Una sola vez: generar tus propias claves (guárdalas bien)', step2: '// 2. Instalar y arrancar todo', step3: '// Más adelante: actualizar',
      note: 'Requiere Docker Engine 25 o superior. En sistemas más antiguos (p. ej. algunos NAS), descarga el archivo compose y arráncalo con «docker compose up -d».',
      button: '⬇ Descargar archivo compose (sistemas antiguos)' },
    commands: { title: 'Comandos de chat y de voz', desc: 'Controla AuraPlan, AuraTicket, AuraMail, Sonos, Nuki e IKEA por voz: fichar, gestionar tickets, dictar correos, accionar puertas y lámparas.' },
    integrationsDesc: 'Control del hogar inteligente (IKEA, Nuki, Sonos, dispositivos propios), conexión con AuraPlan, AuraTicket y AuraMail, correo por IMAP o Microsoft 365 con borradores de respuesta por IA, API abierta para plataformas externas.',
    auradirect: { heroLead: 'AuraDirect es el proveedor de identidad central de AuraChat, AuraPlan, AuraTicket, AuraMail y AuraProxy — con integración de Active Directory y autenticación en dos pasos centralizada. Se configura una vez y se usa en todas partes.', ssoDesc: 'Una sola cuenta de usuario para todos los productos Aura — se define por persona qué productos puede usar y con qué rol.', includedSub: 'hasta 4 usuarios, o en cuanto haya al menos dos aplicaciones Aura conectadas', standaloneLi2: '· Sin otra aplicación Aura' }
  }
};

module.exports = { products, shared, DOWNLOADS, NOTE, LANGS: ['de', 'en', 'fr', 'it', 'es'] };
